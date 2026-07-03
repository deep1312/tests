"""
JWT authentication middleware.

Validates the ``Authorization: Bearer <token>`` header on every request that
is not on the public-endpoint allow-list. On success the decoded user context
is injected into ``request.state.user_context`` so that downstream handlers
and the rate-limiter can access the caller's identity.

Public endpoints (no token required):
  - / (Root URL)
  - POST /api/v1/auth/login
  - POST /api/v1/auth/refresh
  - /docs, /redoc, /openapi.json (API Documentation)

Req 10.2, 10.5 — Returns HTTP 401 with structured JSON on failure.
Req 10.9 — Injects X-Token-Expires-In header for nearing expiry.
"""

from __future__ import annotations

import json
import time
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.models.responses.auth import UserContext

# ---------------------------------------------------------------------------
# Attempt to import the real security module (implemented in task 9).
# ---------------------------------------------------------------------------
try:
    from app.core.security import decode_token as _decode_token, ExpiredSignatureError
    _SECURITY_AVAILABLE = True
except ImportError:
    # Fallback to prevent app crash if security.py is not found
    _SECURITY_AVAILABLE = False

    def _decode_token(token: str) -> dict:
        raise NotImplementedError("app.core.security is not yet available.")
    
    class ExpiredSignatureError(Exception):
        pass


# ---------------------------------------------------------------------------
# Endpoints that do not require a valid JWT
# ---------------------------------------------------------------------------

_PUBLIC_PATHS: frozenset[str] = frozenset(
    {
        "/",                   # Allows root access (fixes your 401 on GET /)
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/docs/oauth2-redirect",
        "/favicon.ico",
    }
)

# ---------------------------------------------------------------------------
# Structured Error Responses (Req 10.5)
# ---------------------------------------------------------------------------

_UNAUTHORIZED_BODY = json.dumps({
    "error": {
        "code": "unauthorized",
        "message": "Authentication required. Provide a valid Bearer token.",
        "fields": None,
    }
})

_EXPIRED_BODY = json.dumps({
    "error": {
        "code": "token_expired",
        "message": "The provided token has expired. Please re-authenticate.",
        "fields": None,
    }
})

_INVALID_BODY = json.dumps({
    "error": {
        "code": "invalid_token",
        "message": "The provided token is invalid or the security module is offline.",
        "fields": None,
    }
})


def _unauthorized(body: str = _UNAUTHORIZED_BODY) -> Response:
    return Response(
        content=body,
        status_code=401,
        headers={"Content-Type": "application/json"},
    )


# ---------------------------------------------------------------------------
# Middleware Implementation
# ---------------------------------------------------------------------------

class AuthMiddleware(BaseHTTPMiddleware):
    """
    JWT validation middleware.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Skip validation for public endpoints
        if request.url.path in _PUBLIC_PATHS:
            return await call_next(request)

        # 2. Extract Authorization header
        auth_header: str | None = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return _unauthorized(_UNAUTHORIZED_BODY)

        token = auth_header[len("Bearer "):]

        # 3. Check security module availability
        if not _SECURITY_AVAILABLE:
            return _unauthorized(_INVALID_BODY)

        # 4. Decode and Validate Token
        try:
            claims: dict[str, Any] = _decode_token(token)
        except ExpiredSignatureError:
            # Req 10.4 — Return specific expired code
            return _unauthorized(_EXPIRED_BODY)
        except Exception:
            # Handle bad signature or malformed tokens
            return _unauthorized(_INVALID_BODY)

        # 5. Extract Identity and Inject Context (Req 10.2)
        user_id = str(claims.get("sub", ""))
        role = str(claims.get("role", "viewer"))

        if not user_id:
            return _unauthorized(_INVALID_BODY)

        # Attach to request state for use in routers
        request.state.user_context = UserContext(user_id=user_id, role=role)

        # 6. Continue request chain
        response: Response = await call_next(request)

        # 7. Add Expiry Warning Header (Req 10.9)
        exp = claims.get("exp")
        if exp is not None:
            remaining = int(exp) - int(time.time())
            # If expiring within 5 minutes (300s), notify the client
            if 0 < remaining <= 300:
                response.headers["X-Token-Expires-In"] = str(remaining)

        return response