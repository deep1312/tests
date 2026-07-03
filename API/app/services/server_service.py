"""
Server service — business logic for server management.

``ServerService`` orchestrates:
  - credential encryption via ``CredentialEncryptor``
  - optional connection validation against the target PostgreSQL instance
  - database mutations via ``server_repo``
  - audit logging via ``AuditService``

Req 1.2  — encrypt password before persisting
Req 1.10 — soft delete (deactivate)
Req 1.11 — connection validation (strict / warn mode)
Req 1.12 — hard delete only when no monitoring data
Req 1.13 — optimistic locking on update
"""

from __future__ import annotations

import logging
from typing import Any

import asyncpg
from fastapi import HTTPException

from app.core.config import get_settings
from app.core.encryption import CredentialEncryptor
from app.models.requests.server import ServerCreateRequest, ServerUpdateRequest
from app.models.responses.auth import UserContext
from app.models.responses.server import ServerResponse
from app.repositories import check_repo, server_repo
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)

# Module-level singleton for the audit service
_audit_service = AuditService()


class ServerService:
    """
    Service layer for server management operations.

    All public methods accept an asyncpg connection so that callers can
    control transaction boundaries.
    """

    def __init__(self, encryptor: CredentialEncryptor | None = None) -> None:
        if encryptor is not None:
            self._encryptor = encryptor
        else:
            # Load key from settings so .env is respected
            settings = get_settings()
            self._encryptor = CredentialEncryptor(key_b64=settings.CREDENTIAL_ENCRYPTION_KEY)

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    async def get_server(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        server_id: int,
    ) -> ServerResponse:
        """
        Fetch a single server by primary key.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        server_id:
            Primary key of the server to fetch.

        Returns
        -------
        ServerResponse
            All non-sensitive fields for the server.

        Raises
        ------
        HTTPException(404)
            If no server with the given ``server_id`` exists.
        """
        row = await server_repo.get_server(conn, server_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Server not found.")
        return ServerResponse(**row)

    async def list_servers(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        env_type: str | None = None,
        is_active: bool | None = None,
        is_di_server: bool | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[ServerResponse], int]:
        """
        Return a paginated list of servers with optional filters.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        env_type:
            Optional filter on ``env_type``.
        is_active:
            Optional filter on ``is_active``.
        is_di_server:
            Optional filter on ``is_di_server``.
        limit:
            Maximum number of rows to return.
        offset:
            Number of rows to skip.

        Returns
        -------
        tuple[list[ServerResponse], int]
            A 2-tuple of (server_responses, total_count).
        """
        rows, total = await server_repo.list_servers(
            conn,
            env_type=env_type,
            is_active=is_active,
            is_di_server=is_di_server,
            limit=limit,
            offset=offset,
        )
        return [ServerResponse(**row) for row in rows], total

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    async def create_server(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        request: ServerCreateRequest,
    ) -> ServerResponse:
        """
        Create a new server record.

        Encrypts the plaintext password, optionally validates the connection,
        inserts the row via the repository, and writes an audit log entry.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        request:
            Validated create request body.

        Returns
        -------
        ServerResponse
            The newly created server (no password fields).

        Raises
        ------
        HTTPException(422)
            In strict mode when connection validation fails (Req 1.11).
        HTTPException(409)
            When a server with the same ``server_label`` already exists (Req 1.6).
        """
        settings = get_settings()
        warnings: list[str] = []

        # Encrypt the plaintext password (Req 1.2)
        password_encrypted = self._encryptor.encrypt(request.password)

        # Optional connection validation (Req 1.11)
        warning = await self._validate_connection(
            server_ip=request.server_ip,
            port=request.port,
            db_name=request.db_name,
            username=request.username,
            password=request.password,
            mode=settings.CONNECTION_VALIDATION_MODE,
        )
        if warning:
            warnings.append(warning)

        # Build the data dict for the repository
        data: dict[str, Any] = {
            "server_label": request.server_label,
            "server_ip": request.server_ip,
            "port": request.port,
            "db_name": request.db_name,
            "username": request.username,
            "password_encrypted": password_encrypted,
            "server_role": request.server_role,
            "env_type": request.env_type,
            "ssl_mode": request.ssl_mode,
            "retention_metrics_days": request.retention_metrics_days,
            "retention_logs_days": request.retention_logs_days,
            "retention_runs_days": request.retention_runs_days,
            "compression_days": request.compression_days,
            "tags": request.tags,
            "is_active": request.is_active,
            "is_di_server": request.is_di_server,
            "version": 1,  # <--- ADD THIS LINE HERE
        }

        try:
            row = await server_repo.create_server(conn, data)
        except asyncpg.UniqueViolationError:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "duplicate_server_label",
                    "message": f"A server with label '{request.server_label}' already exists.",
                },
            )

        # Audit log (Req 1.2) — AuditService will redact password
        audit_payload = {k: v for k, v in data.items() if k != "password_encrypted"}
        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="CREATE",
            resource_type="server",
            resource_id=row["server_id"],
            payload=audit_payload,
        )

        # Auto-create mappings for all active checks
        try:
            active_checks, _ = await check_repo.list_checks(
                conn, is_active=True, limit=10000, offset=0
            )
            for check in active_checks:
                mapping_data: dict[str, Any] = {
                    "server_id": row["server_id"],
                    "check_id": check["check_id"],
                    "custom_frequency_sec": None,
                    "is_enabled": True,
                }
                try:
                    await check_repo.create_mapping(conn, mapping_data)
                except asyncpg.UniqueViolationError:
                    continue
            logger.info(
                "Auto-created %d mappings for server %d",
                len(active_checks), row["server_id"],
            )
        except Exception as map_exc:
            logger.error("Failed to auto-create mappings: %s", map_exc)
            warnings.append("Some check mappings could not be created automatically.")

        # Resilient Sync to Infrastructure API
        try:
            pass
        except Exception as sync_exc:
            logger.error(f"Failed to synchronize with infrastructure API: {sync_exc}")
            warnings.append("Infrastructure synchronization failed; server saved locally.")

        response = ServerResponse(**row)
        if warnings:
            response = response.model_copy(update={"warnings": warnings})
        return response

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    async def update_server(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        server_id: int,
        request: ServerUpdateRequest,
    ) -> ServerResponse:
        """
        Partially update a server record.

        Encrypts the password if provided, applies optimistic locking when
        a ``version`` is supplied, updates via the repository, and writes an
        audit log entry.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        server_id:
            Primary key of the server to update.
        request:
            Validated update request body.

        Returns
        -------
        ServerResponse
            The updated server (no password fields).

        Raises
        ------
        HTTPException(404)
            If no server with the given ``server_id`` exists.
        HTTPException(409)
            When the supplied ``version`` does not match the stored version
            (Req 1.13).
        HTTPException(422)
            In strict mode when connection validation fails (Req 1.11).
        """
        settings = get_settings()
        warnings: list[str] = []

        # Build the partial update dict
        data: dict[str, Any] = {}
        changed_fields: dict[str, Any] = {}

        for field in (
            "server_label",
            "server_ip",
            "port",
            "db_name",
            "username",
            "server_role",
            "env_type",
            "ssl_mode",
            "retention_metrics_days",
            "retention_logs_days",
            "retention_runs_days",
            "compression_days",
            "tags",
            "is_active",
            "is_di_server",
        ):
            value = getattr(request, field, None)
            if value is not None:
                data[field] = value
                changed_fields[field] = value

        # Encrypt password if provided (Req 1.2)
        if request.password is not None:
            data["password_encrypted"] = self._encryptor.encrypt(request.password)
            changed_fields["password"] = "[REDACTED]"

        # Connection validation when connectivity-relevant fields are being updated (Req 1.11)
        connectivity_fields = {"server_ip", "port", "db_name", "username"}
        if request.password is not None or connectivity_fields.intersection(data.keys()):
            # Fetch current server to fill in any missing connectivity fields
            current = await server_repo.get_server(conn, server_id)
            if current is None:
                raise HTTPException(status_code=404, detail="Server not found.")

            validate_ip = data.get("server_ip", current["server_ip"])
            validate_port = data.get("port", current["port"])
            validate_db = data.get("db_name", current["db_name"])
            validate_user = data.get("username", current["username"])
            # Use the new plaintext password if provided; otherwise we cannot
            # re-validate (we don't store plaintext), so skip validation.
            if request.password is not None:
                warning = await self._validate_connection(
                    server_ip=validate_ip,
                    port=validate_port,
                    db_name=validate_db,
                    username=validate_user,
                    password=request.password,
                    mode=settings.CONNECTION_VALIDATION_MODE,
                )
                if warning:
                    warnings.append(warning)

        row = await server_repo.update_server(
            conn,
            server_id=server_id,
            data=data,
            version=request.version,
        )

        if row is None:
            # Could be version conflict or server not found; check which
            existing = await server_repo.get_server(conn, server_id)
            if existing is None:
                raise HTTPException(status_code=404, detail="Server not found.")
            # Server exists but version didn't match → optimistic lock conflict
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "version_conflict",
                    "message": (
                        "The record was modified by another request. "
                        "Please reload and retry."
                    ),
                },
            )

        # Audit log (Req 1.13)
        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="UPDATE",
            resource_type="server",
            resource_id=server_id,
            payload=changed_fields,
        )

        # Resilient Sync to Infrastructure API
        try:
            # Placeholder for actual infrastructure sync logic
            pass
        except Exception as sync_exc:
            logger.error(f"Failed to synchronize updates with infrastructure API: {sync_exc}")
            warnings.append("Infrastructure synchronization failed; server updated locally.")

        response = ServerResponse(**row)
        if warnings:
            response = response.model_copy(update={"warnings": warnings})
        return response

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    async def delete_server(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        server_id: int,
    ) -> None:
        """
        Hard-delete a server record.

        Checks for associated monitoring data first; raises HTTP 409 if any
        exists.  On success, writes an audit log entry.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        server_id:
            Primary key of the server to delete.

        Raises
        ------
        HTTPException(404)
            If no server with the given ``server_id`` exists.
        HTTPException(409)
            If the server has associated monitoring data (Req 1.12).
        """
        # Verify the server exists
        existing = await server_repo.get_server(conn, server_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Server not found.")

        # Check for monitoring data (Req 1.12)
        if await server_repo.has_monitoring_data(conn, server_id):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "has_monitoring_data",
                    "message": (
                        "Cannot delete a server that has associated monitoring data. "
                        "Deactivate the server instead."
                    ),
                },
            )

        await server_repo.delete_server(conn, server_id)

        # Audit log (Req 1.12)
        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="DELETE",
            resource_type="server",
            resource_id=server_id,
            payload={"server_id": server_id},
        )

    # ------------------------------------------------------------------
    # Deactivate (soft delete)
    # ------------------------------------------------------------------

    async def deactivate_server(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        server_id: int,
    ) -> ServerResponse:
        """
        Soft-delete a server by setting ``is_active = false`` (Req 1.10).

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        server_id:
            Primary key of the server to deactivate.

        Returns
        -------
        ServerResponse
            The updated server with ``is_active = false``.

        Raises
        ------
        HTTPException(404)
            If no server with the given ``server_id`` exists.
        """
        row = await server_repo.deactivate_server(conn, server_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Server not found.")

        # Audit log (Req 1.10)
        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="UPDATE",
            resource_type="server",
            resource_id=server_id,
            payload={"server_id": server_id},
        )

        return ServerResponse(**row)

    async def activate_server(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        server_id: int,
    ) -> ServerResponse:
        """
        Reactivate a server by setting ``is_active = true``.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        server_id:
            Primary key of the server to activate.

        Returns
        -------
        ServerResponse
            The updated server with ``is_active = true``.

        Raises
        ------
        HTTPException(404)
            If no server with the given ``server_id`` exists.
        """
        row = await server_repo.activate_server(conn, server_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Server not found.")

        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="UPDATE",
            resource_type="server",
            resource_id=server_id,
            payload={"server_id": server_id},
        )

        return ServerResponse(**row)

    # ------------------------------------------------------------------
    # Connection validation helper
    # ------------------------------------------------------------------

    async def _validate_connection(
        self,
        server_ip: str,
        port: int,
        db_name: str,
        username: str,
        password: str,
        mode: str = "strict",
    ) -> str | None:
        """
        Attempt a lightweight connection to the target PostgreSQL instance.

        Parameters
        ----------
        server_ip:
            Hostname or IP address of the target server.
        port:
            TCP port of the target server.
        db_name:
            Database name to connect to.
        username:
            PostgreSQL username.
        password:
            Plaintext password.
        mode:
            ``"strict"`` — raise HTTP 422 on failure.
            ``"warn"``   — return a warning string on failure.

        Returns
        -------
        str | None
            A warning message string when ``mode == "warn"`` and the
            connection failed; ``None`` when the connection succeeded.

        Raises
        ------
        HTTPException(422)
            In ``strict`` mode when the connection attempt fails (Req 1.11).
        """
        try:
            conn = await asyncpg.connect(
                host=server_ip,
                port=port,
                database=db_name,
                user=username,
                password=password,
                timeout=5,
            )
            await conn.close()
            return None
        except Exception as exc:
            logger.warning(
                "Connection validation failed for %s:%s/%s: %s",
                server_ip,
                port,
                db_name,
                exc,
            )
            if mode == "strict":
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "connection_validation_failed",
                        "message": (
                            f"Could not connect to {server_ip}:{port}/{db_name}: {exc}"
                        ),
                    },
                )
            # warn mode — return a warning string
            return (
                f"Connection validation failed for {server_ip}:{port}/{db_name}: {exc}"
            )