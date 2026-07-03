"""
Threshold service — business logic for threshold management.

``ThresholdService`` orchestrates:
  - database mutations via ``threshold_repo``
  - audit logging via ``AuditService``

Req 3.1  — CRUD endpoints for config.check_thresholds
Req 3.7  — soft delete (deactivate)
Req 3.8  — hard delete only when no associated alerts
Req 3.9  — optimistic locking on update
Req 18.1 — audit log for all mutations
"""

from __future__ import annotations

import logging
from typing import Any

import asyncpg
from fastapi import HTTPException

from app.models.requests.threshold import ThresholdCreateRequest, ThresholdUpdateRequest
from app.models.responses.auth import UserContext
from app.models.responses.threshold import ThresholdResponse
from app.repositories import threshold_repo
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)

# Module-level singleton for the audit service
_audit_service = AuditService()


class ThresholdService:
    """
    Service layer for threshold management operations.

    All public methods accept an asyncpg connection so that callers can
    control transaction boundaries.
    """

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    async def get_threshold(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        threshold_id: int,
    ) -> ThresholdResponse:
        """
        Fetch a single threshold by primary key.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        threshold_id:
            Primary key of the threshold to fetch.

        Returns
        -------
        ThresholdResponse
            All fields for the threshold.

        Raises
        ------
        HTTPException(404)
            If no threshold with the given ``threshold_id`` exists.
        """
        row = await threshold_repo.get_threshold(conn, threshold_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Threshold not found.")
        return ThresholdResponse(**row)

    async def list_thresholds(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        check_id: int | None = None,
        server_id: int | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[ThresholdResponse], int]:
        """
        Return a paginated list of thresholds with optional filters (Req 3.6).

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        check_id:
            Optional filter on ``check_id``.
        server_id:
            Optional filter on ``server_id``.
        limit:
            Maximum number of rows to return.
        offset:
            Number of rows to skip.

        Returns
        -------
        tuple[list[ThresholdResponse], int]
            A 2-tuple of (threshold_responses, total_count).
        """
        rows, total = await threshold_repo.list_thresholds(
            conn,
            check_id=check_id,
            server_id=server_id,
            limit=limit,
            offset=offset,
        )
        return [ThresholdResponse(**row) for row in rows], total

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    async def create_threshold(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        request: ThresholdCreateRequest,
    ) -> ThresholdResponse:
        """
        Create a new threshold record.

        Inserts the row via the repository and writes an audit log entry.

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
        ThresholdResponse
            The newly created threshold.
        """
        data: dict[str, Any] = {
            "check_id": request.check_id,
            "metric_name": request.metric_name,
            "comparison_operator": request.comparison_operator,
            "server_id": request.server_id,
            "warning_value_num": request.warning_value,
            "critical_value_num": request.critical_value,
            "is_active": request.is_active,
        }

        row = await threshold_repo.create_threshold(conn, data)

        # Audit log (Req 3.7, 18.1)
        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="CREATE",
            resource_type="threshold",
            resource_id=row["threshold_id"],
            payload=data,
        )

        return ThresholdResponse(**row)

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    async def update_threshold(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        threshold_id: int,
        request: ThresholdUpdateRequest,
    ) -> ThresholdResponse:
        """
        Partially update a threshold record.

        Applies optimistic locking when a ``version`` is supplied, updates
        via the repository, and writes an audit log entry.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        threshold_id:
            Primary key of the threshold to update.
        request:
            Validated update request body.

        Returns
        -------
        ThresholdResponse
            The updated threshold.

        Raises
        ------
        HTTPException(404)
            If no threshold with the given ``threshold_id`` exists.
        HTTPException(409)
            When the supplied ``version`` does not match the stored version
            (Req 3.9).
        """
        data: dict[str, Any] = {}

        for field in (
            "check_id",
            "metric_name",
            "comparison_operator",
            "server_id",
            "is_active",
        ):
            value = getattr(request, field, None)
            if value is not None:
                data[field] = value

        if request.warning_value is not None:
            data["warning_value_num"] = request.warning_value
        if request.critical_value is not None:
            data["critical_value_num"] = request.critical_value

        row = await threshold_repo.update_threshold(
            conn,
            threshold_id=threshold_id,
            data=data,
            version=request.version,
        )

        if row is None:
            # Could be version conflict or threshold not found; check which
            existing = await threshold_repo.get_threshold(conn, threshold_id)
            if existing is None:
                raise HTTPException(status_code=404, detail="Threshold not found.")
            # Threshold exists but version didn't match → optimistic lock conflict
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

        # Audit log (Req 3.9, 18.1)
        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="UPDATE",
            resource_type="threshold",
            resource_id=threshold_id,
            payload=data,
        )

        return ThresholdResponse(**row)

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    async def delete_threshold(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        threshold_id: int,
    ) -> None:
        """
        Hard-delete a threshold record.

        Checks for associated alerts first; raises HTTP 409 if any exist
        (Req 3.8).  On success, writes an audit log entry.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        threshold_id:
            Primary key of the threshold to delete.

        Raises
        ------
        HTTPException(404)
            If no threshold with the given ``threshold_id`` exists.
        HTTPException(409)
            If the threshold has associated alerts (Req 3.8).
        """
        # Verify the threshold exists
        existing = await threshold_repo.get_threshold(conn, threshold_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Threshold not found.")

        # Check for associated alerts (Req 3.8)
        if await threshold_repo.has_associated_alerts(
            conn, existing["check_id"], existing["metric_name"]
        ):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "has_associated_alerts",
                    "message": (
                        "Cannot delete a threshold that has associated alerts. "
                        "Deactivate the threshold instead."
                    ),
                },
            )

        await threshold_repo.delete_threshold(conn, threshold_id)

        # Audit log (Req 3.8, 18.1)
        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="DELETE",
            resource_type="threshold",
            resource_id=threshold_id,
            payload={"threshold_id": threshold_id},
        )

    # ------------------------------------------------------------------
    # Deactivate (soft delete)
    # ------------------------------------------------------------------

    async def deactivate_threshold(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        threshold_id: int,
    ) -> ThresholdResponse:
        """
        Soft-delete a threshold by setting ``is_active = false`` (Req 3.7).

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        threshold_id:
            Primary key of the threshold to deactivate.

        Returns
        -------
        ThresholdResponse
            The updated threshold with ``is_active = false``.

        Raises
        ------
        HTTPException(404)
            If no threshold with the given ``threshold_id`` exists.
        """
        row = await threshold_repo.deactivate_threshold(conn, threshold_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Threshold not found.")

        # Audit log (Req 3.7, 18.1)
        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="UPDATE",
            resource_type="threshold",
            resource_id=threshold_id,
            payload={"threshold_id": threshold_id, "is_active": False},
        )

        return ThresholdResponse(**row)
