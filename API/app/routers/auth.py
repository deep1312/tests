"""
Authentication router.

Endpoints
---------
POST /auth/login
    Accept ``LoginRequest`` credentials, call ``AuthService.login()``, and
    return a ``TokenResponse`` wrapped in the success envelope.

POST /auth/refresh
    Accept an ``Authorization: Bearer <token>`` header, call
    ``AuthService.refresh()``, and return a new ``TokenResponse``.

Both endpoints are public — the auth middleware skips JWT validation for
``/api/v1/auth/login`` and ``/api/v1/auth/refresh``.

Req 10.6 — login returns HTTP 401 with a generic message on bad credentials.
Req 10.10 — refresh is public; no auth required on the route itself.
"""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, status

from app.core.dependencies import DBConn
from app.models.requests.auth import LoginRequest
from app.models.responses.auth import TokenResponse
from app.services.auth_service import AuthService
from app.utils.envelope import success_response

# Prefix is /auth, which becomes /api/v1/auth when included in main.py
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", status_code=status.HTTP_200_OK)
async def login(
    body: LoginRequest,
    conn: DBConn,
) -> dict:
    """
    Issue a JWT on valid credentials.

    Accepts a JSON body with ``username`` and ``password``. Returns a
    ``TokenResponse`` wrapped in the standard success envelope.

    Raises HTTP 401 with a generic message if the credentials are invalid
    (Req 10.6).
    """
    service = AuthService(conn)
    
    # AuthService.login handles password verification and DB lookup.
    # It should raise an HTTPException(401) internally if validation fails.
    token_response: TokenResponse = await service.login(body.username, body.password)
    
    return success_response(token_response.model_dump())


@router.post("/refresh", status_code=status.HTTP_200_OK)
async def refresh(
    conn: DBConn,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict:
    """
    Exchange a valid JWT for a fresh token.

    Reads the ``Authorization: Bearer <token>`` header, validates the
    existing token, and returns a new ``TokenResponse`` with a reset expiry.

    Raises HTTP 401 if the header is missing, the token is invalid, or the
    token is expired (Req 10.7).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header with Bearer token is required.",
        )

    token = authorization[len("Bearer "):]
    service = AuthService(conn)
    
    # AuthService.refresh calls security.decode_token and generates a new JWT.
    token_response: TokenResponse = await service.refresh(token)
    
    return success_response(token_response.model_dump())