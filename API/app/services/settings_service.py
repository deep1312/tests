"""
Settings service.
"""

import asyncpg
from typing import List
from fastapi import HTTPException, status
from app.repositories.settings_repo import get_legend_configs, update_legend_config
from app.models.responses.settings import LegendConfigResponse
from app.models.requests.settings import LegendConfigRequest

class SettingsService:
    def __init__(self, conn: asyncpg.Connection):
        self.conn = conn

    async def get_all_legend_configs(self) -> List[LegendConfigResponse]:
        configs = await get_legend_configs(self.conn)
        return [LegendConfigResponse(**c) for c in configs]

    async def update_legend(self, request: LegendConfigRequest) -> LegendConfigResponse:
        updated = await update_legend_config(
            self.conn,
            request.page_name,
            request.legend_name,
            request.is_enabled,
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Legend config '{request.legend_name}' on page '{request.page_name}' not found."
            )
        return LegendConfigResponse(**updated)
