"""
Pydantic response models for server management endpoints.

``ServerResponse`` — returned by all server read/write endpoints.

Security note: ``password_encrypted`` is intentionally absent from this model
and must never be added (Req 1.3, 11.2).
"""

from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class ServerResponse(BaseModel):
    """
    All non-sensitive fields for a monitored PostgreSQL server.

    ``password_encrypted`` is NEVER included (Req 1.3).

    ``warnings`` is populated when connection validation runs in warn-mode and
    the target server could not be reached (Req 1.11).
    """

    server_id: int
    server_label: str
    server_ip: str
    port: int
    db_name: str
    username: str
    # password_encrypted is intentionally excluded
    server_role: str | None
    env_type: str | None
    ssl_mode: str | None
    retention_metrics_days: int
    retention_logs_days: int
    retention_runs_days: int
    compression_days: int
    tags: dict | None
    is_active: bool
    is_di_server: bool = Field(default=False)
    last_heartbeat: datetime | None  # ISO 8601 UTC (Req 1.14)
    created_at: datetime             # ISO 8601 UTC (Req 1.14)
    updated_at: datetime             # ISO 8601 UTC (Req 1.14)
    
    # Updated to handle NULLs from DB and satisfy Req 1.13 (Optimistic Locking) baseline
    version: int = Field(default=1)
    
    warnings: list[str] | None = None  # warn-mode connection validation (Req 1.11)
    
    class Config:
        from_attributes = True  # Allows Pydantic to read data from SQLAlchemy/Row objects