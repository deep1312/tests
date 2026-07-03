"""
Alert repository — SQL access to alerts.alerts table.

Functions
---------
list_alerts(conn, server_id, check_id, status, ack_state, from_dt, to_dt, limit, offset)
    Paginated list of alerts with partition-pruning WHERE on triggered_at.
    Defaults to last 24h when no time range supplied (Req 7.7, 13.4).

acknowledge_alert(conn, alert_id, triggered_at)
    UPDATE acknowledged_at = now() WHERE composite PK matches AND acknowledged_at IS NULL.
    Returns None if not found (→ HTTP 404), raises HTTP 409 if already acknowledged (Req 7.8, 7.9).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import asyncpg
from fastapi import HTTPException


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now_utc() -> datetime:
    """Return the current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


def _default_from(to_dt: datetime) -> datetime:
    """Return 24 hours before *to_dt* as the default lower bound."""
    return to_dt - timedelta(hours=24)


# ---------------------------------------------------------------------------
# 26.1 — list_alerts
# ---------------------------------------------------------------------------


async def list_alerts(
    conn: asyncpg.Connection,
    server_id: int | None = None,
    check_id: int | None = None,
    status: int | None = None,
    ack_state: str | None = None,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """
    Return a paginated list of alerts with optional filters.

    Always includes ``triggered_at`` in the WHERE clause for partition pruning
    (Req 13.4).  Defaults to the last 24 hours when no time range is supplied
    (Req 7.7).  Ordered by ``triggered_at DESC`` (Req 7.6).

    Parameters
    ----------
    conn:
        An asyncpg connection.
    server_id:
        Optional filter on ``server_id``.
    check_id:
        Optional filter on ``check_id``.
    status:
        Optional filter on ``status`` integer (1=WARNING, 2=CRITICAL).
    ack_state:
        Optional acknowledgement filter: ``"unacknowledged"``, ``"acknowledged"``,
        or ``None`` (all).
    from_dt:
        Lower bound for ``triggered_at`` (inclusive).  Defaults to 24 h ago.
    to_dt:
        Upper bound for ``triggered_at`` (inclusive).  Defaults to now.
    limit:
        Maximum number of rows to return (Req 7.5).
    offset:
        Number of rows to skip (Req 7.5).

    Returns
    -------
    tuple[list[dict], int]
        A 2-tuple of (rows, total_count).
    """
    effective_to = to_dt or _now_utc()
    effective_from = from_dt or _default_from(effective_to)

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    # Partition-pruning time range — always present (Req 13.4)
    conditions.append(f"triggered_at >= ${param_idx}")
    params.append(effective_from)
    param_idx += 1

    conditions.append(f"triggered_at <= ${param_idx}")
    params.append(effective_to)
    param_idx += 1

    if server_id is not None:
        conditions.append(f"server_id = ${param_idx}")
        params.append(server_id)
        param_idx += 1

    if check_id is not None:
        conditions.append(f"check_id = ${param_idx}")
        params.append(check_id)
        param_idx += 1

    if status is not None:
        conditions.append(f"status = ${param_idx}")
        params.append(status)
        param_idx += 1

    # Acknowledgement state filter (Req 7.4)
    if ack_state == "unacknowledged":
        conditions.append("acknowledged_at IS NULL")
    elif ack_state == "acknowledged":
        conditions.append("acknowledged_at IS NOT NULL")
    # None → no filter (all)

    where_clause = "WHERE " + " AND ".join(conditions)

    params.append(limit)
    limit_param = f"${param_idx}"
    param_idx += 1

    params.append(offset)
    offset_param = f"${param_idx}"

    query = f"""
        SELECT
            alert_id,
            triggered_at,
            incident_id,
            server_id,
            check_id,
            metric_name,
            observed_value,
            status,
            acknowledged_at,
            COUNT(*) OVER() AS total_count
        FROM alerts.alerts
        {where_clause}
        ORDER BY triggered_at DESC
        LIMIT {limit_param} OFFSET {offset_param}
    """

    rows = await conn.fetch(query, *params)

    if not rows:
        return [], 0

    total_count = rows[0]["total_count"]
    result = []
    for row in rows:
        d = dict(row)
        d.pop("total_count", None)
        result.append(d)

    return result, total_count


# ---------------------------------------------------------------------------
# 26.1 — acknowledge_alert
# ---------------------------------------------------------------------------


async def acknowledge_alert(
    conn: asyncpg.Connection,
    alert_id: int,
    triggered_at: datetime,
) -> dict | None:
    """
    Acknowledge an alert by setting ``acknowledged_at = now()``.

    Uses the composite primary key ``(alert_id, triggered_at)`` to locate the
    exact partition and row (Req 7.8).

    Parameters
    ----------
    conn:
        An asyncpg connection.
    alert_id:
        The alert's integer ID.
    triggered_at:
        The alert's trigger timestamp (partition key).

    Returns
    -------
    dict | None
        The updated row as a dict, or ``None`` if no matching row was found.

    Raises
    ------
    HTTPException(409)
        ``already_acknowledged`` — the alert exists but is already acknowledged
        (Req 7.9).
    HTTPException(404)
        ``not_found`` — no alert with the given composite PK exists (Req 7.9).
    """
    # First check if the row exists at all (regardless of ack state)
    check_query = """
        SELECT alert_id, triggered_at, acknowledged_at
        FROM alerts.alerts
        WHERE alert_id = $1 AND triggered_at = $2
    """
    existing = await conn.fetchrow(check_query, alert_id, triggered_at)

    if existing is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "not_found",
                "message": f"Alert {alert_id} with triggered_at {triggered_at.isoformat()} not found.",
            },
        )

    if existing["acknowledged_at"] is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "already_acknowledged",
                "message": f"Alert {alert_id} has already been acknowledged.",
            },
        )

    # Perform the update
    update_query = """
        UPDATE alerts.alerts
        SET acknowledged_at = now()
        WHERE alert_id = $1 AND triggered_at = $2 AND acknowledged_at IS NULL
        RETURNING
            alert_id,
            triggered_at,
            incident_id,
            server_id,
            check_id,
            metric_name,
            observed_value,
            status,
            acknowledged_at
    """
    row = await conn.fetchrow(update_query, alert_id, triggered_at)

    if row is None:
        # Race condition: another request acknowledged it between our check and update
        raise HTTPException(
            status_code=409,
            detail={
                "code": "already_acknowledged",
                "message": f"Alert {alert_id} has already been acknowledged.",
            },
        )

    return dict(row)
