"""
Audit service — append-only audit log writer.

``AuditService.log`` writes a single row to ``api.audit_log`` recording
who performed what action on which resource and what the payload was.

Req 1.2, 1.10, 1.12, 1.13 — every config mutation is audit-logged.
"""

from __future__ import annotations

from typing import Literal

import asyncpg


class AuditService:
    """
    Service for writing append-only audit log entries.

    All methods are async and accept an asyncpg connection so that audit
    writes can participate in the same transaction as the mutation they
    record.
    """

    async def log(
        self,
        conn: asyncpg.Connection,
        user_id: str,
        action: Literal["CREATE", "UPDATE", "DELETE", "CREDENTIAL_ROTATION"],
        resource_type: str,
        resource_id: str | int,
        payload: dict,
    ) -> None:
        """
        Write an audit log entry.

        Redacts any ``password`` field in the payload before storing.
        Delegates to the audit repository to insert the row.

        Parameters
        ----------
        conn:
            An asyncpg connection (or pool connection).
        user_id:
            The identifier of the user performing the action.
        action:
            One of ``CREATE``, ``UPDATE``, ``DELETE``, ``CREDENTIAL_ROTATION``.
        resource_type:
            The type of resource being mutated (e.g. ``"server"``).
        resource_id:
            The primary key of the affected resource (stringified before storage).
        payload:
            A dict snapshot of the changed fields. Any ``password`` key will be
            replaced with ``"[REDACTED]"`` before storage.

        Req 18.2, 18.3, 18.7
        """
        from app.repositories.audit_repo import insert_audit_log

        # Redact password field if present (Req 18.7)
        redacted_payload = dict(payload)
        if "password" in redacted_payload:
            redacted_payload["password"] = "[REDACTED]"

        await insert_audit_log(
            conn=conn,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            payload=redacted_payload,
        )
