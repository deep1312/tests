from pydantic import BaseModel, field_validator


class SchemaTableCreateRequest(BaseModel):
    schema_name: str
    table_name: str

    @field_validator("schema_name", "table_name")
    @classmethod
    def must_not_be_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Value must not be empty.")
        return stripped


class SchemaTableUpdateRequest(BaseModel):
    schema_name: str | None = None
    table_name: str | None = None
    version: int | None = None

    @field_validator("schema_name", "table_name")
    @classmethod
    def must_not_be_empty(cls, v: str | None) -> str | None:
        if v is not None:
            stripped = v.strip()
            if not stripped:
                raise ValueError("Value must not be empty.")
            return stripped
        return v
