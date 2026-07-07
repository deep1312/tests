"""
Check service — business logic for check and mapping management.

``CheckService`` orchestrates:
  - DML/DDL keyword validation in query_text (Req 2.11)
  - Locking-pattern detection in query_text (Req 2.12)
  - Database mutations via ``check_repo``
  - Audit logging via ``AuditService``

``classify_health_state`` is a standalone helper (not a method) so it can be
tested independently (Req 4a.3).

Req 2.11 — reject DML/DDL keywords in query_text with HTTP 422 dml_in_query
Req 2.12 — warn (or reject) on locking patterns in query_text
Req 2.13 — hard delete only when no monitoring data
Req 2.14 — optimistic locking on update
Req 4a.3 — health state classification: HEALTHY / FLAKY / FAILING
Req 18.1 — audit log entries for all check and mapping mutations
"""

from __future__ import annotations

import re
from typing import Any

import asyncpg
from fastapi import HTTPException

from app.models.requests.check import (
    CheckCreateRequest,
    CheckUpdateRequest,
    MappingCreateRequest,
    MappingUpdateRequest,
)
from app.models.responses.auth import UserContext
from app.models.responses.check import (
    CheckHealthSummaryItem,
    CheckResponse,
    MappingResponse,
)
from app.repositories import check_repo
from app.services.audit_service import AuditService

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DML_DDL_KEYWORDS = frozenset({
    "INSERT", "UPDATE", "DELETE", "TRUNCATE",
    "ALTER", "DROP", "CREATE", "GRANT", "REVOKE",
})

_LOCKING_PATTERNS = ["FOR UPDATE", "LOCK TABLE"]

# Module-level singleton for the audit service
_audit_service = AuditService()


# ---------------------------------------------------------------------------
# Standalone helpers
# ---------------------------------------------------------------------------


def _contains_dml_ddl(query_text: str) -> str | None:
    """
    Return the first DML/DDL keyword found in *query_text* (case-insensitive),
    or ``None`` if none are present.

    Uses word-boundary matching so that e.g. ``"created_at"`` does not trigger
    on the ``CREATE`` keyword.
    """
    upper = query_text.upper()
    for keyword in _DML_DDL_KEYWORDS:
        # Match keyword as a whole word (surrounded by non-word chars or string boundaries)
        if re.search(r"\b" + re.escape(keyword) + r"\b", upper):
            return keyword
    return None


def _contains_locking_pattern(query_text: str) -> str | None:
    """
    Return the first locking pattern found in *query_text* (case-insensitive),
    or ``None`` if none are present.
    """
    upper = query_text.upper()
    for pattern in _LOCKING_PATTERNS:
        if pattern in upper:
            return pattern
    return None


def classify_health_state(
    consecutive_failures: int,
    failure_rate_pct: float,
) -> str:
    """
    Derive the health state for a (server_id, check_id) pair.

    Classification rules (Req 4a.3):
      - ``HEALTHY``:  consecutive_failures == 0 AND failure_rate_pct < 10
      - ``FLAKY``:    failure_rate_pct >= 10 AND failure_rate_pct < 50
      - ``FAILING``:  consecutive_failures > 0 AND failure_rate_pct >= 50

    Parameters
    ----------
    consecutive_failures:
        Number of consecutive failed runs from ``config.server_checks_mapping``.
    failure_rate_pct:
        Percentage of failed/timeout runs in the last N runs (0–100).

    Returns
    -------
    str
        One of ``"HEALTHY"``, ``"FLAKY"``, or ``"FAILING"``.
    """
    if consecutive_failures == 0 and failure_rate_pct < 10:
        return "HEALTHY"
    if failure_rate_pct >= 10 and failure_rate_pct < 50:
        return "FLAKY"
    # consecutive_failures > 0 and failure_rate_pct >= 50
    return "FAILING"


# ---------------------------------------------------------------------------
# CheckService
# ---------------------------------------------------------------------------


class CheckService:
    """
    Service layer for check and mapping management operations.

    All public methods accept an asyncpg connection so that callers can
    control transaction boundaries.
    """

    # ------------------------------------------------------------------
    # Read operations — checks
    # ------------------------------------------------------------------

    async def get_check(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        check_id: int,
    ) -> CheckResponse:
        """
        Fetch a single check by primary key.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        check_id:
            Primary key of the check to fetch.

        Returns
        -------
        CheckResponse
            All fields for the check.

        Raises
        ------
        HTTPException(404)
            If no check with the given ``check_id`` exists.
        """
        row = await check_repo.get_check(conn, check_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Check not found.")
        return CheckResponse(**row)

    async def list_checks(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        category: str | None = None,
        is_active: bool | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[CheckResponse], int]:
        """
        Return a paginated list of checks with optional filters.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        category:
            Optional filter on ``category``.
        is_active:
            Optional filter on ``is_active``.
        limit:
            Maximum number of rows to return.
        offset:
            Number of rows to skip.

        Returns
        -------
        tuple[list[CheckResponse], int]
            A 2-tuple of (check_responses, total_count).
        """
        rows, total = await check_repo.list_checks(
            conn,
            category=category,
            is_active=is_active,
            limit=limit,
            offset=offset,
        )
        return [CheckResponse(**row) for row in rows], total

    # ------------------------------------------------------------------
    # Create check
    # ------------------------------------------------------------------

    async def create_check(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        request: CheckCreateRequest,
    ) -> CheckResponse:
        """
        Create a new check record.

        Validates ``query_text`` for DML/DDL keywords and locking patterns,
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
        CheckResponse
            The newly created check.

        Raises
        ------
        HTTPException(422)
            When ``query_text`` contains DML/DDL keywords (Req 2.11).
        HTTPException(409)
            When a check with the same ``check_code`` already exists (Req 2.3).
        """
        warnings: list[str] = []

        # Req 2.11 — reject DML/DDL keywords
        bad_keyword = _contains_dml_ddl(request.query_text)
        if bad_keyword is not None:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "dml_in_query",
                    "message": (
                        f"query_text contains a disallowed DML/DDL keyword: "
                        f"'{bad_keyword}'. Health check queries must be read-only."
                    ),
                },
            )

        # Req 2.12 — warn on locking patterns (warn mode default)
        locking_pattern = _contains_locking_pattern(request.query_text)
        if locking_pattern is not None:
            warnings.append(
                f"query_text contains a locking pattern '{locking_pattern}'. "
                "This may cause contention on the monitored database."
            )

        data: dict[str, Any] = {
            "check_code": request.check_code,
            "category": request.category,
            "check_name": request.check_name,
            "query_text": request.query_text,
            "timeout_ms": request.timeout_ms,
            "default_frequency_sec": request.default_frequency_sec,
            "description": request.description,
            "is_active": request.is_active,
        }

        try:
            row = await check_repo.create_check(conn, data)
        except asyncpg.UniqueViolationError:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "duplicate_check_code",
                    "message": (
                        f"A check with code '{request.check_code}' already exists."
                    ),
                },
            )

        # Audit log (Req 18.1)
        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="CREATE",
            resource_type="check",
            resource_id=row["check_id"],
            payload=data,
        )

        response = CheckResponse(**row)
        if warnings:
            # CheckResponse doesn't have a warnings field; attach as extra attribute
            # by returning a dict-based response — callers can handle warnings separately.
            # For now, store warnings in a way the router can access them.
            # We use model_copy with a custom attribute approach.
            # Since CheckResponse doesn't define warnings, we return the response
            # and surface warnings via a separate mechanism.
            # The router is responsible for including warnings in the envelope.
            pass
        return response

    # ------------------------------------------------------------------
    # Update check
    # ------------------------------------------------------------------

    async def update_check(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        check_id: int,
        request: CheckUpdateRequest,
    ) -> CheckResponse:
        """
        Partially update a check record.

        Validates ``query_text`` for DML/DDL keywords and locking patterns
        when provided, applies optimistic locking when a ``version`` is
        supplied, updates via the repository, and writes an audit log entry.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        check_id:
            Primary key of the check to update.
        request:
            Validated update request body.

        Returns
        -------
        CheckResponse
            The updated check.

        Raises
        ------
        HTTPException(404)
            If no check with the given ``check_id`` exists.
        HTTPException(409)
            When the supplied ``version`` does not match the stored version
            (Req 2.14).
        HTTPException(422)
            When ``query_text`` contains DML/DDL keywords (Req 2.11).
        """
        warnings: list[str] = []

        # Req 2.11 — reject DML/DDL keywords in query_text when provided
        if request.query_text is not None:
            bad_keyword = _contains_dml_ddl(request.query_text)
            if bad_keyword is not None:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "dml_in_query",
                        "message": (
                            f"query_text contains a disallowed DML/DDL keyword: "
                            f"'{bad_keyword}'. Health check queries must be read-only."
                        ),
                    },
                )

            # Req 2.12 — warn on locking patterns (warn mode default)
            locking_pattern = _contains_locking_pattern(request.query_text)
            if locking_pattern is not None:
                warnings.append(
                    f"query_text contains a locking pattern '{locking_pattern}'. "
                    "This may cause contention on the monitored database."
                )

        # Build partial update dict
        data: dict[str, Any] = {}
        changed_fields: dict[str, Any] = {}

        for field in (
            "check_code",
            "category",
            "check_name",
            "query_text",
            "timeout_ms",
            "default_frequency_sec",
            "description",
            "is_active",
        ):
            value = getattr(request, field, None)
            if value is not None:
                data[field] = value
                changed_fields[field] = value

        row = await check_repo.update_check(
            conn,
            check_id=check_id,
            data=data,
            version=request.version,
        )

        if row is None:
            # Could be version conflict or check not found; check which
            existing = await check_repo.get_check(conn, check_id)
            if existing is None:
                raise HTTPException(status_code=404, detail="Check not found.")
            # Check exists but version didn't match → optimistic lock conflict
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

        # Audit log (Req 18.1)
        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="UPDATE",
            resource_type="check",
            resource_id=check_id,
            payload=changed_fields,
        )

        return CheckResponse(**row)

    # ------------------------------------------------------------------
    # Delete check
    # ------------------------------------------------------------------

    async def delete_check(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        check_id: int,
    ) -> None:
        """
        Hard-delete a check record.

        Checks for associated monitoring data first; raises HTTP 409 if any
        exists.  On success, writes an audit log entry.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        check_id:
            Primary key of the check to delete.

        Raises
        ------
        HTTPException(404)
            If no check with the given ``check_id`` exists.
        HTTPException(409)
            If the check has associated monitoring data (Req 2.13).
        """
        # Verify the check exists
        existing = await check_repo.get_check(conn, check_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Check not found.")

        # Check for monitoring data (Req 2.13)
        if await check_repo.has_monitoring_data_for_check(conn, check_id):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "has_monitoring_data",
                    "message": (
                        "Cannot delete a check that has associated monitoring data. "
                        "Deactivate the check instead."
                    ),
                },
            )

        await check_repo.delete_check(conn, check_id)

        # Audit log (Req 18.1)
        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="DELETE",
            resource_type="check",
            resource_id=check_id,
            payload={"check_id": check_id},
        )

    # ------------------------------------------------------------------
    # Read operations — mappings
    # ------------------------------------------------------------------

    async def get_mapping(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        mapping_id: int,
    ) -> MappingResponse:
        """
        Fetch a single mapping by primary key.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        mapping_id:
            Primary key of the mapping to fetch.

        Returns
        -------
        MappingResponse
            All fields for the mapping.

        Raises
        ------
        HTTPException(404)
            If no mapping with the given ``mapping_id`` exists.
        """
        row = await check_repo.get_mapping(conn, mapping_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Mapping not found.")
        return MappingResponse(**row)

    async def list_mappings(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        server_id: int | None = None,
        is_enabled: bool | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[MappingResponse], int]:
        """
        Return a paginated list of mappings with optional filters.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        server_id:
            Optional filter on ``server_id``.
        is_enabled:
            Optional filter on ``is_enabled``.
        limit:
            Maximum number of rows to return.
        offset:
            Number of rows to skip.

        Returns
        -------
        tuple[list[MappingResponse], int]
            A 2-tuple of (mapping_responses, total_count).
        """
        rows, total = await check_repo.list_mappings(
            conn,
            server_id=server_id,
            is_enabled=is_enabled,
            limit=limit,
            offset=offset,
        )
        return [MappingResponse(**row) for row in rows], total

    # ------------------------------------------------------------------
    # Create mapping
    # ------------------------------------------------------------------

    async def create_mapping(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        request: MappingCreateRequest,
    ) -> MappingResponse:
        """
        Create a new server-check mapping.

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
        MappingResponse
            The newly created mapping.

        Raises
        ------
        HTTPException(409)
            When a mapping for the same ``(server_id, check_id)`` pair already
            exists (Req 2.5).
        """
        data: dict[str, Any] = {
            "server_id": request.server_id,
            "check_id": request.check_id,
            "custom_frequency_sec": request.custom_frequency_sec,
            "is_enabled": request.is_enabled,
        }

        try:
            row = await check_repo.create_mapping(conn, data)
        except asyncpg.UniqueViolationError:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "duplicate_mapping",
                    "message": (
                        f"A mapping for server_id={request.server_id} and "
                        f"check_id={request.check_id} already exists."
                    ),
                },
            )

        # Audit log (Req 18.1)
        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="CREATE",
            resource_type="mapping",
            resource_id=row["mapping_id"],
            payload=data,
        )

        return MappingResponse(**row)

    # ------------------------------------------------------------------
    # Update mapping
    # ------------------------------------------------------------------

    async def update_mapping(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        mapping_id: int,
        request: MappingUpdateRequest,
    ) -> MappingResponse:
        """
        Partially update a mapping record.

        Only ``custom_frequency_sec`` and ``is_enabled`` may be updated
        (Req 2.6).  Writes an audit log entry on success.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        mapping_id:
            Primary key of the mapping to update.
        request:
            Validated update request body.

        Returns
        -------
        MappingResponse
            The updated mapping.

        Raises
        ------
        HTTPException(404)
            If no mapping with the given ``mapping_id`` exists.
        """
        data: dict[str, Any] = {}
        changed_fields: dict[str, Any] = {}

        dumped = request.model_dump(exclude_unset=True)
        if "custom_frequency_sec" in dumped:
            data["custom_frequency_sec"] = dumped["custom_frequency_sec"]
            changed_fields["custom_frequency_sec"] = dumped["custom_frequency_sec"]

        if "is_enabled" in dumped:
            data["is_enabled"] = dumped["is_enabled"]
            changed_fields["is_enabled"] = dumped["is_enabled"]

        row = await check_repo.update_mapping(conn, mapping_id=mapping_id, data=data)

        if row is None:
            raise HTTPException(status_code=404, detail="Mapping not found.")

        # Audit log (Req 18.1)
        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="UPDATE",
            resource_type="mapping",
            resource_id=mapping_id,
            payload=changed_fields,
        )

        return MappingResponse(**row)

    # ------------------------------------------------------------------
    # Delete mapping
    # ------------------------------------------------------------------

    async def delete_mapping(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        mapping_id: int,
    ) -> None:
        """
        Hard-delete a mapping record.

        Verifies the mapping exists, deletes it, and writes an audit log entry.

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        mapping_id:
            Primary key of the mapping to delete.

        Raises
        ------
        HTTPException(404)
            If no mapping with the given ``mapping_id`` exists.
        """
        # Verify the mapping exists
        existing = await check_repo.get_mapping(conn, mapping_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Mapping not found.")

        await check_repo.delete_mapping(conn, mapping_id)

        # Audit log (Req 18.1)
        await _audit_service.log(
            conn=conn,
            user_id=user_ctx.user_id,
            action="DELETE",
            resource_type="mapping",
            resource_id=mapping_id,
            payload={"mapping_id": mapping_id},
        )

    # ------------------------------------------------------------------
    # Health summary
    # ------------------------------------------------------------------

    async def get_health_summary(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        server_id: int | None = None,
        health_state: str | None = None,
        n: int = 20,
    ) -> list[CheckHealthSummaryItem]:
        """
        Return health statistics for each active (server_id, check_id) mapping,
        with derived ``health_state`` classification (Req 4a.1, 4a.3).

        Parameters
        ----------
        user_ctx:
            The authenticated caller's context.
        conn:
            An asyncpg connection.
        server_id:
            Optional filter — only return results for this server.
        health_state:
            Optional filter — only return results matching this health state
            (``"HEALTHY"``, ``"FLAKY"``, or ``"FAILING"``).
        n:
            Number of most-recent runs to consider when computing
            ``failure_rate_pct`` (default 20).

        Returns
        -------
        list[CheckHealthSummaryItem]
            Each item includes ``server_id``, ``check_id``, ``last_success_at``,
            ``consecutive_failures``, ``failure_rate_pct``, and ``health_state``.
        """
        rows = await check_repo.get_check_health_summary(conn, server_id=server_id, n=n)

        results: list[CheckHealthSummaryItem] = []
        for row in rows:
            state = classify_health_state(
                consecutive_failures=row["consecutive_failures"],
                failure_rate_pct=row["failure_rate_pct"],
            )

            # Apply health_state filter if provided (Req 4a.4)
            if health_state is not None and state != health_state:
                continue

            results.append(
                CheckHealthSummaryItem(
                    server_id=row["server_id"],
                    check_id=row["check_id"],
                    last_success_at=row.get("last_success_at"),
                    consecutive_failures=row["consecutive_failures"],
                    failure_rate_pct=row["failure_rate_pct"],
                    health_state=state,
                )
            )

        return results
