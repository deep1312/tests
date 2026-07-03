"""
Check repository — raw SQL access to ``config.checks_master`` and
``config.server_checks_mapping``.

Functions
---------
list_checks(conn, category, is_active, limit, offset) -> tuple[list, int]
    Paginated list of checks with optional filters.

get_check(conn, check_id) -> dict | None
    Fetch a single check by primary key.

create_check(conn, data) -> dict
    Insert a new check row and return all fields.

update_check(conn, check_id, data, version) -> dict | None
    Partial update with optional optimistic locking.

delete_check(conn, check_id) -> bool
    Hard DELETE; returns True if a row was removed.

list_mappings(conn, server_id, is_enabled, limit, offset) -> tuple[list, int]
    Paginated list of mappings with optional filters.

get_mapping(conn, mapping_id) -> dict | None
    Fetch a single mapping by primary key.

create_mapping(conn, data) -> dict
    Insert a new mapping row and return all fields.

update_mapping(conn, mapping_id, data) -> dict | None
    Partial update of a mapping row.

delete_mapping(conn, mapping_id) -> bool
    Hard DELETE; returns True if a row was removed.

get_check_health_summary(conn, server_id, n) -> list[dict]
    Window-function CTE query returning health stats per (server_id, check_id).

has_monitoring_data_for_check(conn, check_id) -> bool
    Returns True if any monitoring rows exist for the check (Req 2.13).
"""

from __future__ import annotations

from typing import Any

import asyncpg

# ---------------------------------------------------------------------------
# Column lists
# ---------------------------------------------------------------------------

_CHECK_COLUMNS = """
    check_id,
    check_code,
    category,
    check_name,
    query_text,
    timeout_ms,
    default_frequency_sec,
    is_active,
    created_at,
    updated_at,
    version
"""

_MAPPING_COLUMNS = """
    mapping_id,
    server_id,
    check_id,
    custom_frequency_sec,
    is_enabled,
    consecutive_failures,
    backoff_until,
    updated_at
"""

# Columns that callers are allowed to set via create/update on checks_master.
_CHECK_MUTABLE_COLUMNS = {
    "check_code",
    "category",
    "check_name",
    "query_text",
    "timeout_ms",
    "default_frequency_sec",
    "is_active",
}

# Columns that callers are allowed to set via create/update on server_checks_mapping.
# consecutive_failures and backoff_until are Collector-owned (Req 2.6).
_MAPPING_MUTABLE_COLUMNS = {
    "server_id",
    "check_id",
    "custom_frequency_sec",
    "is_enabled",
}

# Columns allowed on mapping update (subset — server_id and check_id are immutable).
_MAPPING_UPDATE_COLUMNS = {
    "custom_frequency_sec",
    "is_enabled",
}


def _row_to_dict(row: asyncpg.Record) -> dict:
    """Convert an asyncpg Record to a plain dict."""
    return dict(row)


# ---------------------------------------------------------------------------
# 16.1 — Check CRUD
# ---------------------------------------------------------------------------


async def list_checks(
    conn: asyncpg.Connection,
    category: str | None = None,
    is_active: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """
    Return a paginated list of checks with optional filters on ``category``
    and/or ``is_active``.

    Uses a ``COUNT(*) OVER()`` window function so that both the result slice
    and the total count are obtained in a single query.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    category:
        When provided, only checks with this ``category`` value are returned.
    is_active:
        When provided, only checks matching this ``is_active`` flag are returned.
    limit:
        Maximum number of rows to return (Req 2.9).
    offset:
        Number of rows to skip before returning results (Req 2.9).

    Returns
    -------
    tuple[list[dict], int]
        A 2-tuple of (rows, total_count).
    """
    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if category is not None:
        conditions.append(f"category = ${param_idx}")
        params.append(category)
        param_idx += 1

    if is_active is not None:
        conditions.append(f"is_active = ${param_idx}")
        params.append(is_active)
        param_idx += 1

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    params.append(limit)
    limit_param = f"${param_idx}"
    param_idx += 1

    params.append(offset)
    offset_param = f"${param_idx}"

    query = f"""
        SELECT
            {_CHECK_COLUMNS},
            COUNT(*) OVER() AS total_count
        FROM config.checks_master
        {where_clause}
        ORDER BY check_id ASC
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


async def get_check(
    conn: asyncpg.Connection,
    check_id: int,
) -> dict | None:
    """
    Return the check with the given ``check_id``, or ``None`` if not found.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    check_id:
        Primary key of the check to fetch.

    Returns
    -------
    dict | None
        All check columns, or ``None`` if no row exists.
    """
    row = await conn.fetchrow(
        f"""
        SELECT {_CHECK_COLUMNS}
        FROM config.checks_master
        WHERE check_id = $1
        """,
        check_id,
    )
    return _row_to_dict(row) if row is not None else None


async def create_check(
    conn: asyncpg.Connection,
    data: dict,
) -> dict:
    """
    Insert a new row into ``config.checks_master`` and return all fields.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    data:
        Column-value mapping for the new check.  Keys must be valid column
        names from ``_CHECK_MUTABLE_COLUMNS``.

    Returns
    -------
    dict
        All columns for the newly created row.

    Raises
    ------
    asyncpg.UniqueViolationError
        If a check with the same ``check_code`` already exists (Req 2.3).
    """
    columns = []
    values = []
    for col in _CHECK_MUTABLE_COLUMNS:
        if col in data and data[col] is not None:
            columns.append(col)
            values.append(data[col])

    if not columns:
        raise ValueError("No valid columns provided for check creation.")

    col_list = ", ".join(columns)
    placeholder_list = ", ".join(f"${i + 1}" for i in range(len(values)))

    row = await conn.fetchrow(
        f"""
        INSERT INTO config.checks_master ({col_list})
        VALUES ({placeholder_list})
        RETURNING {_CHECK_COLUMNS}
        """,
        *values,
    )
    return _row_to_dict(row)


async def update_check(
    conn: asyncpg.Connection,
    check_id: int,
    data: dict,
    version: int | None = None,
) -> dict | None:
    """
    Partially update a check row.

    Only fields present in ``data`` (and with non-``None`` values) are updated.
    ``version`` is always incremented and ``updated_at`` is always set to now().

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    check_id:
        Primary key of the check to update.
    data:
        Partial column-value mapping.  Only keys in ``_CHECK_MUTABLE_COLUMNS``
        are applied; unknown keys are silently ignored.
    version:
        When supplied, the UPDATE includes ``WHERE version = :version`` for
        optimistic locking (Req 2.14).  When ``None``, the update is
        unconditional.

    Returns
    -------
    dict | None
        The updated row, or ``None`` if 0 rows were affected (version conflict
        or check not found).
    """
    set_clauses: list[str] = []
    params: list[Any] = []
    param_idx = 1

    for col in _CHECK_MUTABLE_COLUMNS:
        if col in data and data[col] is not None:
            set_clauses.append(f"{col} = ${param_idx}")
            params.append(data[col])
            param_idx += 1

    # Always bump version and updated_at
    set_clauses.append("version = version + 1")
    set_clauses.append("updated_at = now()")

    set_sql = ", ".join(set_clauses)

    # WHERE clause
    params.append(check_id)
    where_sql = f"check_id = ${param_idx}"
    param_idx += 1

    if version is not None:
        params.append(version)
        where_sql += f" AND version = ${param_idx}"

    row = await conn.fetchrow(
        f"""
        UPDATE config.checks_master
        SET {set_sql}
        WHERE {where_sql}
        RETURNING {_CHECK_COLUMNS}
        """,
        *params,
    )
    return _row_to_dict(row) if row is not None else None


async def delete_check(
    conn: asyncpg.Connection,
    check_id: int,
) -> bool:
    """
    Hard-delete a check row from ``config.checks_master`` (Req 2.13).

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    check_id:
        Primary key of the check to delete.

    Returns
    -------
    bool
        ``True`` if a row was deleted, ``False`` if no row with that
        ``check_id`` existed.
    """
    result = await conn.execute(
        "DELETE FROM config.checks_master WHERE check_id = $1",
        check_id,
    )
    return result.endswith("1")


# ---------------------------------------------------------------------------
# 16.2 — Mapping CRUD
# ---------------------------------------------------------------------------


async def list_mappings(
    conn: asyncpg.Connection,
    server_id: int | None = None,
    is_enabled: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """
    Return a paginated list of mappings with optional filters on ``server_id``
    and/or ``is_enabled``.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    server_id:
        When provided, only mappings for this server are returned.
    is_enabled:
        When provided, only mappings matching this flag are returned.
    limit:
        Maximum number of rows to return (Req 2.9).
    offset:
        Number of rows to skip before returning results (Req 2.9).

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

    if is_enabled is not None:
        conditions.append(f"is_enabled = ${param_idx}")
        params.append(is_enabled)
        param_idx += 1

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    params.append(limit)
    limit_param = f"${param_idx}"
    param_idx += 1

    params.append(offset)
    offset_param = f"${param_idx}"

    query = f"""
        SELECT
            {_MAPPING_COLUMNS},
            COUNT(*) OVER() AS total_count
        FROM config.server_checks_mapping
        {where_clause}
        ORDER BY mapping_id ASC
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


async def get_mapping(
    conn: asyncpg.Connection,
    mapping_id: int,
) -> dict | None:
    """
    Return the mapping with the given ``mapping_id``, or ``None`` if not found.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    mapping_id:
        Primary key of the mapping to fetch.

    Returns
    -------
    dict | None
        All mapping columns, or ``None`` if no row exists.
    """
    row = await conn.fetchrow(
        f"""
        SELECT {_MAPPING_COLUMNS}
        FROM config.server_checks_mapping
        WHERE mapping_id = $1
        """,
        mapping_id,
    )
    return _row_to_dict(row) if row is not None else None


async def create_mapping(
    conn: asyncpg.Connection,
    data: dict,
) -> dict:
    """
    Insert a new row into ``config.server_checks_mapping`` and return all fields.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    data:
        Column-value mapping for the new mapping.  Keys must be valid column
        names from ``_MAPPING_MUTABLE_COLUMNS``.

    Returns
    -------
    dict
        All columns for the newly created row.

    Raises
    ------
    asyncpg.UniqueViolationError
        If a mapping for the same ``(server_id, check_id)`` pair already
        exists (Req 2.5).
    """
    columns = []
    values = []
    for col in _MAPPING_MUTABLE_COLUMNS:
        if col in data and data[col] is not None:
            columns.append(col)
            values.append(data[col])

    if not columns:
        raise ValueError("No valid columns provided for mapping creation.")

    col_list = ", ".join(columns)
    placeholder_list = ", ".join(f"${i + 1}" for i in range(len(values)))

    row = await conn.fetchrow(
        f"""
        INSERT INTO config.server_checks_mapping ({col_list})
        VALUES ({placeholder_list})
        RETURNING {_MAPPING_COLUMNS}
        """,
        *values,
    )
    return _row_to_dict(row)


async def update_mapping(
    conn: asyncpg.Connection,
    mapping_id: int,
    data: dict,
) -> dict | None:
    """
    Partially update a mapping row.

    Only ``custom_frequency_sec`` and ``is_enabled`` may be updated through
    the API (Req 2.6).  ``consecutive_failures`` and ``backoff_until`` are
    Collector-owned and are silently ignored if present in ``data``.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    mapping_id:
        Primary key of the mapping to update.
    data:
        Partial column-value mapping.  Only keys in ``_MAPPING_UPDATE_COLUMNS``
        are applied; unknown keys are silently ignored.

    Returns
    -------
    dict | None
        The updated row, or ``None`` if 0 rows were affected (mapping not found).
    """
    set_clauses: list[str] = []
    params: list[Any] = []
    param_idx = 1

    for col in _MAPPING_UPDATE_COLUMNS:
        if col in data and data[col] is not None:
            set_clauses.append(f"{col} = ${param_idx}")
            params.append(data[col])
            param_idx += 1

    # Always set updated_at
    set_clauses.append("updated_at = now()")

    set_sql = ", ".join(set_clauses)

    params.append(mapping_id)
    where_sql = f"mapping_id = ${param_idx}"

    row = await conn.fetchrow(
        f"""
        UPDATE config.server_checks_mapping
        SET {set_sql}
        WHERE {where_sql}
        RETURNING {_MAPPING_COLUMNS}
        """,
        *params,
    )
    return _row_to_dict(row) if row is not None else None


async def delete_mapping(
    conn: asyncpg.Connection,
    mapping_id: int,
) -> bool:
    """
    Hard-delete a mapping row from ``config.server_checks_mapping``.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    mapping_id:
        Primary key of the mapping to delete.

    Returns
    -------
    bool
        ``True`` if a row was deleted, ``False`` if no row with that
        ``mapping_id`` existed.
    """
    result = await conn.execute(
        "DELETE FROM config.server_checks_mapping WHERE mapping_id = $1",
        mapping_id,
    )
    return result.endswith("1")


# ---------------------------------------------------------------------------
# 16.3 — Check health summary
# ---------------------------------------------------------------------------

_HEALTH_SUMMARY_QUERY = """
WITH recent_runs AS (
    SELECT server_id, check_id, status,
           ROW_NUMBER() OVER (PARTITION BY server_id, check_id ORDER BY started_at DESC) AS rn
    FROM monitoring.check_runs
    WHERE started_at >= now() - INTERVAL '7 days'
),
last_n AS (
    SELECT server_id, check_id, status FROM recent_runs WHERE rn <= $1
),
stats AS (
    SELECT server_id, check_id,
           COUNT(*) FILTER (WHERE status != 1)::float / NULLIF(COUNT(*), 0) * 100 AS failure_rate_pct
    FROM last_n
    GROUP BY server_id, check_id
),
last_success AS (
    SELECT DISTINCT ON (server_id, check_id) server_id, check_id, started_at AS last_success_at
    FROM monitoring.check_runs
    WHERE status = 1
    ORDER BY server_id, check_id, started_at DESC
)
SELECT m.server_id, m.check_id,
       m.consecutive_failures,
       COALESCE(s.failure_rate_pct, 0) AS failure_rate_pct,
       ls.last_success_at
FROM config.server_checks_mapping m
LEFT JOIN stats s       ON s.server_id = m.server_id AND s.check_id = m.check_id
LEFT JOIN last_success ls ON ls.server_id = m.server_id AND ls.check_id = m.check_id
WHERE m.is_enabled = true
  AND ($2::int IS NULL OR m.server_id = $2)
"""


async def get_check_health_summary(
    conn: asyncpg.Connection,
    server_id: int | None = None,
    n: int = 20,
) -> list[dict]:
    """
    Return health statistics for each active (server_id, check_id) mapping.

    Uses a window-function CTE to compute the failure rate over the last N
    runs within the past 7 days, and the timestamp of the most recent
    successful run (Req 4a.1, 4a.2).

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    server_id:
        When provided, only mappings for this server are returned.
    n:
        Number of most-recent runs to consider when computing
        ``failure_rate_pct`` (default 20).

    Returns
    -------
    list[dict]
        Each dict contains: ``server_id``, ``check_id``,
        ``consecutive_failures``, ``failure_rate_pct``, ``last_success_at``.
    """
    rows = await conn.fetch(_HEALTH_SUMMARY_QUERY, n, server_id)
    return [_row_to_dict(row) for row in rows]


# ---------------------------------------------------------------------------
# 16.4 — has_monitoring_data_for_check
# ---------------------------------------------------------------------------


async def has_monitoring_data_for_check(
    conn: asyncpg.Connection,
    check_id: int,
) -> bool:
    """
    Return ``True`` if any monitoring rows exist for the given check (Req 2.13).

    Checks the following tables using EXISTS subqueries for efficiency:
      - ``monitoring.check_runs``
      - ``monitoring.monitoring_logs``
      - ``monitoring.monitoring_metrics``

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    check_id:
        Primary key of the check to inspect.

    Returns
    -------
    bool
        ``True`` if at least one row referencing this check exists in any of
        the monitored tables; ``False`` otherwise.
    """
    row = await conn.fetchrow(
        """
        SELECT (
            EXISTS (SELECT 1 FROM monitoring.check_runs       WHERE check_id = $1)
            OR
            EXISTS (SELECT 1 FROM monitoring.monitoring_logs  WHERE check_id = $1)
            OR
            EXISTS (SELECT 1 FROM monitoring.monitoring_metrics WHERE check_id = $1)
        ) AS has_data
        """,
        check_id,
    )
    return bool(row["has_data"])
