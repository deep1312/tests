# C:\Users\RishiShah\pg_utility\PG Utility\api\app\routers\monitoring.py

"""
Monitoring visibility router.
Standardized to /logs/ paths to match frontend expectations and eliminate 404s.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import get_settings
from app.core.dependencies import DBConn, require_role
from app.core.encryption import CredentialEncryptor
from app.services.monitoring_service import MonitoringService
from app.utils.envelope import success_response
from app.utils.pagination import PaginationParams, build_pagination_meta

logger = logging.getLogger(__name__)

# Prefix matches the frontend baseURL logic
router = APIRouter(
    prefix="/monitoring",
    tags=["monitoring"],
)

# Initialize the service
_service = MonitoringService()


def parse_frontend_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    """
    Safely handles frontend ISO strings, stripping trailing 'Z' bounds 
    and converting them to clean datetime objects for DB engine queries.
    """
    if not dt_str:
        return None
    try:
        # Standardize JavaScript ISO strings ending in 'Z' to a readable format
        clean_str = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean_str)
    except Exception as e:
        logger.warning(f"Failed parsing date string '{dt_str}': {e}")
        return None


async def _exec_on_server(
    pool_conn: asyncpg.Connection,
    server_id: int,
    query: str,
    timeout: int = 15,
) -> list[dict[str, Any]]:
    """Connect directly to the monitored server, run a query, return rows."""
    settings = get_settings()
    encryptor = CredentialEncryptor(settings.CREDENTIAL_ENCRYPTION_KEY)

    row = await pool_conn.fetchrow(
        "SELECT server_ip, port, db_name, username, password_encrypted "
        "FROM config.servers WHERE server_id = $1",
        server_id,
    )
    if not row:
        raise HTTPException(502, detail=f"Server config not found for server_id={server_id}")

    password = encryptor.decrypt(row["password_encrypted"])

    remote = await asyncpg.connect(
        host=row["server_ip"],
        port=row["port"],
        database=row["db_name"],
        user=row["username"],
        password=password,
        timeout=timeout,
    )
    try:
        results = await remote.fetch(query)
        return [dict(r) for r in results]
    finally:
        await remote.close()


# ---------------------------------------------------------------------------
# 1. KPIs & Summaries (Dashboard Overview)
# ---------------------------------------------------------------------------

@router.get("/logs/summary")
async def get_runs_summary(
    conn: DBConn,
    server_id: Optional[int] = Query(default=None),
    check_id: Optional[int] = Query(default=None),
    from_arg: Optional[str] = Query(default=None, alias="from"),
    to_arg: Optional[str] = Query(default=None, alias="to"),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """Returns aggregated KPIs and latest system health metrics."""

    summary = await _service.get_runs_summary(
        conn=conn,
        server_id=server_id,
        check_id=check_id,
        from_dt=parse_frontend_datetime(from_arg),
        to_dt=parse_frontend_datetime(to_arg),
    )

    return success_response(data=summary.model_dump())


@router.get("/logs/aggregate")
async def aggregate_check_runs(
    conn: DBConn,
    bucket_interval: str = Query(...),
    from_arg: str = Query(..., alias="from"),
    to_arg: str = Query(..., alias="to"),
    server_id: Optional[int] = Query(default=None),
    check_id: Optional[int] = Query(default=None),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """Returns time-bucketed success/failure rates for trend charts."""

    points = await _service.aggregate_check_runs(
        conn=conn,
        from_dt=parse_frontend_datetime(from_arg),
        to_dt=parse_frontend_datetime(to_arg),
        bucket_interval=bucket_interval,
        server_id=server_id,
        check_id=check_id,
    )

    return success_response(data=[p.model_dump() for p in points])


# ---------------------------------------------------------------------------
# 2. Check Health & Details (The "Deep Dive")
# ---------------------------------------------------------------------------

@router.get("/logs/latest-per-check")
async def get_latest_per_check(
    conn: DBConn,
    server_id: Optional[int] = Query(default=None),
    check_id: Optional[int] = Query(default=None),
    from_arg: Optional[str] = Query(default=None, alias="from"),
    to_arg: Optional[str] = Query(default=None, alias="to"),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """Returns the latest status for the Health Matrix view."""

    rows = await _service.get_latest_per_check(
        conn=conn,
        server_id=server_id,
        check_id=check_id,
        from_dt=parse_frontend_datetime(from_arg),
        to_dt=parse_frontend_datetime(to_arg),
    )

    return success_response(data=[r.model_dump() for r in rows])


@router.get("/logs/historical-per-check")
async def get_historical_per_check(
    conn: DBConn,
    server_id: Optional[int] = Query(default=None),
    check_id: Optional[int] = Query(default=None),
    from_arg: str = Query(..., alias="from"),
    to_arg: str = Query(..., alias="to"),
    bucket_interval: str = Query(...),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    Returns time-bucketed historical metric values for one or all checks,
    extracted from monitoring_logs.raw_result JSONB.
    When check_id is omitted, returns data for all 9 checks.
    """

    points = await _service.get_historical_per_check(
        conn=conn,
        server_id=server_id,
        check_id=check_id,
        from_dt=parse_frontend_datetime(from_arg),
        to_dt=parse_frontend_datetime(to_arg),
        bucket_interval=bucket_interval,
    )

    return success_response(data=[p.model_dump() for p in points])


@router.get("/logs/table-count-history")
async def get_table_count_history(
    conn: DBConn,
    server_id: int = Query(...),
    table_name: str = Query(...),
    _: None = Depends(require_role("viewer")),
) -> dict:
    points = await _service.get_table_count_history(
        conn=conn,
        server_id=server_id,
        table_name=table_name,
    )
    return success_response(data=[p.model_dump() for p in points])


@router.get("/check-details/{server_id}/{check_id}")
async def get_check_details(
    conn: DBConn,
    server_id: int,
    check_id: int,
    from_arg: Optional[str] = Query(default=None, alias="from"),
    to_arg: Optional[str] = Query(default=None, alias="to"),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    Returns the Deep Dive view: Trend history + Tabular raw data.
    """

    details = await _service.get_check_details(
        conn=conn,
        server_id=server_id,
        check_id=check_id,
        from_dt=parse_frontend_datetime(from_arg),
        to_dt=parse_frontend_datetime(to_arg),
    )

    return success_response(data=details)


# ---------------------------------------------------------------------------
# 3. Metrics & Logs
# ---------------------------------------------------------------------------

@router.get("/servers/{server_id}/latest-metrics")
async def get_latest_server_metrics(
    conn: DBConn,
    server_id: int,
    _: None = Depends(require_role("viewer")),
) -> dict:
    """Provides the latest status metrics for a specific server."""

    metrics = await _service.get_latest_per_check(
        conn=conn,
        server_id=server_id,
    )

    return success_response(data=[m.model_dump() for m in metrics])


@router.get("/logs")
async def list_monitoring_logs(
    conn: DBConn,
    pagination: PaginationParams = Depends(),
    server_id: Optional[int] = Query(default=None),
    check_id: Optional[int] = Query(default=None),
    from_arg: Optional[str] = Query(default=None, alias="from"),
    to_arg: Optional[str] = Query(default=None, alias="to"),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """Paginated list of raw monitoring log entries."""

    logs, total = await _service.list_monitoring_logs(
        conn=conn,
        server_id=server_id,
        check_id=check_id,
        from_dt=parse_frontend_datetime(from_arg),
        to_dt=parse_frontend_datetime(to_arg),
        limit=pagination.limit,
        offset=pagination.offset,
    )

    return success_response(
        data=[r.model_dump() for r in logs],
        pagination=build_pagination_meta(
            total,
            pagination.limit,
            pagination.offset,
        ),
    )


@router.get("/metrics/aggregate")
async def aggregate_metrics(
    conn: DBConn,
    server_id: int,
    metric_name: str,
    bucket_interval: str,
    from_arg: str = Query(..., alias="from"),
    to_arg: str = Query(..., alias="to"),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """Aggregates numeric values for time-series charts."""

    points = await _service.aggregate_metrics(
        conn=conn,
        server_id=server_id,
        metric_name=metric_name,
        from_dt=parse_frontend_datetime(from_arg),
        to_dt=parse_frontend_datetime(to_arg),
        bucket_interval=bucket_interval,
    )

    return success_response(data=[p.model_dump() for p in points])


# ---------------------------------------------------------------------------
# 4. Live Partition Count (no persistence)
# ---------------------------------------------------------------------------


@router.get("/partition-count/{server_id}")
async def get_partition_count(
    conn: DBConn,
    server_id: int,
    _: None = Depends(require_role("viewer")),
) -> dict:
    """Live query: run getrawdatatablestatus() directly on the monitored server."""

    rows = await _exec_on_server(
        conn,
        server_id,
        "SELECT * FROM getrawdatatablestatus();",
    )

    return success_response(data={
        "row_count": len(rows),
        "rows": rows,
    })