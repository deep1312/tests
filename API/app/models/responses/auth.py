"""
Pydantic response models for authentication endpoints.

``TokenResponse`` — returned by ``POST /auth/login`` and ``POST /auth/refresh``.
``UserContext``   — injected into ``request.state.user_context`` by the Auth
                    middleware after a successful JWT validation.
"""

from __future__ import annotations

from pydantic import BaseModel


class TokenResponse(BaseModel):
    """JWT token payload returned to the client after successful authentication."""

    token: str
    expires_in: int  # seconds until the token expires


class UserContext(BaseModel):
    """
    Lightweight representation of the authenticated user.

    Populated by the Auth middleware and stored on ``request.state.user_context``
    so that downstream handlers and services can access the caller's identity
    without re-parsing the JWT.
    """

    user_id: str
    role: str  # "admin" | "viewer"
