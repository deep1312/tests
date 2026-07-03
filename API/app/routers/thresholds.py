"""
Threshold management router.

Endpoints
---------
GET    /thresholds                          — viewer+; list thresholds (filter: check_id, server_id; paginated)
POST   /thresholds                          — admin only; create threshold
GET    /thresholds/{threshold_id}           — viewer+; get single threshold
PUT    /thresholds/{threshold_id}           — admin only; update with optimistic lock
DELETE /thresholds/{threshold_id}           — admin only; hard delete (HTTP 204)
PATCH  /thresholds/{threshold_id}/deactivate — admin only; soft delete (is_active=false)

All endpoints return the standard envelope format.

Req 3.1  — CRUD endpoints for config.check_thresholds
Req 3.6  — filter by check_id and server_id
Req 3.7  — soft delete via deactivate
Req 3.8  — hard delete (admin only, no associated alerts)
Req 3.9  — optimistic locking on update
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response

from app.core.dependencies import DBConn, require_role
from app.models.requests.threshold import ThresholdCreateRequest, ThresholdUpdateRequest
from app.models.responses.auth import UserContext
from app.services.threshold_service import ThresholdService
from app.utils.envelope import success_response
from app.utils.pagination import PaginationParams, build_pagination_meta

router = APIRouter(prefix="/thresholds", tags=["thresholds"])


# ---------------------------------------------------------------------------
# GET /thresholds
# ---------------------------------------------------------------------------


@router.get("")
async def list_thresholds(
    request: Request,
    conn: DBConn,
    pagination: PaginationParams = Depends(),
    check_id: int | None = Query(default=None, description="Filter by check ID."),
    server_id: int | None = Query(default=None, description="Filter by server ID."),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    List thresholds with optional filters and pagination.

    Req 3.6 — filter by check_id and server_id.
    """
    service = ThresholdService()
    user_ctx: UserContext = request.state.user_context

    thresholds, total = await service.list_thresholds(
        user_ctx=user_ctx,
        conn=conn,
        check_id=check_id,
        server_id=server_id,
        limit=pagination.limit,
        offset=pagination.offset,
    )

    filters: dict = {}
    if check_id is not None:
        filters["check_id"] = check_id
    if server_id is not None:
        filters["server_id"] = server_id

    return success_response(
        data=[t.model_dump() for t in thresholds],
        pagination=build_pagination_meta(total, pagination.limit, pagination.offset),
        filters=filters if filters else None,
    )


# ---------------------------------------------------------------------------
# POST /thresholds
# ---------------------------------------------------------------------------


@router.post("", status_code=201)
async def create_threshold(
    request: Request,
    body: ThresholdCreateRequest,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> dict:
    """
    Create a new check threshold.

    Admin only (Req 3.1).
    """
    service = ThresholdService()
    user_ctx: UserContext = request.state.user_context

    threshold = await service.create_threshold(
        user_ctx=user_ctx,
        conn=conn,
        request=body,
    )
    return success_response(data=threshold.model_dump())


# ---------------------------------------------------------------------------
# GET /thresholds/{threshold_id}
# ---------------------------------------------------------------------------


@router.get("/{threshold_id}")
async def get_threshold(
    request: Request,
    threshold_id: int,
    conn: DBConn,
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    Fetch a single threshold by ID.

    Viewer+ (Req 3.1).
    """
    service = ThresholdService()
    user_ctx: UserContext = request.state.user_context

    threshold = await service.get_threshold(
        user_ctx=user_ctx,
        conn=conn,
        threshold_id=threshold_id,
    )
    return success_response(data=threshold.model_dump())


# ---------------------------------------------------------------------------
# PUT /thresholds/{threshold_id}
# ---------------------------------------------------------------------------


@router.put("/{threshold_id}")
async def update_threshold(
    request: Request,
    threshold_id: int,
    body: ThresholdUpdateRequest,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> dict:
    """
    Update a threshold record.

    Admin only.  Supports optimistic locking via the ``version`` field (Req 3.9).
    """
    service = ThresholdService()
    user_ctx: UserContext = request.state.user_context

    threshold = await service.update_threshold(
        user_ctx=user_ctx,
        conn=conn,
        threshold_id=threshold_id,
        request=body,
    )
    return success_response(data=threshold.model_dump())


# ---------------------------------------------------------------------------
# DELETE /thresholds/{threshold_id}
# ---------------------------------------------------------------------------


@router.delete("/{threshold_id}")
async def delete_threshold(
    request: Request,
    threshold_id: int,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> Response:
    """
    Hard-delete a threshold.

    Admin only (Req 3.8).  Returns HTTP 204 No Content on success.
    Raises HTTP 409 if the threshold has associated alerts.
    """
    service = ThresholdService()
    user_ctx: UserContext = request.state.user_context

    await service.delete_threshold(
        user_ctx=user_ctx,
        conn=conn,
        threshold_id=threshold_id,
    )
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# PATCH /thresholds/{threshold_id}/deactivate
# ---------------------------------------------------------------------------


@router.patch("/{threshold_id}/deactivate")
async def deactivate_threshold(
    request: Request,
    threshold_id: int,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> dict:
    """
    Soft-delete a threshold by setting ``is_active = false`` (Req 3.7).

    Admin only.  Preserves configuration history.
    """
    service = ThresholdService()
    user_ctx: UserContext = request.state.user_context

    threshold = await service.deactivate_threshold(
        user_ctx=user_ctx,
        conn=conn,
        threshold_id=threshold_id,
    )
    return success_response(data=threshold.model_dump())
