from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response

from app.core.dependencies import DBConn, require_role
from app.models.requests.schema_table import SchemaTableCreateRequest, SchemaTableUpdateRequest
from app.models.responses.auth import UserContext
from app.services.schema_table_service import SchemaTableService
from app.utils.envelope import success_response
from app.utils.pagination import PaginationParams, build_pagination_meta

router = APIRouter(prefix="/schema-tables", tags=["schema-tables"])


@router.get("")
async def list_schema_tables(
    request: Request,
    conn: DBConn,
    pagination: PaginationParams = Depends(),
    _: None = Depends(require_role("viewer")),
) -> dict:
    service = SchemaTableService()
    user_ctx: UserContext = request.state.user_context

    records, total = await service.list_schema_tables(
        user_ctx=user_ctx,
        conn=conn,
        limit=pagination.limit,
        offset=pagination.offset,
    )

    return success_response(
        data=[r.model_dump() for r in records],
        pagination=build_pagination_meta(total, pagination.limit, pagination.offset),
    )


@router.post("", status_code=201)
async def create_schema_table(
    request: Request,
    body: SchemaTableCreateRequest,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> dict:
    service = SchemaTableService()
    user_ctx: UserContext = request.state.user_context

    record = await service.create_schema_table(
        user_ctx=user_ctx,
        conn=conn,
        request=body,
    )
    return success_response(data=record.model_dump())


@router.get("/{record_id}")
async def get_schema_table(
    request: Request,
    record_id: int,
    conn: DBConn,
    _: None = Depends(require_role("viewer")),
) -> dict:
    service = SchemaTableService()
    user_ctx: UserContext = request.state.user_context

    record = await service.get_schema_table(
        user_ctx=user_ctx,
        conn=conn,
        record_id=record_id,
    )
    return success_response(data=record.model_dump())


@router.put("/{record_id}")
async def update_schema_table(
    request: Request,
    record_id: int,
    body: SchemaTableUpdateRequest,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> dict:
    service = SchemaTableService()
    user_ctx: UserContext = request.state.user_context

    record = await service.update_schema_table(
        user_ctx=user_ctx,
        conn=conn,
        record_id=record_id,
        request=body,
    )
    return success_response(data=record.model_dump())


@router.delete("/{record_id}")
async def delete_schema_table(
    request: Request,
    record_id: int,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> Response:
    service = SchemaTableService()
    user_ctx: UserContext = request.state.user_context

    await service.delete_schema_table(
        user_ctx=user_ctx,
        conn=conn,
        record_id=record_id,
    )
    return Response(status_code=204)
