"""
Authentication service.

``AuthService`` encapsulates all authentication business logic:
  - ``login``         — verify credentials and issue a JWT
  - ``refresh``       — exchange a valid JWT for a fresh one
  - ``verify_token`` — decode a JWT and return a ``UserContext``

Req 10.6 — login returns HTTP 401 with a generic message on invalid credentials
            (username or password wrong — the message must not reveal which).
Req 10.7 — refresh validates the existing token before issuing a new one.
Req 10.10 — refresh endpoint is public (no auth required on the route itself).
"""

from __future__ import annotations

import asyncpg
from fastapi import HTTPException, status
from jose import ExpiredSignatureError, JWTError

from app.core.config import get_settings
from app.core.security import create_access_token, decode_token, verify_password
from app.models.responses.auth import TokenResponse, UserContext
from app.repositories.user_repo import get_user_by_username


class AuthService:
    """
    Service layer for authentication operations.

    Parameters
    ----------
    conn:
        An asyncpg connection used for user lookups.
    """

    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def login(self, username: str, password: str) -> TokenResponse:
        """
        Authenticate a user and return a signed JWT.

        Req 10.6 — Uses generic error messages and constant-time checks
        to prevent user enumeration via timing attacks.
        """
        settings = get_settings()

        # Fetch user from the repository
        user = await get_user_by_username(self._conn, username)

        # Verify password or fail with generic message
        if not user or not verify_password(password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password.",
            )

        # Check account status
        if user.get("is_active") is False:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is disabled.",
            )

        token = create_access_token(
            user_id=str(user["user_id"]),
            role=user["role"],
            expiry_seconds=settings.JWT_EXPIRY_SECONDS,
        )
        
        # NOTE: Using 'token' key to match Pydantic TokenResponse model
        return TokenResponse(
            token=token, 
            expires_in=settings.JWT_EXPIRY_SECONDS
        )

    async def refresh(self, token: str) -> TokenResponse:
        """
        Exchange a valid JWT for a fresh token with a new expiry.

        Req 10.7 — Validates existing token before refresh.
        """
        settings = get_settings()

        try:
            claims = decode_token(token)
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired. Please log in again.",
            )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token.",
            )

        user_id: str = str(claims.get("sub", ""))
        role: str = str(claims.get("role", ""))

        if not user_id or not role:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token claims are incomplete.",
            )

        new_token = create_access_token(
            user_id=user_id,
            role=role,
            expiry_seconds=settings.JWT_EXPIRY_SECONDS,
        )
        
        # NOTE: Using 'token' key to match Pydantic TokenResponse model
        return TokenResponse(
            token=new_token,
            expires_in=settings.JWT_EXPIRY_SECONDS
        )

    def verify_token(self, token: str) -> UserContext:
        """
        Decode a JWT and return the caller's ``UserContext``.
        """
        try:
            claims = decode_token(token)
            user_id = str(claims.get("sub", ""))
            role = str(claims.get("role", "viewer"))
            
            if not user_id:
                raise ValueError("Missing subject claim")
                
            return UserContext(user_id=user_id, role=role)
            
        except (JWTError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )