"""
Credential service — credential rotation operations.

``CredentialService.rotate`` orchestrates the re-encryption of all server
passwords using the current encryption key, writes an audit log entry, and
ensures atomicity via transaction management.

Req 11.3, 11.5, 11.6, 11.7
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import asyncpg

from app.core.encryption import CredentialEncryptor
from app.models.responses.auth import UserContext
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class CredentialService:
    """
    Service for credential rotation operations.

    All methods accept an asyncpg connection so that rotation and audit
    logging can participate in the same transaction.
    """

    def __init__(self, encryptor: CredentialEncryptor):
        """
        Initialize the credential service.

        Parameters
        ----------
        encryptor:
            A CredentialEncryptor instance used to re-encrypt passwords.
        """
        self._encryptor = encryptor
        self._audit_service = AuditService()

    async def rotate(
        self,
        conn: asyncpg.Connection,
        user_ctx: UserContext,
    ) -> dict:
        """
        Re-encrypt all server passwords with the current encryption key.

        Calls ``CredentialEncryptor.rotate_all()`` inside a transaction,
        then writes an audit log entry with action=CREDENTIAL_ROTATION,
        resource_type=system, and a payload containing the count of
        re-encrypted records and the UTC timestamp.

        Req 11.3, 11.5, 11.6, 11.7

        Parameters
        ----------
        conn:
            An asyncpg connection.
        user_ctx:
            The authenticated user context.

        Returns
        -------
        dict
            A dict with keys: count (number of re-encrypted records),
            rotated_at (ISO 8601 UTC timestamp).

        Raises
        ------
        Exception
            If rotation fails, the transaction is rolled back and the
            exception is re-raised (caller should return HTTP 500).
        """
        try:
            # Perform the rotation inside a transaction
            count = await self._encryptor.rotate_all(conn)

            # Record the audit log entry
            rotated_at = datetime.now(timezone.utc)
            payload = {
                "count": count,
                "rotated_at": rotated_at.isoformat(),
            }

            await self._audit_service.log(
                conn=conn,
                user_id=user_ctx.user_id,
                action="CREDENTIAL_ROTATION",
                resource_type="system",
                resource_id="credentials",
                payload=payload,
            )

            logger.info(
                "Credential rotation completed: %d records re-encrypted by user %s",
                count,
                user_ctx.user_id,
            )

            return {
                "count": count,
                "rotated_at": rotated_at.isoformat(),
            }

        except Exception as exc:
            logger.error(
                "Credential rotation failed: %s. Transaction will be rolled back.",
                exc,
            )
            raise
