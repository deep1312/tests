"""
Pydantic request models for server management endpoints.

``ServerCreateRequest`` — body accepted by ``POST /api/v1/servers``.
``ServerUpdateRequest`` — body accepted by ``PUT /api/v1/servers/{server_id}``.
"""

from __future__ import annotations

from pydantic import BaseModel, model_validator


class ServerCreateRequest(BaseModel):
    """Fields required to register a new monitored PostgreSQL server."""

    server_label: str
    server_ip: str
    port: int = 5432
    db_name: str
    username: str
    password: str  # plaintext; encrypted before storage
    server_role: str | None = None
    env_type: str | None = None
    ssl_mode: str = "prefer"
    retention_metrics_days: int = 365
    retention_logs_days: int = 30
    retention_runs_days: int = 7
    compression_days: int = 7
    tags: dict | None = None
    is_active: bool = True
    is_di_server: bool = False

    @model_validator(mode="after")
    def retention_constraint(self) -> "ServerCreateRequest":
        """Req 1.7 — retention_metrics_days must be >= retention_logs_days."""
        if self.retention_metrics_days < self.retention_logs_days:
            raise ValueError(
                "retention_metrics_days must be >= retention_logs_days"
            )
        return self


class ServerUpdateRequest(BaseModel):
    """
    Partial-update body for ``PUT /api/v1/servers/{server_id}``.

    All fields are optional to support partial updates.  When both
    ``retention_metrics_days`` and ``retention_logs_days`` are supplied the
    same constraint as on create is enforced (Req 1.7).

    The optional ``version`` field enables optimistic locking (Req 1.13):
    when supplied the API compares it against the stored version and rejects
    the request with HTTP 409 if they differ.
    """

    server_label: str | None = None
    server_ip: str | None = None
    port: int | None = None
    db_name: str | None = None
    username: str | None = None
    password: str | None = None  # plaintext; encrypted before storage
    server_role: str | None = None
    env_type: str | None = None
    ssl_mode: str | None = None
    retention_metrics_days: int | None = None
    retention_logs_days: int | None = None
    retention_runs_days: int | None = None
    compression_days: int | None = None
    tags: dict | None = None
    is_active: bool | None = None
    is_di_server: bool | None = None
    version: int | None = None  # optimistic locking (Req 1.13)

    @model_validator(mode="after")
    def retention_constraint(self) -> "ServerUpdateRequest":
        """Req 1.7 — enforce constraint only when both fields are provided."""
        metrics = self.retention_metrics_days
        logs = self.retention_logs_days
        if metrics is not None and logs is not None and metrics < logs:
            raise ValueError(
                "retention_metrics_days must be >= retention_logs_days"
            )
        return self
