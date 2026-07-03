"""
Audit log repository — append-only audit log operations.

Functions
---------
insert_audit_log(conn, user_id, action, resource_type, resource_id, payload)
    Insert a single audit log entry.

list_audit_logs(conn, resource_type, resource_id, user_id, from_dt, to_dt, limit, offset)
    List audit log entries with optional filters and pagination.

Req 18.2, 18.3, 18.4, 18.5, 18.6
"""

from __future__ import annotations

import json
from datetime import datetime

import asyncpg


async def insert_audit_log(
    conn: asyncpg.Connection,
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: str,
    payload: dict,
) -> None:
    """
    Insert a single audit log entry.

    Req 18.2, 18.3

    Parameters
    ----------
    conn:
        An asyncpg connection.
    user_id:
        The user identifier (username at time of action).
    action:
        One of CREATE, UPDATE, DELETE, CREDENTIAL_ROTATION.
    resource_type:
        The type of resource (e.g., 'server', 'check', 'system').
    resource_id:
        The stringified primary key of the affected row.
    payload:
        A dict snapshot of changed fields (passwords must be redacted).
    """
    await conn.execute(
        """
        INSERT INTO api.audit_log (user_id, action, resource_type, resource_id, payload)
        VALUES ($1, $2, $3, $4, $5)
        """,
        user_id,
        action,
        resource_type,
        resource_id,
        json.dumps(payload),
    )


async def list_audit_logs(
    conn: asyncpg.Connection,
    resource_type: str | None = None,
    resource_id: str | None = None,
    user_id: str | None = None,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """
    List audit log entries with optional filters and pagination.

    Req 18.4, 18.5, 18.6

    Parameters
    ----------
    conn:
        An asyncpg connection.
    resource_type:
        Optional filter on resource_type.
    resource_id:
        Optional filter on resource_id.
    user_id:
        Optional filter on user_id.
    from_dt:
        Optional lower bound on changed_at (inclusive).
    to_dt:
        Optional upper bound on changed_at (inclusive).
    limit:
        Maximum number of rows to return (default 100, max 1000).
    offset:
        Number of rows to skip (default 0).

    Returns
    -------
    tuple[list[dict], int]
        A tuple of (rows, total_count) where rows is a list of dicts
        and total_count is the total number of matching rows (ignoring limit/offset).
    """
    # Build the WHERE clause dynamically
    where_clauses = []
    params = []

    if resource_type is not None:
        where_clauses.append(f"resource_type = ${len(params) + 1}")
        params.append(resource_type)

    if resource_id is not None:
        where_clauses.append(f"resource_id = ${len(params) + 1}")
        params.append(resource_id)

    if user_id is not None:
        where_clauses.append(f"user_id = ${len(params) + 1}")
        params.append(user_id)

    if from_dt is not None:
        where_clauses.append(f"changed_at >= ${len(params) + 1}")
        params.append(from_dt)

    if to_dt is not None:
        where_clauses.append(f"changed_at <= ${len(params) + 1}")
        params.append(to_dt)

    where_clause = " AND ".join(where_clauses) if where_clauses else "1=1"

    # Get total count
    count_query = f"SELECT COUNT(*) FROM api.audit_log WHERE {where_clause}"
    total_count = await conn.fetchval(count_query, *params)

    # Get paginated results, ordered by changed_at DESC (Req 18.5)
    limit_param_idx = len(params) + 1
    offset_param_idx = len(params) + 2

    query = f"""
        SELECT log_id, user_id, action, resource_type, resource_id, changed_at, payload
        FROM api.audit_log
        WHERE {where_clause}
        ORDER BY changed_at DESC
        LIMIT ${limit_param_idx} OFFSET ${offset_param_idx}
    """

    rows = await conn.fetch(query, *params, limit, offset)
    return [dict(row) for row in rows], total_count
