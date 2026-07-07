from pydantic import BaseModel, ConfigDict

class LegendConfigResponse(BaseModel):
    id: int
    page_name: str
    legend_name: str
    is_enabled: bool
    admin_only: bool

    model_config = ConfigDict(from_attributes=True)
