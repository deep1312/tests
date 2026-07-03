"""
Admin router — admin-only endpoints.

Endpoints
---------
POST /admin/credentials/rotate  — admin only; re-encrypt all server passwords (Req 11.5, 11.7)

Req 11.3, 11.5, 11.6, 11.7
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.core.dependencies import DBConn, get_encryptor, require_role
from app.models.responses.auth import UserContext
from app.services.credential_service import CredentialService
from app.utils.envelope import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# POST /admin/credentials/rotate
# ---------------------------------------------------------------------------


@router.post("/credentials/rotate")
async def rotate_credentials(
    request: Request,
    conn: DBConn,
    user_ctx: UserContext = Depends(require_role("admin")),
    encryptor=Depends(get_encryptor),
) -> dict:
    """
    Re-encrypt all server passwords with the current encryption key.

    This endpoint is intended for use after a key rotation event. It
    decrypts each server's password with the current key and re-encrypts
    it, all within a single transaction.

    Req 11.3, 11.5, 11.6, 11.7

    Returns
    -------
    dict
        Success response with count of re-encrypted records and timestamp.

    Raises
    ------
    HTTPException(500)
        If rotation fails, the transaction is rolled back and HTTP 500
        with error code ``rotation_failed`` is returned.
    """
    try:
        service = CredentialService(encryptor=encryptor)
        result = await service.rotate(conn=conn, user_ctx=user_ctx)

        return success_response(
            data={
                "count": result["count"],
                "rotated_at": result["rotated_at"],
            },
        )

    except Exception as exc:
        logger.error("Credential rotation failed: %s", exc)
        return JSONResponse(
            status_code=500,
            content=error_response(
                code="rotation_failed",
                message="Credential rotation failed. All changes have been rolled back.",
            ),
        )
