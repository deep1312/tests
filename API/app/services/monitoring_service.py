# C:\Users\RishiShah\pg_utility\PG Utility\api\app\services\monitoring_service.py

"""
Monitoring service — business logic for monitoring visibility endpoints.
Orchestrates time-range validation and repository delegation for PG-specific metrics.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import asyncpg
from fastapi import HTTPException

from app.models.responses.monitoring import (
    CHECK_RUN_STATUS_MAP,
    MONITORING_LOG_STATUS_MAP,
    CheckRunResponse,
    HistoricalPerCheckPoint,
    LatestPerCheckRow,
    MetricAggregatePoint,
    MetricResponse,
    MonitoringLogResponse,
    RunsAggregatePoint,
    RunsSummaryResponse,
    TableCountHistoryPoint,
)
from app.repositories import monitoring_repo

logger = logging.getLogger(__name__)

# Valid bucket intervals for the aggregation endpoint (Req 9.5)
VALID_BUCKET_INTERVALS = {"5m", "15m", "1h", "6h", "1d"}

# Maximum raw metrics time range in days (Req 6.8)
MAX_RAW_METRICS_DAYS = 30

# Time range threshold above which metrics auto-switch to aggregation
AUTO_AGGREGATE_THRESHOLD = timedelta(hours=24)


def _now_utc() -> datetime:
    """Return the current UTC datetime."""
    return datetime.now(timezone.utc)


def _ensure_tz_aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensures datetime inputs are consistently timezone aware to optimize queries."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _resolve_time_range(
    from_dt: datetime | None,
    to_dt: datetime | None,
) -> tuple[datetime, datetime]:
    """Resolve a time range, defaulting to the last 24 hours."""
    effective_to = _ensure_tz_aware(to_dt) or _now_utc()
    effective_from = _ensure_tz_aware(from_dt) or (effective_to - timedelta(hours=24))
    return effective_from, effective_to


class MonitoringService:
    """
    Service layer orchestrating time-range validation and repo delegation.
    """

    async def get_runs_summary(
        self,
        conn: asyncpg.Connection,
        server_id: int | None = None,
        check_id: int | None = None,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
    ) -> RunsSummaryResponse:
        """
        Fetches summary counts and dynamic live metrics (Connection %, Lag, etc).
        Returns a RunsSummaryResponse which now accepts a list of live_metrics.
        """
        effective_from, effective_to = _resolve_time_range(from_dt, to_dt)
        data = await monitoring_repo.get_runs_summary(
            conn,
            server_id=server_id,
            check_id=check_id,
            from_dt=effective_from,
            to_dt=effective_to,
        )
        return RunsSummaryResponse(**data)

    async def get_check_details(
        self,
        conn: asyncpg.Connection,
        server_id: int,
        check_id: int,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
    ) -> dict:
        from_dt, to_dt = _resolve_time_range(from_dt, to_dt)
        
        # 1. Fetch Tabular Data
        tabular_data = await monitoring_repo.get_latest_tabular_data(conn, server_id, check_id)
        
        # 2. Fetch Trend Data
        trends = await self.aggregate_check_runs(
            conn, from_dt, to_dt, bucket_interval="1h", server_id=server_id, check_id=check_id
        )

        return {
            "server_id": server_id,
            "check_id": check_id,
            "trends": trends,
            "tabular_result": tabular_data,
            # Pass the collected_at from the tabular_data up to the response
            "collected_at": tabular_data.get("collected_at") if tabular_data else None
        }

    async def get_historical_dashboard(
        self,
        conn: asyncpg.Connection,
        server_id: int,
        time_range: str,
        bucket: str,
        metrics: list[str],
    ) -> dict[str, Any]:
        """
        Orchestrates historical metrics calculations for the dashboard filters.
        Converts human UI parameters into absolute UTC timeframes, resolves case variations,
        and aggregates continuous metric keys using the pre-existing aggregate_metrics pipeline.
        """
        # 1. Resolve human time range strings into real timestamp boundaries
        to_dt = _now_utc()
        range_map = {
            "1H": timedelta(hours=1),
            "6H": timedelta(hours=6),
            "24H": timedelta(hours=24),
            "7D": timedelta(days=7)
        }
        from_dt = to_dt - range_map.get(time_range, timedelta(hours=1))

        # 2. Convert UI uppercase bucket interval into backend lowercase notation ("1H" -> "1h")
        backend_bucket = bucket.lower()

        # 3. Process time-series indicators vs tabular layout assets safely
        tabular_types = {"slow_queries", "table_bloat", "unused_indexes"}
        
        timeseries_metrics: dict[str, list[MetricAggregatePoint]] = {}
        tabular_metrics: dict[str, Any] = {}

        for metric_name in metrics:
            if metric_name in tabular_types:
                try:
                    # Note: Since tabular charts don't stretch linearly across time series nodes,
                    # we extract the targeted internal metadata snapshot block
                    check_id_map = {"slow_queries": 101, "table_bloat": 102, "unused_indexes": 103}
                    target_check = check_id_map.get(metric_name, 0)
                    
                    tab_data = await monitoring_repo.get_historical_tabular_data(
                        conn=conn,
                        server_id=server_id,
                        check_id=target_check,
                        from_dt=from_dt,
                        to_dt=to_dt,
                    )
                    if tab_data:
                        tabular_metrics[metric_name] = tab_data
                except Exception as ex:
                    logger.warning(f"Could not extract historical matrix tabular data for {metric_name}: {ex}")
            else:
                # Invoke your verified production aggregation engine pipeline!
                try:
                    aggregated_points = await self.aggregate_metrics(
                        conn=conn,
                        server_id=server_id,
                        metric_name=metric_name,
                        from_dt=from_dt,
                        to_dt=to_dt,
                        bucket_interval=backend_bucket
                    )
                    timeseries_metrics[metric_name] = aggregated_points
                except Exception as ex:
                    logger.error(f"Error executing trend aggregation logic for {metric_name}: {ex}")
                    timeseries_metrics[metric_name] = []

        # Return a dictionary context that perfectly fits your HistoricalDashboardResponse initialization schema
        return {
            "instance": f"Server #{server_id}",
            "time_range": time_range,
            "bucket": bucket,
            "timeseries_metrics": timeseries_metrics,
            "tabular_metrics": tabular_metrics
        }
    
    async def get_historical_per_check(
        self,
        conn: asyncpg.Connection,
        server_id: int | None = None,
        check_id: int | None = None,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
        bucket_interval: str = "1h",
    ) -> list[HistoricalPerCheckPoint]:
        """Returns time-bucketed historical metric values for one or all checks."""
        if bucket_interval not in VALID_BUCKET_INTERVALS:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "unsupported_bucket_interval",
                    "message": f"Unsupported interval. Use: {sorted(VALID_BUCKET_INTERVALS)}.",
                },
            )

        effective_from, effective_to = _resolve_time_range(from_dt, to_dt)
        check_ids = [check_id] if check_id is not None else list(range(1, 13))

        results: list[HistoricalPerCheckPoint] = []
        for cid in check_ids:
            try:
                rows = await monitoring_repo.get_historical_per_check(
                    conn,
                    server_id=server_id,
                    check_id=cid,
                    from_dt=effective_from,
                    to_dt=effective_to,
                    bucket_interval=bucket_interval,
                )
                results.extend(HistoricalPerCheckPoint(**row) for row in rows)
            except Exception:
                logger.warning(
                    "Skipping check_id=%s for historical-per-check (server_id=%s): query failed",
                    cid, server_id, exc_info=True,
                )

        return results

    async def aggregate_check_runs(
        self,
        conn: asyncpg.Connection,
        from_dt: datetime,
        to_dt: datetime,
        bucket_interval: str,
        server_id: int | None = None,
        check_id: int | None = None,
    ) -> list[RunsAggregatePoint]:
        """Aggregate check run success/failure rates into time buckets."""
        if bucket_interval not in VALID_BUCKET_INTERVALS:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "unsupported_bucket_interval",
                    "message": f"Unsupported interval. Use: {sorted(VALID_BUCKET_INTERVALS)}.",
                },
            )

        rows = await monitoring_repo.aggregate_check_runs(
            conn,
            from_dt=_ensure_tz_aware(from_dt),
            to_dt=_ensure_tz_aware(to_dt),
            bucket_interval=bucket_interval,
            server_id=server_id,
            check_id=check_id,
        )

        return [RunsAggregatePoint(**row) for row in rows]

    async def get_latest_per_check(
        self,
        conn: asyncpg.Connection,
        server_id: int | None = None,
        check_id: int | None = None,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
    ) -> list[LatestPerCheckRow]:
        # Pass through original values — repo handles the optional constraint.
        # When both are None the query returns the absolute latest records
        # (no time bound), which satisfies the "fetch most recent available
        # record" fallback requirement.
        rows = await monitoring_repo.get_latest_per_check(
            conn,
            server_id=server_id,
            check_id=check_id,
            from_dt=from_dt,
            to_dt=to_dt,
        )
        return [
            LatestPerCheckRow(
                **{
                    **row, 
                    "status": CHECK_RUN_STATUS_MAP.get(row["status"], str(row["status"])),
                    "collected_at": row.get("collected_at") # Explicitly ensuring it's mapped
                }
            )
            for row in rows
        ]
    
    async def list_check_runs(
        self,
        conn: asyncpg.Connection,
        server_id: int | None = None,
        check_id: int | None = None,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[CheckRunResponse], int]:
        """Paginated list of historical check executions."""
        effective_from, effective_to = _resolve_time_range(from_dt, to_dt)
        rows, total = await monitoring_repo.list_check_runs(
            conn,
            server_id=server_id,
            check_id=check_id,
            from_dt=effective_from,
            to_dt=effective_to,
            limit=limit,
            offset=offset,
        )
        responses = [
            CheckRunResponse(
                **{**row, "status": CHECK_RUN_STATUS_MAP.get(row["status"], str(row["status"]))}
            )
            for row in rows
        ]
        return responses, total

    async def list_monitoring_logs(
        self,
        conn: asyncpg.Connection,
        server_id: int | None = None,
        check_id: int | None = None,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[MonitoringLogResponse], int]:
        """Paginated list of raw monitoring logs (includes JSONB results)."""
        effective_from, effective_to = _resolve_time_range(from_dt, to_dt)
        rows, total = await monitoring_repo.list_monitoring_logs(
            conn,
            server_id=server_id,
            check_id=check_id,
            from_dt=effective_from,
            to_dt=effective_to,
            limit=limit,
            offset=offset,
        )
        
        responses = []
        for row in rows:
            raw_res = row.get("raw_result")
            # Safe parsing layout constraint checking to preserve nested metrics payload elements 
            if isinstance(raw_res, list) and len(raw_res) > 0 and check_id not in [3, 4, 5]:
                raw_res = raw_res[0]

            responses.append(
                MonitoringLogResponse(
                    **{
                        **row,
                        "raw_result": raw_res,
                        "status_code": MONITORING_LOG_STATUS_MAP.get(
                            row["status_code"], str(row["status_code"])
                        ),
                    }
                )
            )
        return responses, total

    async def aggregate_metrics(
        self,
        conn: asyncpg.Connection,
        server_id: int,
        metric_name: str,
        from_dt: datetime,
        to_dt: datetime,
        bucket_interval: str,
    ) -> list[MetricAggregatePoint]:
        """Aggregate numeric metrics (CPU, Connections, Lag) for charting."""
        if bucket_interval not in VALID_BUCKET_INTERVALS:
            raise HTTPException(
                status_code=422,
                detail={"code": "unsupported_bucket_interval", "message": "Invalid interval."},
            )

        rows = await monitoring_repo.aggregate_metrics(
            conn,
            server_id=server_id,
            metric_name=metric_name,
            from_dt=_ensure_tz_aware(from_dt),
            to_dt=_ensure_tz_aware(to_dt),
            bucket_interval=bucket_interval,
        )

        return [MetricAggregatePoint(**row) for row in rows]

    async def get_table_count_history(
        self,
        conn: asyncpg.Connection,
        server_id: int,
        table_name: str,
    ) -> list[TableCountHistoryPoint]:
        rows = await monitoring_repo.get_table_count_history(conn, server_id, table_name)
        return [TableCountHistoryPoint(**row) for row in rows]