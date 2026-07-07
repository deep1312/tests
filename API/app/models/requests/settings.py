from pydantic import BaseModel, Field

class LegendConfigRequest(BaseModel):
    page_name: str = Field(..., description="The name of the page")
    legend_name: str = Field(..., description="The name of the legend")
    is_enabled: bool = Field(..., description="Whether the legend is enabled or not")
