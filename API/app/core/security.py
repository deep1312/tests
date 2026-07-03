"""
Security utilities for the PostgreSQL Health Monitoring Platform API.

Provides:
  - ``create_access_token`` — issue a signed HS256 JWT
  - ``decode_token``         — validate and decode a JWT
  - ``hash_password``        — bcrypt hash with cost factor 12
  - ``verify_password``      — constant-time bcrypt comparison

Req 10.4 — JWT expiry is enforced; expired tokens raise ``ExpiredSignatureError``.
Req 10.8 — Passwords are hashed with bcrypt (cost factor 12).
"""

from __future__ import annotations

import time
from typing import Any

import bcrypt
from jose import ExpiredSignatureError, JWTError, jwt

from app.core.config import get_settings
from fastapi.security import HTTPBearer

bearer_scheme = HTTPBearer()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_ALGORITHM = "HS256"


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(user_id: str, role: str, expiry_seconds: int) -> str:
    """
    Create a signed HS256 JWT.
    
    Req 10.4 — Subject (sub) and Role claims are included.
    """
    settings = get_settings()
    
    # Safety check: Ensure secret key is configured
    if not settings.JWT_SECRET or settings.JWT_SECRET == "CHANGE_ME":
        raise RuntimeError("JWT_SECRET is not properly configured in environment.")

    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + expiry_seconds,
    }
    
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT.

    Raises
    ------
    jose.ExpiredSignatureError
        If 'exp' is in the past. Caught by AuthMiddleware for 401 response.
    jose.JWTError
        For signature mismatch or malformed tokens.
    """
    settings = get_settings()
    
    # Req 10.4 — Python-jose validates 'exp' automatically by default
    options = {"verify_exp": True, "verify_sub": True}
    
    decoded: dict[str, Any] = jwt.decode(
        token, 
        settings.JWT_SECRET, 
        algorithms=[_ALGORITHM],
        options=options
    )
    return decoded


# ---------------------------------------------------------------------------
# Password hashing helpers
# ---------------------------------------------------------------------------

def hash_password(plaintext: str) -> str:
    """
    Hash a password using bcrypt with cost factor 12 (Req 10.8).
    """
    # Ensure plaintext is bytes for bcrypt
    password_bytes = plaintext.encode("utf-8")
    
    # Generate salt and hash
    salt = bcrypt.gensalt(rounds=12)
    hashed_bytes = bcrypt.hashpw(password_bytes, salt)
    
    # Return as UTF-8 string for DB storage
    return hashed_bytes.decode("utf-8")


def verify_password(plaintext: str, hashed: str) -> bool:
    """
    Verify a password against a stored bcrypt hash.
    Uses constant-time comparison to prevent timing attacks.
    """
    try:
        return bcrypt.checkpw(
            plaintext.encode("utf-8"), 
            hashed.encode("utf-8")
        )
    except (ValueError, AttributeError):
        # Handle cases where 'hashed' might be malformed
        return False