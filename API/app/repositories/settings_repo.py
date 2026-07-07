"""
Settings repository — raw SQL access to api.legend_config.
"""

from typing import Any
import asyncpg


async def get_legend_configs(conn: asyncpg.Connection) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        """
        SELECT 
            id, page_name, legend_name, is_enabled, admin_only
        FROM api.legend_config
        ORDER BY page_name, legend_name
        """
    )
    return [dict(row) for row in rows]


async def update_legend_config(
    conn: asyncpg.Connection,
    page_name: str,
    legend_name: str,
    is_enabled: bool,
) -> dict[str, Any] | None:
    row = await conn.fetchrow(
        """
        UPDATE api.legend_config
        SET is_enabled = $1, updated_at = NOW()
        WHERE page_name = $2 AND legend_name = $3
        RETURNING id, page_name, legend_name, is_enabled, admin_only
        """,
        is_enabled,
        page_name,
        legend_name,
    )
    return dict(row) if row else None
