"""
Pydantic request models for authentication endpoints.

``LoginRequest`` — body accepted by ``POST /api/v1/auth/login``.
"""

from __future__ import annotations

from pydantic import BaseModel


class LoginRequest(BaseModel):
    """Credentials submitted to the login endpoint."""

    username: str
    password: str
