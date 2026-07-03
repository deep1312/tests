"""
asyncpg connection pool lifecycle management.

Usage:
    from app.db.pool import create_pool, close_pool, get_pool

    # In FastAPI lifespan:
    pool = await create_pool()
    app.state.pool = pool
    ...
    await close_pool()
"""

from __future__ import annotations

import asyncpg

from app.core.config import get_settings

# Module-level pool instance; set by create_pool() and cleared by close_pool().
_pool: asyncpg.Pool | None = None


async def create_pool() -> asyncpg.Pool:
    """
    Initialise the asyncpg connection pool using settings from the environment.

    Pool parameters:
      - dsn: DATABASE_URL from settings
      - command_timeout: DB_STATEMENT_TIMEOUT_MS converted to seconds

    The created pool is stored as a module-level variable so it can be
    retrieved later via get_pool().

    Returns:
        The newly created asyncpg.Pool instance.
    """
    global _pool

    settings = get_settings()

    # asyncpg command_timeout is in seconds; settings stores milliseconds.
    command_timeout_secs = settings.DB_STATEMENT_TIMEOUT_MS / 1000.0

    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        command_timeout=command_timeout_secs,
    )

    return _pool


async def close_pool() -> None:
    """
    Gracefully close the asyncpg connection pool.

    Waits for all active connections to be returned before closing.
    Clears the module-level pool reference after closing.
    """
    global _pool

    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    """
    Return the active connection pool.

    Raises:
        RuntimeError: if the pool has not been initialised yet.
    """
    if _pool is None:
        raise RuntimeError(
            "Database connection pool is not initialised. "
            "Ensure create_pool() has been called during application startup."
        )
    return _pool
