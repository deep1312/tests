"""
Server repository — raw SQL access to ``config.servers``.

Functions
---------
list_servers(conn, env_type, is_active, limit, offset) -> tuple[list, int]
    Paginated list of servers with optional filters.

get_server(conn, server_id) -> dict | None
    Fetch a single server by primary key.

create_server(conn, data) -> dict
    Insert a new server row and return all fields.

update_server(conn, server_id, data, version) -> dict | None
    Partial update with optional optimistic locking.

deactivate_server(conn, server_id) -> dict | None
    Soft-delete: set is_active = false.

delete_server(conn, server_id) -> bool
    Hard DELETE; returns True if a row was removed.

has_monitoring_data(conn, server_id) -> bool
    Returns True if any monitoring/alert rows exist for the server.
"""

from __future__ import annotations

import json
from typing import Any

import asyncpg

# All non-sensitive columns returned by read operations.
_SERVER_COLUMNS = """
    server_id,
    server_label,
    server_ip,
    port,
    db_name,
    username,
    server_role,
    env_type,
    ssl_mode,
    retention_metrics_days,
    retention_logs_days,
    retention_runs_days,
    compression_days,
    tags,
    is_active,
    is_di_server,
    last_heartbeat,
    created_at,
    updated_at,
    version
"""

# Columns that callers are allowed to set via create/update.
_MUTABLE_COLUMNS = {
    "server_label",
    "server_ip",
    "port",
    "db_name",
    "username",
    "password_encrypted",
    "server_role",
    "env_type",
    "ssl_mode",
    "retention_metrics_days",
    "retention_logs_days",
    "retention_runs_days",
    "compression_days",
    "tags",
    "is_active",
    "is_di_server",
    "last_heartbeat",
}


def _parse_tags(d: dict) -> dict:
    """Parse tags JSONB field from string to dict if needed."""
    if isinstance(d.get("tags"), str):
        try:
            d["tags"] = json.loads(d["tags"])
        except (ValueError, TypeError):
            d["tags"] = None
    return d


def _row_to_dict_from_dict(d: dict) -> dict:
    """Parse JSONB fields in an already-converted dict."""
    return _parse_tags(d)


def _row_to_dict(row: asyncpg.Record) -> dict:
    """Convert an asyncpg Record to a plain dict, parsing JSONB fields."""
    return _parse_tags(dict(row))


async def list_servers(
    conn: asyncpg.Connection,
    env_type: str | None = None,
    is_active: bool | None = None,
    is_di_server: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """
    Return a paginated list of servers with an optional filter on ``env_type``
    and/or ``is_active``.

    Uses a ``COUNT(*) OVER()`` window function so that both the result slice
    and the total count are obtained in a single query.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    env_type:
        When provided, only servers with this ``env_type`` value are returned.
    is_active:
        When provided, only servers matching this ``is_active`` flag are returned.
    limit:
        Maximum number of rows to return (Req 1.9).
    offset:
        Number of rows to skip before returning results (Req 1.9).

    Returns
    -------
    tuple[list[dict], int]
        A 2-tuple of (rows, total_count).  ``total_count`` reflects the number
        of rows that match the filters *before* pagination is applied.
    """
    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if env_type is not None:
        conditions.append(f"env_type = ${param_idx}")
        params.append(env_type)
        param_idx += 1

    if is_active is not None:
        conditions.append(f"is_active = ${param_idx}")
        params.append(is_active)
        param_idx += 1

    if is_di_server is not None:
        conditions.append(f"is_di_server = ${param_idx}")
        params.append(is_di_server)
        param_idx += 1

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # LIMIT / OFFSET params
    params.append(limit)
    limit_param = f"${param_idx}"
    param_idx += 1

    params.append(offset)
    offset_param = f"${param_idx}"

    query = f"""
        SELECT
            {_SERVER_COLUMNS},
            COUNT(*) OVER() AS total_count
        FROM config.servers
        {where_clause}
        ORDER BY server_id ASC
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
        result.append(_row_to_dict_from_dict(d))

    return result, total_count


async def get_server(
    conn: asyncpg.Connection,
    server_id: int,
) -> dict | None:
    """
    Return the server with the given ``server_id``, or ``None`` if not found.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    server_id:
        Primary key of the server to fetch.

    Returns
    -------
    dict | None
        All non-sensitive columns, or ``None`` if no row exists.
    """
    row = await conn.fetchrow(
        f"""
        SELECT {_SERVER_COLUMNS}
        FROM config.servers
        WHERE server_id = $1
        """,
        server_id,
    )
    return _row_to_dict(row) if row is not None else None

# ... (imports and constants remain the same)

async def create_server(
    conn: asyncpg.Connection,
    data: dict,
) -> dict:
    """
    Insert a new row into ``config.servers`` and return all non-sensitive fields.
    """
    columns = []
    values = []
    for col in _MUTABLE_COLUMNS:
        if col in data and data[col] is not None:
            val = data[col]
            
            # FIX: If the column is 'tags' and the value is a dict, stringify it
            if col == "tags" and isinstance(val, dict):
                val = json.dumps(val)
                
            columns.append(col)
            values.append(val)

    if not columns:
        raise ValueError("No valid columns provided for server creation.")

    col_list = ", ".join(columns)
    placeholder_list = ", ".join(f"${i + 1}" for i in range(len(values)))

    row = await conn.fetchrow(
        f"""
        INSERT INTO config.servers ({col_list})
        VALUES ({placeholder_list})
        RETURNING {_SERVER_COLUMNS}
        """,
        *values,
    )
    return _row_to_dict(row)


async def update_server(
    conn: asyncpg.Connection,
    server_id: int,
    data: dict,
    version: int | None = None,
) -> dict | None:
    """
    Partially update a server row.
    """
    set_clauses: list[str] = []
    params: list[Any] = []
    param_idx = 1

    for col in _MUTABLE_COLUMNS:
        if col in data and data[col] is not None:
            val = data[col]
            
            # FIX: If the column is 'tags' and the value is a dict, stringify it
            if col == "tags" and isinstance(val, dict):
                val = json.dumps(val)
                
            set_clauses.append(f"{col} = ${param_idx}")
            params.append(val)
            param_idx += 1

    # Always bump version and updated_at
    set_clauses.append(f"version = version + 1")
    set_clauses.append(f"updated_at = now()")

    if not set_clauses:
        return await get_server(conn, server_id)

    set_sql = ", ".join(set_clauses)

    params.append(server_id)
    where_sql = f"server_id = ${param_idx}"
    param_idx += 1

    if version is not None:
        params.append(version)
        where_sql += f" AND version = ${param_idx}"

    row = await conn.fetchrow(
        f"""
        UPDATE config.servers
        SET {set_sql}
        WHERE {where_sql}
        RETURNING {_SERVER_COLUMNS}
        """,
        *params,
    )
    return _row_to_dict(row) if row is not None else None

# ... (rest of the file remains the same)

async def deactivate_server(
    conn: asyncpg.Connection,
    server_id: int,
) -> dict | None:
    """
    Soft-delete a server by setting ``is_active = false`` (Req 1.10).

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    server_id:
        Primary key of the server to deactivate.

    Returns
    -------
    dict | None
        The updated row, or ``None`` if the server was not found.
    """
    row = await conn.fetchrow(
        f"""
        UPDATE config.servers
        SET is_active = false,
            updated_at = now()
        WHERE server_id = $1
        RETURNING {_SERVER_COLUMNS}
        """,
        server_id,
    )
    return _row_to_dict(row) if row is not None else None


async def activate_server(
    conn: asyncpg.Connection,
    server_id: int,
) -> dict | None:
    """
    Reactivate a server by setting ``is_active = true``.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    server_id:
        Primary key of the server to activate.

    Returns
    -------
    dict | None
        The updated row, or ``None`` if the server was not found.
    """
    row = await conn.fetchrow(
        f"""
        UPDATE config.servers
        SET is_active = true,
            updated_at = now()
        WHERE server_id = $1
        RETURNING {_SERVER_COLUMNS}
        """,
        server_id,
    )
    return _row_to_dict(row) if row is not None else None


async def delete_server(
    conn: asyncpg.Connection,
    server_id: int,
) -> bool:
    """
    Hard-delete a server row from ``config.servers`` (Req 1.12).

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    server_id:
        Primary key of the server to delete.

    Returns
    -------
    bool
        ``True`` if a row was deleted, ``False`` if no row with that
        ``server_id`` existed.
    """
    result = await conn.execute(
        "DELETE FROM config.servers WHERE server_id = $1",
        server_id,
    )
    # asyncpg returns a string like "DELETE 1" or "DELETE 0"
    return result.endswith("1")


async def has_monitoring_data(
    conn: asyncpg.Connection,
    server_id: int,
) -> bool:
    """
    Return ``True`` if any monitoring or alert rows exist for the given server.

    Checks the following tables using EXISTS subqueries for efficiency:
      - ``monitoring.check_runs``
      - ``monitoring.monitoring_logs``
      - ``monitoring.monitoring_metrics``
      - ``alerts.alerts``
      - ``alerts.incidents``

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    server_id:
        Primary key of the server to check.

    Returns
    -------
    bool
        ``True`` if at least one row referencing this server exists in any of
        the monitored tables; ``False`` otherwise.
    """
    row = await conn.fetchrow(
        """
        SELECT (
            EXISTS (SELECT 1 FROM monitoring.check_runs      WHERE server_id = $1)
            OR
            EXISTS (SELECT 1 FROM monitoring.monitoring_logs  WHERE server_id = $1)
            OR
            EXISTS (SELECT 1 FROM monitoring.monitoring_metrics WHERE server_id = $1)
            OR
            EXISTS (SELECT 1 FROM alerts.alerts               WHERE server_id = $1)
            OR
            EXISTS (SELECT 1 FROM alerts.incidents            WHERE server_id = $1)
        ) AS has_data
        """,
        server_id,
    )
    return bool(row["has_data"])
