"""
Incident repository — SQL access to alerts.incidents and alerts.alerts tables.

Functions
---------
list_incidents(conn, server_id, check_id, status, limit, offset)
    Paginated list of incidents ordered by started_at DESC (Req 8.1, 8.6).

get_incident(conn, incident_id)
    Fetch a single incident by ID.

get_incident_alerts(conn, incident_id)
    Fetch all alerts associated with an incident, ordered by triggered_at ASC (Req 8.4).

patch_root_cause(conn, incident_id, root_cause)
    Update the root_cause field of an incident (Req 8.10).
"""

from __future__ import annotations

from typing import Any

import asyncpg


# ---------------------------------------------------------------------------
# 28.1 — list_incidents
# ---------------------------------------------------------------------------


async def list_incidents(
    conn: asyncpg.Connection,
    server_id: int | None = None,
    check_id: int | None = None,
    status: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """
    Return a paginated list of incidents with optional filters.

    Ordered by ``started_at DESC`` (Req 8.6).

    Parameters
    ----------
    conn:
        An asyncpg connection.
    server_id:
        Optional filter on ``server_id``.
    check_id:
        Optional filter on ``check_id``.
    status:
        Optional filter on ``status`` integer (1=OPEN, 2=RESOLVED).
    limit:
        Maximum number of rows to return (Req 8.5).
    offset:
        Number of rows to skip (Req 8.5).

    Returns
    -------
    tuple[list[dict], int]
        A 2-tuple of (rows, total_count).
    """
    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

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

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    params.append(limit)
    limit_param = f"${param_idx}"
    param_idx += 1

    params.append(offset)
    offset_param = f"${param_idx}"

    query = f"""
        SELECT
            incident_id,
            server_id,
            check_id,
            status,
            started_at,
            ended_at,
            root_cause,
            COUNT(*) OVER() AS total_count
        FROM alerts.incidents
        {where_clause}
        ORDER BY started_at DESC
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
# 28.1 — get_incident
# ---------------------------------------------------------------------------


async def get_incident(
    conn: asyncpg.Connection,
    incident_id: int,
) -> dict | None:
    """
    Fetch a single incident by its ID.

    Parameters
    ----------
    conn:
        An asyncpg connection.
    incident_id:
        The incident's integer ID.

    Returns
    -------
    dict | None
        The incident row as a dict, or ``None`` if not found.
    """
    query = """
        SELECT
            incident_id,
            server_id,
            check_id,
            status,
            started_at,
            ended_at,
            root_cause
        FROM alerts.incidents
        WHERE incident_id = $1
    """
    row = await conn.fetchrow(query, incident_id)
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# 28.1 — get_incident_alerts
# ---------------------------------------------------------------------------


async def get_incident_alerts(
    conn: asyncpg.Connection,
    incident_id: int,
) -> list[dict]:
    """
    Fetch all alerts associated with an incident, ordered by triggered_at ASC.

    Req 8.4 — detail endpoint includes associated alerts ordered by triggered_at ASC.

    Parameters
    ----------
    conn:
        An asyncpg connection.
    incident_id:
        The incident's integer ID.

    Returns
    -------
    list[dict]
        List of alert rows as dicts, ordered by ``triggered_at ASC``.
    """
    query = """
        SELECT
            alert_id,
            triggered_at,
            incident_id,
            server_id,
            check_id,
            metric_name,
            observed_value,
            status,
            acknowledged_at
        FROM alerts.alerts
        WHERE incident_id = $1
        ORDER BY triggered_at ASC
    """
    rows = await conn.fetch(query, incident_id)
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# 28.1 — patch_root_cause
# ---------------------------------------------------------------------------


async def patch_root_cause(
    conn: asyncpg.Connection,
    incident_id: int,
    root_cause: str,
) -> dict | None:
    """
    Update the ``root_cause`` field of an incident.

    ``root_cause`` is the only Incident field writable by the API (Req 8.10).

    Parameters
    ----------
    conn:
        An asyncpg connection.
    incident_id:
        The incident's integer ID.
    root_cause:
        The new root cause text.

    Returns
    -------
    dict | None
        The updated incident row as a dict, or ``None`` if not found.
    """
    query = """
        UPDATE alerts.incidents
        SET root_cause = $1
        WHERE incident_id = $2
        RETURNING
            incident_id,
            server_id,
            check_id,
            status,
            started_at,
            ended_at,
            root_cause
    """
    row = await conn.fetchrow(query, root_cause, incident_id)
    return dict(row) if row else None
