"""
Threshold repository — raw SQL access to ``config.check_thresholds``.

Functions
---------
list_thresholds(conn, check_id, server_id, limit, offset) -> tuple[list, int]
    Paginated list of thresholds with optional filters.

get_threshold(conn, threshold_id) -> dict | None
    Fetch a single threshold by primary key.

create_threshold(conn, data) -> dict
    Insert a new threshold row and return all fields.

update_threshold(conn, threshold_id, data, version) -> dict | None
    Partial update with optional optimistic locking (Req 3.9).

delete_threshold(conn, threshold_id) -> bool
    Hard DELETE; returns True if a row was removed.

deactivate_threshold(conn, threshold_id) -> dict | None
    Soft-delete: set is_active = false (Req 3.7).

has_associated_alerts(conn, check_id, metric_name) -> bool
    Returns True if any alert rows exist for the given check_id + metric_name (Req 3.8).
"""

from __future__ import annotations

from typing import Any

import asyncpg

# All columns returned by read operations.
_THRESHOLD_COLUMNS = """
    threshold_id,
    check_id,
    server_id,
    metric_name,
    comparison_operator,
    warning_value_num AS warning_value,
    critical_value_num AS critical_value,
    is_active,
    created_at,
    updated_at,
    version
"""

_MUTABLE_COLUMNS = {
    "check_id",
    "server_id",
    "metric_name",
    "comparison_operator",
    "warning_value_num",
    "critical_value_num",
    "is_active",
}


def _row_to_dict(row: asyncpg.Record) -> dict:
    """Convert an asyncpg Record to a plain dict."""
    return dict(row)


async def list_thresholds(
    conn: asyncpg.Connection,
    check_id: int | None = None,
    server_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """
    Return a paginated list of thresholds with optional filters on ``check_id``
    and/or ``server_id`` (Req 3.6).

    Uses a ``COUNT(*) OVER()`` window function so that both the result slice
    and the total count are obtained in a single query.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    check_id:
        When provided, only thresholds for this check are returned.
    server_id:
        When provided, only thresholds for this server are returned.
    limit:
        Maximum number of rows to return.
    offset:
        Number of rows to skip before returning results.

    Returns
    -------
    tuple[list[dict], int]
        A 2-tuple of (rows, total_count).
    """
    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if check_id is not None:
        conditions.append(f"check_id = ${param_idx}")
        params.append(check_id)
        param_idx += 1

    if server_id is not None:
        conditions.append(f"server_id = ${param_idx}")
        params.append(server_id)
        param_idx += 1

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    params.append(limit)
    limit_param = f"${param_idx}"
    param_idx += 1

    params.append(offset)
    offset_param = f"${param_idx}"

    query = f"""
        SELECT
            {_THRESHOLD_COLUMNS},
            COUNT(*) OVER() AS total_count
        FROM config.check_thresholds
        {where_clause}
        ORDER BY threshold_id ASC
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


async def get_threshold(
    conn: asyncpg.Connection,
    threshold_id: int,
) -> dict | None:
    """
    Return the threshold with the given ``threshold_id``, or ``None`` if not found.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    threshold_id:
        Primary key of the threshold to fetch.

    Returns
    -------
    dict | None
        All columns, or ``None`` if no row exists.
    """
    row = await conn.fetchrow(
        f"""
        SELECT {_THRESHOLD_COLUMNS}
        FROM config.check_thresholds
        WHERE threshold_id = $1
        """,
        threshold_id,
    )
    return _row_to_dict(row) if row is not None else None


async def create_threshold(
    conn: asyncpg.Connection,
    data: dict,
) -> dict:
    """
    Insert a new row into ``config.check_thresholds`` and return all fields.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    data:
        Column-value mapping for the new threshold.  Keys must be valid column
        names from ``_MUTABLE_COLUMNS``.

    Returns
    -------
    dict
        All columns for the newly created row.
    """
    columns = []
    values = []
    for col in _MUTABLE_COLUMNS:
        if col in data:
            # Include even None values (e.g. server_id=None for global threshold)
            columns.append(col)
            values.append(data[col])

    if not columns:
        raise ValueError("No valid columns provided for threshold creation.")

    col_list = ", ".join(columns)
    placeholder_list = ", ".join(f"${i + 1}" for i in range(len(values)))

    row = await conn.fetchrow(
        f"""
        INSERT INTO config.check_thresholds ({col_list})
        VALUES ({placeholder_list})
        RETURNING {_THRESHOLD_COLUMNS}
        """,
        *values,
    )
    return _row_to_dict(row)


async def update_threshold(
    conn: asyncpg.Connection,
    threshold_id: int,
    data: dict,
    version: int | None = None,
) -> dict | None:
    """
    Partially update a threshold row.

    Only fields present in ``data`` are updated.  ``version`` and
    ``updated_at`` are always updated.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    threshold_id:
        Primary key of the threshold to update.
    data:
        Partial column-value mapping.  Only keys in ``_MUTABLE_COLUMNS`` are
        applied; unknown keys are silently ignored.
    version:
        When supplied, the UPDATE includes ``WHERE version = :version`` for
        optimistic locking (Req 3.9).  When ``None``, the update is
        unconditional.

    Returns
    -------
    dict | None
        The updated row, or ``None`` if 0 rows were affected (version conflict
        or threshold not found).
    """
    set_clauses: list[str] = []
    params: list[Any] = []
    param_idx = 1

    for col in _MUTABLE_COLUMNS:
        if col in data:
            set_clauses.append(f"{col} = ${param_idx}")
            params.append(data[col])
            param_idx += 1

    # Always bump version and updated_at
    set_clauses.append("version = version + 1")
    set_clauses.append("updated_at = now()")

    if not set_clauses:
        return await get_threshold(conn, threshold_id)

    set_sql = ", ".join(set_clauses)

    params.append(threshold_id)
    where_sql = f"threshold_id = ${param_idx}"
    param_idx += 1

    if version is not None:
        params.append(version)
        where_sql += f" AND version = ${param_idx}"

    row = await conn.fetchrow(
        f"""
        UPDATE config.check_thresholds
        SET {set_sql}
        WHERE {where_sql}
        RETURNING {_THRESHOLD_COLUMNS}
        """,
        *params,
    )
    return _row_to_dict(row) if row is not None else None


async def delete_threshold(
    conn: asyncpg.Connection,
    threshold_id: int,
) -> bool:
    """
    Hard-delete a threshold row from ``config.check_thresholds``.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    threshold_id:
        Primary key of the threshold to delete.

    Returns
    -------
    bool
        ``True`` if a row was deleted, ``False`` if no row with that
        ``threshold_id`` existed.
    """
    result = await conn.execute(
        "DELETE FROM config.check_thresholds WHERE threshold_id = $1",
        threshold_id,
    )
    return result.endswith("1")


async def deactivate_threshold(
    conn: asyncpg.Connection,
    threshold_id: int,
) -> dict | None:
    """
    Soft-delete a threshold by setting ``is_active = false`` (Req 3.7).

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    threshold_id:
        Primary key of the threshold to deactivate.

    Returns
    -------
    dict | None
        The updated row, or ``None`` if the threshold was not found.
    """
    row = await conn.fetchrow(
        f"""
        UPDATE config.check_thresholds
        SET is_active = false,
            updated_at = now()
        WHERE threshold_id = $1
        RETURNING {_THRESHOLD_COLUMNS}
        """,
        threshold_id,
    )
    return _row_to_dict(row) if row is not None else None


async def has_associated_alerts(
    conn: asyncpg.Connection,
    check_id: int,
    metric_name: str,
) -> bool:
    """
    Return ``True`` if any alert rows exist for the given ``check_id`` and
    ``metric_name`` (Req 3.8).

    Checks ``alerts.alerts`` for any row referencing the threshold's
    ``check_id`` and ``metric_name``.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection).
    check_id:
        The check ID to look up in alerts.
    metric_name:
        The metric name to look up in alerts.

    Returns
    -------
    bool
        ``True`` if at least one alert row exists; ``False`` otherwise.
    """
    row = await conn.fetchrow(
        """
        SELECT EXISTS (
            SELECT 1
            FROM alerts.alerts
            WHERE check_id = $1
              AND metric_name = $2
        ) AS has_alerts
        """,
        check_id,
        metric_name,
    )
    return bool(row["has_alerts"])
