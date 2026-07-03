"""
Pydantic settings for the PostgreSQL Health Monitoring Platform API.

All configuration is loaded from environment variables (or a .env file).
Use `get_settings()` to obtain the singleton instance.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ------------------------------------------------------------------ #
    # Database
    # ------------------------------------------------------------------ #
    DATABASE_URL: str

    # ------------------------------------------------------------------ #
    # Credential encryption
    # ------------------------------------------------------------------ #
    # Must be a base64-encoded 32-byte key (44 characters of base64).
    CREDENTIAL_ENCRYPTION_KEY: str

    # ------------------------------------------------------------------ #
    # JWT authentication
    # ------------------------------------------------------------------ #
    JWT_SECRET: str
    JWT_EXPIRY_SECONDS: int = 3600

    # ------------------------------------------------------------------ #
    # Connection validation
    # ------------------------------------------------------------------ #
    CONNECTION_VALIDATION_MODE: str = "strict"

    # ------------------------------------------------------------------ #
    # CORS
    # ------------------------------------------------------------------ #
    CORS_ORIGINS: list[str] = ["*"]

    # ------------------------------------------------------------------ #
    # Operational thresholds
    # ------------------------------------------------------------------ #
    STALENESS_THRESHOLD_SECS: int = 300       # 5 minutes
    RATE_LIMIT_RPM: int = 60                  # requests per minute per user
    DB_STATEMENT_TIMEOUT_MS: int = 30_000     # 30 seconds
    HIGH_COST_DAYS_THRESHOLD: int = 7         # days before query is "high cost"

    # ------------------------------------------------------------------ #
    # Validators
    # ------------------------------------------------------------------ #

    @field_validator("CREDENTIAL_ENCRYPTION_KEY")
    @classmethod
    def credential_key_must_be_present(cls, v: str) -> str:
        """Req 11.4 — key must be non-empty."""
        if not v or not v.strip():
            raise ValueError(
                "CREDENTIAL_ENCRYPTION_KEY must be set to a non-empty "
                "base64-encoded 32-byte key."
            )
        return v

    @field_validator("CONNECTION_VALIDATION_MODE")
    @classmethod
    def connection_mode_must_be_valid(cls, v: str) -> str:
        """Only 'strict' or 'warn' are accepted."""
        allowed = {"strict", "warn"}
        if v not in allowed:
            raise ValueError(
                f"CONNECTION_VALIDATION_MODE must be one of {sorted(allowed)!r}, "
                f"got {v!r}."
            )
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached application settings singleton."""
    return Settings()
