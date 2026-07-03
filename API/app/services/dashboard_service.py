"""
Dashboard service — business logic for dashboard endpoints.

``DashboardService`` orchestrates:
  - Fetching and assembling the dashboard summary (servers + top failing checks)
  - Mapping latest_run_status int → string label
  - Validating bucket_interval values (Req 9.5)
  - Delegating to dashboard_repo for raw SQL

Req 9.1  — dashboard summary endpoint
Req 9.3  — per-server health endpoint
Req 9.4  — metrics chart endpoint
Req 9.5  — unsupported_bucket_interval validation
Req 9.7  — top failing checks
Req 9.8  — health_trend (handled in SQL)
Req 9.10 — collector_state (handled in SQL)
"""

from __future__ import annotations

import logging
from datetime import datetime

import asyncpg
from fastapi import HTTPException

from app.core.config import get_settings
from app.models.responses.dashboard import (
    LATEST_RUN_STATUS_MAP,
    DashboardSummaryItem,
    DashboardSummaryResponse,
    MetricChartResponse,
    PerServerHealthResponse,
    TopFailingCheck,
)
from app.repositories import dashboard_repo

logger = logging.getLogger(__name__)

# Valid bucket intervals for the metrics chart endpoint (Req 9.5)
VALID_BUCKET_INTERVALS: frozenset[str] = frozenset({"5m", "15m", "1h", "6h", "1d"})


class DashboardService:
    """
    Service layer for dashboard operations.

    All public methods accept an asyncpg connection so that callers can
    control transaction boundaries.
    """

    # ------------------------------------------------------------------
    # 31.1 — get_summary
    # ------------------------------------------------------------------

    async def get_summary(
        self,
        conn: asyncpg.Connection,
    ) -> DashboardSummaryResponse:
        """
        Return the aggregated health overview for all active servers.

        Fetches the CTE-based summary and the top-failing-checks list in
        two queries, then assembles the response model.

        Req 9.1  — all required fields per server.
        Req 9.2  — minimal round-trips (two queries).
        Req 9.6  — sort order handled by SQL ORDER BY.
        Req 9.7  — top_failing_checks included.
        Req 9.8  — health_trend computed in SQL.
        Req 9.10 — collector_state computed in SQL.

        Parameters
        ----------
        conn:
            An asyncpg connection.

        Returns
        -------
        DashboardSummaryResponse
        """
        settings = get_settings()

        # Fetch both in parallel would require two connections; keep sequential
        # since the CTE query is the expensive one and top-failing is cheap.
        summary_rows = await dashboard_repo.get_summary(
            conn, staleness_threshold_secs=settings.STALENESS_THRESHOLD_SECS
        )
        top_failing_rows = await dashboard_repo.get_top_failing_checks(conn)

        servers = [
            DashboardSummaryItem(
                server_id=row["server_id"],
                server_label=row["server_label"],
                env_type=row.get("env_type"),
                server_role=row.get("server_role"),
                last_heartbeat=row.get("last_heartbeat"),
                open_incident_count=int(row["open_incident_count"]),
                unack_alert_count=int(row["unack_alert_count"]),
                latest_run_status=LATEST_RUN_STATUS_MAP.get(row.get("latest_run_status")),
                health_trend=row["health_trend"],
                collector_state=row["collector_state"],
                retention_metrics_days=int(row["retention_metrics_days"]),
                retention_logs_days=int(row["retention_logs_days"]),
            )
            for row in summary_rows
        ]

        top_failing_checks = [
            TopFailingCheck(
                check_id=row["check_id"],
                check_name=row["check_name"],
                failure_count=int(row["failure_count"]),
            )
            for row in top_failing_rows
        ]

        return DashboardSummaryResponse(
            servers=servers,
            top_failing_checks=top_failing_checks,
        )

    # ------------------------------------------------------------------
    # 31.1 — get_server_health
    # ------------------------------------------------------------------

    async def get_server_health(
        self,
        conn: asyncpg.Connection,
        server_id: int,
        n: int = 20,
    ) -> list[PerServerHealthResponse]:
        """
        Return the most recent check run per check for a given server.

        Maps status int → string label and joins check_name from the
        repository layer (check_name is not available in check_runs;
        it is returned as None here — callers may enrich if needed).

        Req 9.3 — per-server last N check runs grouped by check.

        Parameters
        ----------
        conn:
            An asyncpg connection.
        server_id:
            The server to query.
        n:
            Maximum number of distinct checks to return (default 20).

        Returns
        -------
        list[PerServerHealthResponse]
        """
        rows = await dashboard_repo.get_server_health(conn, server_id=server_id, n=n)

        return [
            PerServerHealthResponse(
                server_id=row["server_id"],
                check_id=row["check_id"],
                check_name=None,  # not available from check_runs; enriched if needed
                latest_status=LATEST_RUN_STATUS_MAP.get(row.get("status")),
                latest_execution_time_ms=row.get("execution_time_ms"),
                run_count=1,  # DISTINCT ON returns one row per check
            )
            for row in rows
        ]

    # ------------------------------------------------------------------
    # 31.1 — get_metrics_chart
    # ------------------------------------------------------------------

    async def get_metrics_chart(
        self,
        conn: asyncpg.Connection,
        server_id: int,
        metric_name: str,
        bucket_interval: str,
        from_dt: datetime,
        to_dt: datetime,
    ) -> list[MetricChartResponse]:
        """
        Return time-bucketed metric aggregates for chart rendering.

        Validates ``bucket_interval`` before querying (Req 9.5).

        Parameters
        ----------
        conn:
            An asyncpg connection.
        server_id:
            Required filter on ``server_id``.
        metric_name:
            Required filter on ``metric_name``.
        bucket_interval:
            One of ``'5m'``, ``'15m'``, ``'1h'``, ``'6h'``, ``'1d'``.
        from_dt:
            Lower bound for ``collected_at`` (inclusive).
        to_dt:
            Upper bound for ``collected_at`` (inclusive).

        Returns
        -------
        list[MetricChartResponse]
            Ordered by bucket ASC.

        Raises
        ------
        HTTPException(422)
            ``unsupported_bucket_interval`` — invalid bucket_interval value (Req 9.5).
        """
        if bucket_interval not in VALID_BUCKET_INTERVALS:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "unsupported_bucket_interval",
                    "message": (
                        f"Unsupported bucket_interval '{bucket_interval}'. "
                        f"Supported values: {sorted(VALID_BUCKET_INTERVALS)}."
                    ),
                },
            )

        rows = await dashboard_repo.get_metrics_chart(
            conn,
            server_id=server_id,
            metric_name=metric_name,
            bucket_interval=bucket_interval,
            from_dt=from_dt,
            to_dt=to_dt,
        )

        return [
            MetricChartResponse(
                bucket=row["bucket"],
                avg_value=float(row["avg_value"]),
                min_value=float(row["min_value"]),
                max_value=float(row["max_value"]),
                sample_count=int(row["sample_count"]),
            )
            for row in rows
        ]
