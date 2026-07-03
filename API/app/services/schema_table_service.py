from __future__ import annotations

import logging
from typing import Any

import asyncpg
from fastapi import HTTPException

from app.models.requests.schema_table import SchemaTableCreateRequest, SchemaTableUpdateRequest
from app.models.responses.auth import UserContext
from app.models.responses.schema_table import SchemaTableResponse
from app.repositories import schema_table_repo
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)

_audit_service = AuditService()


class SchemaTableService:

    async def get_schema_table(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        record_id: int,
    ) -> SchemaTableResponse:
        row = await schema_table_repo.get_schema_table(conn, record_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Table count config record not found.")
        return SchemaTableResponse(**row)

    async def list_schema_tables(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[SchemaTableResponse], int]:
        rows, total = await schema_table_repo.list_schema_tables(
            conn,
            limit=limit,
            offset=offset,
        )
        return [SchemaTableResponse(**row) for row in rows], total

    async def create_schema_table(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        request: SchemaTableCreateRequest,
    ) -> SchemaTableResponse:
        data: dict[str, Any] = {
            "schema_name": request.schema_name,
            "table_name": request.table_name,
        }

        try:
            row = await schema_table_repo.create_schema_table(conn, data)
        except Exception as exc:
            if "unique" in str(exc).lower() or "uq_table_count_config" in str(exc):
                raise HTTPException(
                    status_code=409,
                    detail="This schema/table combination already exists.",
                )
            raise

        try:
            await _audit_service.log(
                conn=conn,
                user_id=user_ctx.user_id,
                action="CREATE",
                resource_type="schema_table",
                resource_id=row["id"],
                payload=data,
            )
        except Exception:
            logger.warning("Failed to write audit log for table_count_config create", exc_info=True)

        return SchemaTableResponse(**row)

    async def update_schema_table(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        record_id: int,
        request: SchemaTableUpdateRequest,
    ) -> SchemaTableResponse:
        data: dict[str, Any] = {}
        for field in ("schema_name", "table_name", "display_name"):
            value = getattr(request, field, None)
            if value is not None:
                data[field] = value

        try:
            row = await schema_table_repo.update_schema_table(
                conn,
                record_id=record_id,
                data=data,
            )
        except Exception as exc:
            if "unique" in str(exc).lower() or "uq_table_count_config" in str(exc):
                raise HTTPException(
                    status_code=409,
                    detail="This schema/table combination already exists.",
                )
            raise

        if row is None:
            raise HTTPException(status_code=404, detail="Table count config record not found.")

        try:
            await _audit_service.log(
                conn=conn,
                user_id=user_ctx.user_id,
                action="UPDATE",
                resource_type="schema_table",
                resource_id=record_id,
                payload=data,
            )
        except Exception:
            logger.warning("Failed to write audit log for table_count_config update", exc_info=True)

        return SchemaTableResponse(**row)

    async def delete_schema_table(
        self,
        user_ctx: UserContext,
        conn: asyncpg.Connection,
        record_id: int,
    ) -> None:
        existing = await schema_table_repo.get_schema_table(conn, record_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Table count config record not found.")

        await schema_table_repo.delete_schema_table(conn, record_id)

        try:
            await _audit_service.log(
                conn=conn,
                user_id=user_ctx.user_id,
                action="DELETE",
                resource_type="schema_table",
                resource_id=record_id,
                payload={"record_id": record_id},
            )
        except Exception:
            logger.warning("Failed to write audit log for table_count_config delete", exc_info=True)
