"""
Settings router.
"""

from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import DBConn, require_role
from app.models.requests.settings import LegendConfigRequest
from app.models.responses.settings import LegendConfigResponse
from app.services.settings_service import SettingsService
from app.utils.envelope import success_response

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("/legends", status_code=status.HTTP_200_OK)
async def get_all_legend_configs(
    conn: DBConn,
    _: None = Depends(require_role("viewer")),
) -> dict:
    service = SettingsService(conn)
    configs = await service.get_all_legend_configs()
    return success_response([c.model_dump() for c in configs])


@router.post("/legend", status_code=status.HTTP_200_OK)
async def update_legend_config(
    body: LegendConfigRequest,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> dict:
    service = SettingsService(conn)
    config = await service.update_legend(body)
    return success_response(config.model_dump())
