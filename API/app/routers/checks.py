"""
Check and mapping management router.

Endpoints
---------
GET    /checks                  — viewer+; list checks (filter: category, is_active; paginated)
POST   /checks                  — admin only; create check
GET    /checks/health           — viewer+; check health summary (filter: server_id, health_state)
GET    /checks/{check_id}       — viewer+; get single check
PUT    /checks/{check_id}       — admin only; update with optimistic lock
DELETE /checks/{check_id}       — admin only; hard delete (HTTP 204)

GET    /mappings                — viewer+; list mappings (filter: server_id, is_enabled; paginated)
POST   /mappings                — admin only; create mapping
PUT    /mappings/{mapping_id}   — admin only; update mapping
DELETE /mappings/{mapping_id}   — admin only; delete mapping (HTTP 204)

All endpoints return the standard envelope format.

Req 2.1  — CRUD endpoints for config.checks_master
Req 2.4  — CRUD endpoints for config.server_checks_mapping
Req 2.7  — filter checks by category and is_active
Req 2.8  — filter mappings by server_id and is_enabled
Req 2.9  — pagination on check list and mapping list endpoints
Req 2.13 — hard delete (admin only, no monitoring data)
Req 2.14 — optimistic locking on update
Req 4a.1 — check health summary endpoint
Req 4a.4 — filter health summary by server_id and health_state
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response

from app.core.dependencies import DBConn, require_role
from app.models.requests.check import (
    CheckCreateRequest,
    CheckUpdateRequest,
    MappingCreateRequest,
    MappingUpdateRequest,
)
from app.models.responses.auth import UserContext
from app.services.check_service import CheckService
from app.utils.envelope import success_response
from app.utils.pagination import PaginationParams, build_pagination_meta

router = APIRouter(prefix="/checks", tags=["checks"])
_mappings_router = APIRouter(prefix="/mappings", tags=["mappings"])

_service = CheckService()


# ---------------------------------------------------------------------------
# GET /checks/health  — MUST be registered BEFORE /{check_id}
# ---------------------------------------------------------------------------


@router.get("/health")
async def get_check_health_summary(
    request: Request,
    conn: DBConn,
    server_id: int | None = Query(default=None, description="Filter by server ID."),
    health_state: Literal["HEALTHY", "FLAKY", "FAILING"] | None = Query(
        default=None,
        description="Filter by health state: HEALTHY, FLAKY, or FAILING.",
    ),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    Return health statistics for each active (server_id, check_id) mapping.

    Req 4a.1 — check health summary endpoint.
    Req 4a.4 — filter by server_id and health_state.
    """
    user_ctx: UserContext = request.state.user_context

    items = await _service.get_health_summary(
        user_ctx=user_ctx,
        conn=conn,
        server_id=server_id,
        health_state=health_state,
    )

    filters: dict = {}
    if server_id is not None:
        filters["server_id"] = server_id
    if health_state is not None:
        filters["health_state"] = health_state

    return success_response(
        data=[item.model_dump() for item in items],
        filters=filters if filters else None,
    )


# ---------------------------------------------------------------------------
# GET /checks
# ---------------------------------------------------------------------------


@router.get("")
async def list_checks(
    request: Request,
    conn: DBConn,
    pagination: PaginationParams = Depends(),
    category: str | None = Query(default=None, description="Filter by category."),
    is_active: bool | None = Query(default=None, description="Filter by active status."),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    List checks with optional filters and pagination.

    Req 2.7 — filter by category and is_active.
    Req 2.9 — pagination via limit/offset.
    """
    user_ctx: UserContext = request.state.user_context

    checks, total = await _service.list_checks(
        user_ctx=user_ctx,
        conn=conn,
        category=category,
        is_active=is_active,
        limit=pagination.limit,
        offset=pagination.offset,
    )

    filters: dict = {}
    if category is not None:
        filters["category"] = category
    if is_active is not None:
        filters["is_active"] = is_active

    return success_response(
        data=[c.model_dump() for c in checks],
        pagination=build_pagination_meta(total, pagination.limit, pagination.offset),
        filters=filters if filters else None,
    )


# ---------------------------------------------------------------------------
# POST /checks
# ---------------------------------------------------------------------------


@router.post("", status_code=201)
async def create_check(
    request: Request,
    body: CheckCreateRequest,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> dict:
    """
    Create a new health check.

    Admin only (Req 2.1).
    """
    user_ctx: UserContext = request.state.user_context

    check = await _service.create_check(
        user_ctx=user_ctx,
        conn=conn,
        request=body,
    )
    return success_response(data=check.model_dump())


# ---------------------------------------------------------------------------
# GET /checks/{check_id}
# ---------------------------------------------------------------------------


@router.get("/{check_id}")
async def get_check(
    request: Request,
    check_id: int,
    conn: DBConn,
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    Fetch a single check by ID.

    Viewer+ (Req 2.1).
    """
    user_ctx: UserContext = request.state.user_context

    check = await _service.get_check(
        user_ctx=user_ctx,
        conn=conn,
        check_id=check_id,
    )
    return success_response(data=check.model_dump())


# ---------------------------------------------------------------------------
# PUT /checks/{check_id}
# ---------------------------------------------------------------------------


@router.put("/{check_id}")
async def update_check(
    request: Request,
    check_id: int,
    body: CheckUpdateRequest,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> dict:
    """
    Update a check record.

    Admin only.  Supports optimistic locking via the ``version`` field (Req 2.14).
    """
    user_ctx: UserContext = request.state.user_context

    check = await _service.update_check(
        user_ctx=user_ctx,
        conn=conn,
        check_id=check_id,
        request=body,
    )
    return success_response(data=check.model_dump())


# ---------------------------------------------------------------------------
# DELETE /checks/{check_id}
# ---------------------------------------------------------------------------


@router.delete("/{check_id}")
async def delete_check(
    request: Request,
    check_id: int,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> Response:
    """
    Hard-delete a check.

    Admin only (Req 2.13).  Returns HTTP 204 No Content on success.
    Raises HTTP 409 if the check has associated monitoring data.
    """
    user_ctx: UserContext = request.state.user_context

    await _service.delete_check(
        user_ctx=user_ctx,
        conn=conn,
        check_id=check_id,
    )
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# GET /mappings
# ---------------------------------------------------------------------------


@_mappings_router.get("")
async def list_mappings(
    request: Request,
    conn: DBConn,
    pagination: PaginationParams = Depends(),
    server_id: int | None = Query(default=None, description="Filter by server ID."),
    is_enabled: bool | None = Query(default=None, description="Filter by enabled status."),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    List mappings with optional filters and pagination.

    Req 2.8 — filter by server_id and is_enabled.
    Req 2.9 — pagination via limit/offset.
    """
    user_ctx: UserContext = request.state.user_context

    mappings, total = await _service.list_mappings(
        user_ctx=user_ctx,
        conn=conn,
        server_id=server_id,
        is_enabled=is_enabled,
        limit=pagination.limit,
        offset=pagination.offset,
    )

    filters: dict = {}
    if server_id is not None:
        filters["server_id"] = server_id
    if is_enabled is not None:
        filters["is_enabled"] = is_enabled

    return success_response(
        data=[m.model_dump() for m in mappings],
        pagination=build_pagination_meta(total, pagination.limit, pagination.offset),
        filters=filters if filters else None,
    )


# ---------------------------------------------------------------------------
# POST /mappings
# ---------------------------------------------------------------------------


@_mappings_router.post("", status_code=201)
async def create_mapping(
    request: Request,
    body: MappingCreateRequest,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> dict:
    """
    Create a new server-check mapping.

    Admin only (Req 2.4).
    """
    user_ctx: UserContext = request.state.user_context

    mapping = await _service.create_mapping(
        user_ctx=user_ctx,
        conn=conn,
        request=body,
    )
    return success_response(data=mapping.model_dump())


# ---------------------------------------------------------------------------
# PUT /mappings/{mapping_id}
# ---------------------------------------------------------------------------


@_mappings_router.put("/{mapping_id}")
async def update_mapping(
    request: Request,
    mapping_id: int,
    body: MappingUpdateRequest,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> dict:
    """
    Update a mapping record.

    Admin only.  Only ``custom_frequency_sec`` and ``is_enabled`` may be
    updated (Req 2.8).
    """
    user_ctx: UserContext = request.state.user_context

    mapping = await _service.update_mapping(
        user_ctx=user_ctx,
        conn=conn,
        mapping_id=mapping_id,
        request=body,
    )
    return success_response(data=mapping.model_dump())


# ---------------------------------------------------------------------------
# DELETE /mappings/{mapping_id}
# ---------------------------------------------------------------------------


@_mappings_router.delete("/{mapping_id}")
async def delete_mapping(
    request: Request,
    mapping_id: int,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> Response:
    """
    Delete a mapping.

    Admin only (Req 2.8).  Returns HTTP 204 No Content on success.
    """
    user_ctx: UserContext = request.state.user_context

    await _service.delete_mapping(
        user_ctx=user_ctx,
        conn=conn,
        mapping_id=mapping_id,
    )
    return Response(status_code=204)
