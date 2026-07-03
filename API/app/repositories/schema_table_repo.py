from __future__ import annotations

from typing import Any

import asyncpg

_COLUMNS = """
    id,
    schema_name,
    table_name,
    display_name,
    is_active,
    created_on
"""

_MUTABLE_COLUMNS = {
    "schema_name",
    "table_name",
    "display_name",
}


def _row_to_dict(row: asyncpg.Record) -> dict:
    return dict(row)


async def list_schema_tables(
    conn: asyncpg.Connection,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict], int]:
    conditions: list[str] = []
    params: list[Any] = []

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    params.append(limit)
    limit_param = f"${len(params)}"
    params.append(offset)
    offset_param = f"${len(params)}"

    query = f"""
        SELECT
            {_COLUMNS},
            COUNT(*) OVER() AS total_count
        FROM config.table_count_config
        {where_clause}
        ORDER BY schema_name ASC, table_name ASC
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


async def get_schema_table(
    conn: asyncpg.Connection,
    record_id: int,
) -> dict | None:
    row = await conn.fetchrow(
        f"""
        SELECT {_COLUMNS}
        FROM config.table_count_config
        WHERE id = $1
        """,
        record_id,
    )
    return _row_to_dict(row) if row is not None else None


async def create_schema_table(
    conn: asyncpg.Connection,
    data: dict,
) -> dict:
    columns = []
    values = []
    for col in _MUTABLE_COLUMNS:
        if col in data:
            columns.append(col)
            values.append(data[col])

    if not columns:
        raise ValueError("No valid columns provided.")

    col_list = ", ".join(columns)
    placeholder_list = ", ".join(f"${i + 1}" for i in range(len(values)))

    row = await conn.fetchrow(
        f"""
        INSERT INTO config.table_count_config ({col_list})
        VALUES ({placeholder_list})
        RETURNING {_COLUMNS}
        """,
        *values,
    )
    return _row_to_dict(row)


async def update_schema_table(
    conn: asyncpg.Connection,
    record_id: int,
    data: dict,
) -> dict | None:
    set_clauses: list[str] = []
    params: list[Any] = []
    param_idx = 1

    for col in _MUTABLE_COLUMNS:
        if col in data:
            set_clauses.append(f"{col} = ${param_idx}")
            params.append(data[col])
            param_idx += 1

    if not set_clauses:
        return await get_schema_table(conn, record_id)

    set_sql = ", ".join(set_clauses)

    params.append(record_id)
    where_sql = f"id = ${param_idx}"

    row = await conn.fetchrow(
        f"""
        UPDATE config.table_count_config
        SET {set_sql}
        WHERE {where_sql}
        RETURNING {_COLUMNS}
        """,
        *params,
    )
    return _row_to_dict(row) if row is not None else None


async def delete_schema_table(
    conn: asyncpg.Connection,
    record_id: int,
) -> bool:
    result = await conn.execute(
        "DELETE FROM config.table_count_config WHERE id = $1",
        record_id,
    )
    return result.endswith("1")
