"""
FastAPI dependency injection helpers.

Provides reusable dependencies for:
  - Database connections (get_db)
  - Authentication / RBAC (require_role)
  - Credential encryption (get_encryptor)
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Annotated

import asyncpg
from fastapi import Depends, HTTPException, Request

from app.core.encryption import CredentialEncryptor
from app.models.responses.auth import UserContext


async def get_db(request: Request) -> AsyncGenerator[asyncpg.Connection, None]:
    """
    FastAPI dependency that yields a single asyncpg connection acquired from
    the application-level connection pool (stored on ``app.state.pool``).

    The connection is automatically released back to the pool after the
    request handler (and any background tasks that depend on it) complete,
    whether the handler succeeds or raises an exception.

    Req 13.1 — all database access goes through the shared pool; no ad-hoc
    connections are created per request.

    Usage::

        @router.get("/example")
        async def example(conn: DBConn):
            return await conn.fetchrow("SELECT 1")

    Raises:
        RuntimeError: if ``app.state.pool`` is not set (pool not initialised).
    """
    pool: asyncpg.Pool = request.app.state.pool
    async with pool.acquire() as connection:
        yield connection


def get_encryptor(request: Request) -> CredentialEncryptor:
    """
    FastAPI dependency that returns the application-level
    :class:`~app.core.encryption.CredentialEncryptor` instance.

    The encryptor is initialised once during app startup and stored on
    ``app.state.encryptor``.  Injecting it via this dependency ensures that
    all route handlers share the same instance and that the key is validated
    before any request is served.

    Usage::

        @router.post("/servers")
        async def create_server(
            encryptor: Encryptor,
            ...
        ):
            encrypted = encryptor.encrypt(request.password)

    Raises:
        RuntimeError: if ``app.state.encryptor`` is not set (startup failed).
    """
    return request.app.state.encryptor


# Convenience type aliases for use in route signatures.
DBConn = Annotated[asyncpg.Connection, Depends(get_db)]
Encryptor = Annotated[CredentialEncryptor, Depends(get_encryptor)]


# ---------------------------------------------------------------------------
# RBAC
# ---------------------------------------------------------------------------

# Role hierarchy: admin > viewer.  Higher index = higher privilege.
_ROLE_HIERARCHY: list[str] = ["viewer", "admin"]


def require_role(minimum_role: str):
    """
    Return a FastAPI dependency that enforces a minimum role requirement.

    The dependency reads ``request.state.user_context`` (populated by the
    auth middleware) and raises HTTP 403 if the authenticated user's role
    does not meet the minimum required role.

    Role hierarchy (ascending privilege): ``viewer`` < ``admin``.

    Parameters
    ----------
    minimum_role:
        The lowest role that is permitted to access the endpoint.
        Must be one of ``"viewer"`` or ``"admin"``.

    Returns
    -------
    Callable
        A FastAPI dependency function that can be used with ``Depends()``.

    Raises
    ------
    HTTPException(403)
        If the user's role rank is below the required minimum (Req 10.3).

    Example
    -------
    ::

        @router.post("/servers")
        async def create_server(
            _: None = Depends(require_role("admin")),
            ...
        ):
            ...
    """

    async def _dependency(request: Request) -> None:
        user_context: UserContext | None = getattr(
            request.state, "user_context", None
        )
        if user_context is None:
            # Auth middleware should have already rejected the request, but
            # guard here as a safety net.
            raise HTTPException(
                status_code=401,
                detail="Authentication required.",
            )

        user_rank = _ROLE_HIERARCHY.index(user_context.role) if user_context.role in _ROLE_HIERARCHY else -1
        required_rank = _ROLE_HIERARCHY.index(minimum_role) if minimum_role in _ROLE_HIERARCHY else 0

        if user_rank < required_rank:
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions.",
            )

    return _dependency
