"""
User repository — raw SQL access to ``api.users``.

Functions
---------
get_user_by_username(conn, username) -> dict | None
    Fetch an active user record by username.

create_user(conn, username, password_hash, role) -> dict
    Insert a new user and return the created row.
"""

from __future__ import annotations

from typing import Any
import asyncpg


async def get_user_by_username(
    conn: asyncpg.Connection,
    username: str,
) -> dict[str, Any] | None:
    """
    Return the active user with the given username, or ``None`` if not found.

    Only rows where ``is_active = true`` are considered so that deactivated
    accounts cannot log in (Req 10.1).

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection) to the platform database.
    username:
        The username to look up (case-sensitive).

    Returns
    -------
    dict | None
        A dictionary containing: user_id, username, password_hash, role, is_active.
    """
    # Performance Note: Using fetchrow with explicit column names 
    # avoids the overhead of '*' and ensures the dictionary mapping is predictable.
    row = await conn.fetchrow(
        """
        SELECT 
            user_id, 
            username, 
            password_hash, 
            role, 
            is_active, 
            created_at, 
            updated_at
        FROM api.users
        WHERE username = $1
          AND is_active = true
        """,
        username,
    )
    
    # asyncpg.Record can be converted directly to a dict
    return dict(row) if row is not None else None


async def create_user(
    conn: asyncpg.Connection,
    username: str,
    password_hash: str,
    role: str,
) -> dict[str, Any]:
    """
    Insert a new user into ``api.users`` and return the created row.

    Parameters
    ----------
    conn:
        An asyncpg connection (or pool connection) to the platform database.
    username:
        The unique username for the new account.
    password_hash:
        A pre-hashed password string (bcrypt cost factor 12).
    role:
        The user's role — must be ``"admin"`` or ``"viewer"``.

    Returns
    -------
    dict
        A dictionary of the newly created user record.

    Raises
    ------
    asyncpg.UniqueViolationError
        If a user with the same username already exists.
    """
    row = await conn.fetchrow(
        """
        INSERT INTO api.users (
            username, 
            password_hash, 
            role
        )
        VALUES ($1, $2, $3)
        RETURNING 
            user_id, 
            username, 
            role, 
            is_active, 
            created_at, 
            updated_at
        """,
        username,
        password_hash,
        role,
    )
    
    # Casting to dict ensures the service layer is decoupled from asyncpg types
    return dict(row)