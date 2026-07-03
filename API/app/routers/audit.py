"""
Audit router — audit log endpoints.

Endpoints
---------
GET /audit-logs  — admin only; list audit log entries with optional filters (Req 18.4, 18.5, 18.6)

Req 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request

from app.core.dependencies import DBConn, require_role
from app.repositories.audit_repo import list_audit_logs
from app.utils.envelope import success_response
from app.utils.pagination import PaginationParams, PaginationMeta

router = APIRouter(prefix="/audit-logs", tags=["audit"])


# ---------------------------------------------------------------------------
# GET /audit-logs
# ---------------------------------------------------------------------------


@router.get("")
async def get_audit_logs(
    request: Request,
    conn: DBConn,
    pagination: PaginationParams = Depends(),
    resource_type: str | None = Query(
        None,
        description="Optional filter on resource_type.",
    ),
    resource_id: str | None = Query(
        None,
        description="Optional filter on resource_id.",
    ),
    user_id: str | None = Query(
        None,
        description="Optional filter on user_id.",
    ),
    from_dt: datetime | None = Query(
        None,
        alias="from",
        description="Optional lower bound on changed_at (ISO 8601).",
    ),
    to_dt: datetime | None = Query(
        None,
        alias="to",
        description="Optional upper bound on changed_at (ISO 8601).",
    ),
    _: None = Depends(require_role("admin")),
) -> dict:
    """
    List audit log entries with optional filters and pagination.

    Admin-only endpoint. Returns audit log entries ordered by changed_at DESC.

    Req 18.4, 18.5, 18.6

    Query Parameters
    ----------------
    resource_type:
        Optional filter on resource_type (e.g., 'server', 'check', 'system').
    resource_id:
        Optional filter on resource_id.
    user_id:
        Optional filter on user_id (username).
    from:
        Optional lower bound on changed_at (ISO 8601).
    to:
        Optional upper bound on changed_at (ISO 8601).
    limit:
        Number of rows to return (default 100, max 1000).
    offset:
        Number of rows to skip (default 0).

    Returns
    -------
    dict
        Success response with audit log entries and pagination metadata.
    """
    rows, total_count = await list_audit_logs(
        conn=conn,
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=user_id,
        from_dt=from_dt,
        to_dt=to_dt,
        limit=pagination.limit,
        offset=pagination.offset,
    )

    return success_response(
        data=rows,
        pagination=PaginationMeta(
            total=total_count,
            limit=pagination.limit,
            offset=pagination.offset,
            has_more=(pagination.offset + pagination.limit < total_count),
        ),
        filters={
            "resource_type": resource_type,
            "resource_id": resource_id,
            "user_id": user_id,
            "from": from_dt.isoformat() if from_dt else None,
            "to": to_dt.isoformat() if to_dt else None,
        },
    )
