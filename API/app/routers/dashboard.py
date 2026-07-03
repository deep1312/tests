"""
Dashboard router.

Endpoints
---------
GET /dashboard/summary                    — viewer+; aggregated health overview (Req 9.1)
GET /dashboard/servers/{server_id}/health — viewer+; per-server last N check runs (Req 9.3)
GET /dashboard/metrics/chart              — viewer+; time-bucketed metric aggregates (Req 9.4)
GET /dashboard/sources                    — viewer+; monitoring DI source summary (Req 10.1)
GET /dashboard/sources/{di_name}          — viewer+; monitoring DI source details (Req 10.2)

All endpoints return the standard envelope format.
Empty result sets return HTTP 200 with "data": [] or "data": {...}.

Req 9.x  — fleet health dashboard endpoints
Req 10.x — DI source monitoring dashboard endpoints
"""

from __future__ import annotations

from datetime import datetime
from urllib.parse import unquote

import json

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.config import get_settings
from app.core.dependencies import DBConn, require_role
from app.core.encryption import CredentialEncryptor
from app.services.dashboard_service import VALID_BUCKET_INTERVALS, DashboardService
from app.utils.envelope import success_response

async def _call_on_remote(
    pool_conn: asyncpg.Connection,
    server_id: int,
    fn,
) -> object:
    """Acquire a temporary connection to the server identified by *server_id*
    and run *fn(remote_conn)*.

    Looks up the server credentials from ``config.servers`` using *pool_conn*,
    decrypts the stored password, opens a short-lived ``asyncpg`` connection,
    invokes the callback, and closes the connection (no result persistence).
    """
    settings = get_settings()
    encryptor = CredentialEncryptor(settings.CREDENTIAL_ENCRYPTION_KEY)

    row = await pool_conn.fetchrow(
        "SELECT server_label, server_ip, port, db_name, username, password_encrypted "
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
        timeout=10,
    )
    try:
        return await fn(remote)
    finally:
        await remote.close()


async def _fetch_speed_sources_for_server(
    pool_conn: asyncpg.Connection,
    server_id: int,
) -> list[dict]:
    """Fetch DI sources for a single server.

    Tries ``monitoring_dashboard.speed_monitoring_summary()`` first
    (returns di_name, latest_pulltimestamp, frequency, status).
    Falls back to ``monitoring_dashboard.monitoring_summary()``
    (returns o_di_name, o_latest_pulltimestamp, o_frequency, o_status)."""
    label_row = await pool_conn.fetchrow(
        "SELECT server_label FROM config.servers WHERE server_id = $1",
        server_id,
    )
    server_label = label_row["server_label"] if label_row else f"Server {server_id}"

    def _normalize_row(r: asyncpg.Record) -> dict:
        d = dict(r)
        return {
            "di_name": d.get("di_name") or d.get("o_di_name") or "",
            "latest_pulltimestamp": d.get("latest_pulltimestamp") or d.get("o_latest_pulltimestamp"),
            "frequency": d.get("frequency") or d.get("o_frequency") or "",
            "status": d.get("status") or d.get("o_status") or "",
        }

    async def _query_speed(remote: asyncpg.Connection) -> list[dict]:
        rows = await remote.fetch(
            "SELECT * FROM monitoring_dashboard.speed_monitoring_summary()"
        )
        return [_normalize_row(r) for r in rows]

    async def _query_standard(remote: asyncpg.Connection) -> list[dict]:
        rows = await remote.fetch(
            "SELECT * FROM monitoring_dashboard.monitoring_summary()"
        )
        return [_normalize_row(r) for r in rows]

    try:
        raw_rows = await _call_on_remote(pool_conn, server_id, _query_speed)
        if not raw_rows:
            raise ValueError("empty")
    except Exception:
        try:
            raw_rows = await _call_on_remote(pool_conn, server_id, _query_standard)
        except Exception:
            raw_rows = []

    return [
        {**row, "server_id": server_id, "server_label": server_label}
        for row in raw_rows
    ]


async def _fetch_sources_for_server(
    pool_conn: asyncpg.Connection,
    server_id: int,
) -> list[dict]:
    """Fetch monitoring sources for a single server, decorated with server metadata."""
    async def _query(remote: asyncpg.Connection) -> list[dict]:
        rows = await remote.fetch(
            "SELECT o_di_name, o_latest_pulltimestamp, o_frequency, o_status "
            "FROM monitoring_dashboard.monitoring_summary()"
        )
        # Need server_label — fetch it from pool_conn before the asyncpg.connect
        return rows

    # Grab server_label before connecting remotely
    label_row = await pool_conn.fetchrow(
        "SELECT server_label FROM config.servers WHERE server_id = $1",
        server_id,
    )
    server_label = label_row["server_label"] if label_row else f"Server {server_id}"

    raw_rows = await _call_on_remote(pool_conn, server_id, _query)
    return [
        {
            "di_name": row["o_di_name"],
            "latest_pulltimestamp": row["o_latest_pulltimestamp"],
            "frequency": row["o_frequency"],
            "status": row["o_status"],
            "server_id": server_id,
            "server_label": server_label,
        }
        for row in raw_rows
    ]

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_service = DashboardService()


# ---------------------------------------------------------------------------
# GET /dashboard/summary
# ---------------------------------------------------------------------------


@router.get("/summary")
async def get_dashboard_summary(
    request: Request,
    conn: DBConn,
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    Return the aggregated health overview for all active servers.

    Includes per-server counts of open incidents, unacknowledged alerts,
    latest run status, health trend, collector state, and retention windows.
    Also includes the top 5 failing checks across all servers in the last 24h.

    Req 9.1  — all required fields per server.
    Req 9.2  — computed in a single CTE query.
    Req 9.6  — sort order: incidents first, then unack alerts, then healthy.
    Req 9.7  — top_failing_checks included.
    Req 9.8  — health_trend per server.
    Req 9.9  — retention fields per server.
    Req 9.10 — collector_state per server.
    Req 9.11 — STALE servers sorted within their severity tier.
    """
    summary = await _service.get_summary(conn=conn)

    return success_response(
        data=summary.model_dump(),
    )


# ---------------------------------------------------------------------------
# GET /dashboard/servers/{server_id}/health
# ---------------------------------------------------------------------------


@router.get("/servers/{server_id}/health")
async def get_server_health(
    request: Request,
    server_id: int,
    conn: DBConn,
    n: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Number of most recent check runs per check to return.",
    ),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    Return the most recent check run per check for a given server.

    Shows the latest status and execution time for each check assigned
    to the server, limited to the last N runs per check.

    Req 9.3 — per-server last N check runs grouped by check.
    """
    health = await _service.get_server_health(
        conn=conn,
        server_id=server_id,
        n=n,
    )

    return success_response(
        data=[h.model_dump() for h in health],
        filters={"server_id": server_id, "n": n},
    )


# ---------------------------------------------------------------------------
# GET /dashboard/metrics/chart
# ---------------------------------------------------------------------------


@router.get("/metrics/chart")
async def get_metrics_chart(
    request: Request,
    conn: DBConn,
    server_id: int = Query(..., description="Server ID (required)."),
    metric_name: str = Query(..., description="Metric name (required)."),
    bucket_interval: str = Query(
        ...,
        description=(
            f"Time bucket size. Supported: {sorted(VALID_BUCKET_INTERVALS)}."
        ),
    ),
    from_dt: datetime = Query(
        ...,
        alias="from",
        description="Lower bound for collected_at (ISO 8601, required).",
    ),
    to_dt: datetime = Query(
        ...,
        alias="to",
        description="Upper bound for collected_at (ISO 8601, required).",
    ),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    Return time-bucketed metric aggregates for line chart rendering.

    Validates ``bucket_interval`` and returns HTTP 422 with supported values
    if the supplied interval is not recognised.

    Req 9.4 — time-bucketed aggregates for chart rendering.
    Req 9.5 — unsupported_bucket_interval validation.
    """
    points = await _service.get_metrics_chart(
        conn=conn,
        server_id=server_id,
        metric_name=metric_name,
        bucket_interval=bucket_interval,
        from_dt=from_dt,
        to_dt=to_dt,
    )

    return success_response(
        data=[p.model_dump() for p in points],
        filters={
            "server_id": server_id,
            "metric_name": metric_name,
            "bucket_interval": bucket_interval,
            "from": from_dt.isoformat(),
            "to": to_dt.isoformat(),
        },
    )


# ---------------------------------------------------------------------------
# GET /dashboard/sources — DI source monitoring summary
# ---------------------------------------------------------------------------


@router.get("/sources")
async def get_monitoring_sources(
    request: Request,
    conn: DBConn,
    server_ids: str = Query(
        default="16",
        description="Comma-separated list of server IDs to query (default: 16).",
    ),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    Return the list of all DI sources with latest pull timestamp and frequency.

    Connects live to each remote server (default STG-219 ID 16) and calls
    ``monitoring_dashboard.monitoring_summary()`` — results are never persisted.

    Each result includes ``server_id`` and ``server_label`` identifying the source.
    """
    ids = [int(x.strip()) for x in server_ids.split(",") if x.strip()]
    if not ids:
        return success_response(data=[])

    all_sources: list[dict] = []
    for sid in ids:
        try:
            sources = await _fetch_sources_for_server(conn, sid)
            all_sources.extend(sources)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                502,
                detail=f"Failed to fetch sources from server_id={sid}: {exc}",
            )

    return success_response(data=all_sources)


# ---------------------------------------------------------------------------
# GET /dashboard/sources/{di_name} — DI source details
# ---------------------------------------------------------------------------


@router.get("/sources/{di_name:path}")
async def get_monitoring_source_details(
    request: Request,
    di_name: str,
    conn: DBConn,
    server_id: int = Query(
        default=16,
        description="Server ID to fetch details from (default: 16).",
    ),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    Return detailed records for a specific DI source.

    Connects live to the remote server (default STG-219 ID 16) and calls
    ``monitoring_dashboard.monitoring_details(di_name)`` — results never persisted.

    Returns an array of JSONB records from the source-specific detail query.
    """
    decoded_name = unquote(di_name)

    async def _query(remote: asyncpg.Connection) -> list[dict]:
        rows = await remote.fetch(
            "SELECT monitoring_dashboard.monitoring_details($1) AS record",
            decoded_name,
        )
        return [json.loads(row["record"]) if isinstance(row["record"], str) else row["record"] for row in rows]

    records = await _call_on_remote(conn, server_id, _query)
    return success_response(
        data=records,
        filters={"di_name": decoded_name, "server_id": server_id},
    )


# ---------------------------------------------------------------------------
# GET /dashboard/speed-sources — Speed monitoring summary
# ---------------------------------------------------------------------------


@router.get("/speed-sources")
async def get_speed_monitoring_sources(
    request: Request,
    conn: DBConn,
    server_ids: str = Query(
        default="16",
        description="Comma-separated list of server IDs to query (default: 16).",
    ),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    Return speed monitoring DI sources summary.

    Connects live to each remote server and calls
    ``monitoring_dashboard.speed_monitoring_summary()``.
    """
    ids = [int(x.strip()) for x in server_ids.split(",") if x.strip()]
    if not ids:
        return success_response(data=[])

    all_sources: list[dict] = []
    for sid in ids:
        try:
            sources = await _fetch_speed_sources_for_server(conn, sid)
            all_sources.extend(sources)
        except HTTPException:
            raise
        except Exception:
            continue

    return success_response(data=all_sources)


# ---------------------------------------------------------------------------
# GET /dashboard/speed-sources/{di_name} — Speed source details
# ---------------------------------------------------------------------------


@router.get("/speed-sources/{di_name:path}")
async def get_speed_monitoring_source_details(
    request: Request,
    di_name: str,
    conn: DBConn,
    server_id: int = Query(
        default=16,
        description="Server ID to fetch details from (default: 16).",
    ),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    Return detailed records for a specific speed DI source.

    Connects live to the remote server and calls
    ``monitoring_dashboard.speed_source_details(p_di_name)``.
    """
    decoded_name = unquote(di_name)

    def _maybe_unwrap(d: dict) -> dict:
        if len(d) == 1:
            val = next(iter(d.values()))
            if isinstance(val, (str, bytes)):
                try:
                    parsed = json.loads(val)
                    if isinstance(parsed, dict):
                        return parsed
                except (json.JSONDecodeError, TypeError):
                    pass
        return d

    async def _query_speed(remote: asyncpg.Connection) -> list[dict]:
        rows = await remote.fetch(
            "SELECT * FROM monitoring_dashboard.speed_source_details($1)",
            decoded_name,
        )
        return [_maybe_unwrap(dict(r)) for r in rows]

    async def _query_standard(remote: asyncpg.Connection) -> list[dict]:
        rows = await remote.fetch(
            "SELECT * FROM monitoring_dashboard.monitoring_details($1)",
            decoded_name,
        )
        return [_maybe_unwrap(dict(r)) for r in rows]

    try:
        records = await _call_on_remote(conn, server_id, _query_speed)
        if not records:
            raise ValueError("empty")
    except Exception:
        try:
            records = await _call_on_remote(conn, server_id, _query_standard)
        except Exception:
            records = []
    return success_response(
        data=records,
        filters={"di_name": decoded_name, "server_id": server_id},
    )
