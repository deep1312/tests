from datetime import datetime

from pydantic import BaseModel


class SchemaTableResponse(BaseModel):
    id: int
    schema_name: str
    table_name: str
    display_name: str | None = None
    is_active: bool
    created_on: datetime | None = None
