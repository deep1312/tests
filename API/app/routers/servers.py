"""
Server management router.

Endpoints
---------
GET    /servers                        — list servers (filter: env_type, is_active; paginated)
POST   /servers                        — admin only; create server
GET    /servers/{server_id}            — viewer+; get single server
PUT    /servers/{server_id}            — admin only; update with optimistic lock
DELETE /servers/{server_id}            — admin only; hard delete (HTTP 204)
PATCH  /servers/{server_id}/deactivate — admin only; soft delete (is_active=false)

All endpoints return the standard envelope format.

Req 1.1  — CRUD endpoints for config.servers
Req 1.4  — read returns all non-sensitive fields
Req 1.8  — filter by env_type and is_active
Req 1.9  — pagination on list endpoint
Req 1.10 — soft delete via deactivate
Req 1.12 — hard delete (admin only, no monitoring data)
Req 1.13 — optimistic locking on update
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse, Response

from app.core.dependencies import DBConn, Encryptor, require_role
from app.models.requests.server import ServerCreateRequest, ServerUpdateRequest
from app.models.responses.auth import UserContext
from app.services.server_service import ServerService
from app.utils.envelope import success_response
from app.utils.pagination import PaginationParams, build_pagination_meta

router = APIRouter(prefix="/servers", tags=["servers"])


# ---------------------------------------------------------------------------
# GET /servers
# ---------------------------------------------------------------------------


@router.get("")
async def list_servers(
    request: Request,
    conn: DBConn,
    encryptor: Encryptor,
    pagination: PaginationParams = Depends(),
    env_type: str | None = Query(default=None, description="Filter by environment type."),
    is_active: bool | None = Query(default=None, description="Filter by active status."),
    is_di_server: bool | None = Query(default=None, description="Filter by DI server flag."),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    List servers with optional filters and pagination.

    Req 1.8 — filter by env_type, is_active, and is_di_server.
    Req 1.9 — pagination via limit/offset.
    """
    service = ServerService(encryptor)
    user_ctx: UserContext = request.state.user_context

    servers, total = await service.list_servers(
        user_ctx=user_ctx,
        conn=conn,
        env_type=env_type,
        is_active=is_active,
        is_di_server=is_di_server,
        limit=pagination.limit,
        offset=pagination.offset,
    )

    filters: dict = {}
    if env_type is not None:
        filters["env_type"] = env_type
    if is_active is not None:
        filters["is_active"] = is_active
    if is_di_server is not None:
        filters["is_di_server"] = is_di_server

    return success_response(
        data=[s.model_dump() for s in servers],
        pagination=build_pagination_meta(total, pagination.limit, pagination.offset),
        filters=filters if filters else None,
    )


# ---------------------------------------------------------------------------
# POST /servers
# ---------------------------------------------------------------------------


@router.post("", status_code=201)
async def create_server(
    request: Request,
    body: ServerCreateRequest,
    conn: DBConn,
    encryptor: Encryptor,
    _: None = Depends(require_role("admin")),
) -> dict:
    """
    Create a new monitored PostgreSQL server.

    Admin only (Req 1.1).  Encrypts the password before persisting (Req 1.2).
    Optionally validates the connection (Req 1.11).
    """
    service = ServerService(encryptor)
    user_ctx: UserContext = request.state.user_context

    server = await service.create_server(
        user_ctx=user_ctx,
        conn=conn,
        request=body,
    )
    return success_response(data=server.model_dump())


# ---------------------------------------------------------------------------
# GET /servers/{server_id}
# ---------------------------------------------------------------------------


@router.get("/{server_id}")
async def get_server(
    request: Request,
    server_id: int,
    conn: DBConn,
    encryptor: Encryptor,
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    Fetch a single server by ID.

    Viewer+ (Req 1.4).  Returns all non-sensitive fields.
    """
    service = ServerService(encryptor)
    user_ctx: UserContext = request.state.user_context

    server = await service.get_server(
        user_ctx=user_ctx,
        conn=conn,
        server_id=server_id,
    )
    return success_response(data=server.model_dump())


# ---------------------------------------------------------------------------
# PUT /servers/{server_id}
# ---------------------------------------------------------------------------


@router.put("/{server_id}")
async def update_server(
    request: Request,
    server_id: int,
    body: ServerUpdateRequest,
    conn: DBConn,
    encryptor: Encryptor,
    _: None = Depends(require_role("admin")),
) -> dict:
    """
    Update a server record.

    Admin only.  Supports optimistic locking via the ``version`` field (Req 1.13).
    """
    service = ServerService(encryptor)
    user_ctx: UserContext = request.state.user_context

    server = await service.update_server(
        user_ctx=user_ctx,
        conn=conn,
        server_id=server_id,
        request=body,
    )
    return success_response(data=server.model_dump())


# ---------------------------------------------------------------------------
# DELETE /servers/{server_id}
# ---------------------------------------------------------------------------


@router.delete("/{server_id}")
async def delete_server(
    request: Request,
    server_id: int,
    conn: DBConn,
    encryptor: Encryptor,
    _: None = Depends(require_role("admin")),
) -> Response:
    """
    Hard-delete a server.

    Admin only (Req 1.12).  Returns HTTP 204 No Content on success.
    Raises HTTP 409 if the server has associated monitoring data.
    """
    service = ServerService(encryptor)
    user_ctx: UserContext = request.state.user_context

    await service.delete_server(
        user_ctx=user_ctx,
        conn=conn,
        server_id=server_id,
    )
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# PATCH /servers/{server_id}/deactivate
# ---------------------------------------------------------------------------


@router.patch("/{server_id}/deactivate")
async def deactivate_server(
    request: Request,
    server_id: int,
    conn: DBConn,
    encryptor: Encryptor,
    _: None = Depends(require_role("admin")),
) -> dict:
    """
    Soft-delete a server by setting ``is_active = false`` (Req 1.10).

    Admin only.  Preserves all historical monitoring data.
    """
    service = ServerService(encryptor)
    user_ctx: UserContext = request.state.user_context

    server = await service.deactivate_server(
        user_ctx=user_ctx,
        conn=conn,
        server_id=server_id,
    )
    return success_response(data=server.model_dump())


# ---------------------------------------------------------------------------
# PATCH /servers/{server_id}/activate
# ---------------------------------------------------------------------------


@router.patch("/{server_id}/activate")
async def activate_server(
    request: Request,
    server_id: int,
    conn: DBConn,
    encryptor: Encryptor,
    _: None = Depends(require_role("admin")),
) -> dict:
    """
    Reactivate a server by setting ``is_active = true``.

    Admin only.  Preserves all historical monitoring data.
    """
    service = ServerService(encryptor)
    user_ctx: UserContext = request.state.user_context

    server = await service.activate_server(
        user_ctx=user_ctx,
        conn=conn,
        server_id=server_id,
    )
    return success_response(data=server.model_dump())

