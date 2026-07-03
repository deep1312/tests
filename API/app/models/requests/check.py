"""
Pydantic request models for check management endpoints.

``CheckCreateRequest``   — body accepted by ``POST /api/v1/checks``.
``CheckUpdateRequest``   — body accepted by ``PUT /api/v1/checks/{check_id}``.
``MappingCreateRequest`` — body accepted by ``POST /api/v1/mappings``.
``MappingUpdateRequest`` — body accepted by ``PUT /api/v1/mappings/{mapping_id}``.
"""

from __future__ import annotations

from pydantic import BaseModel, field_validator


class CheckCreateRequest(BaseModel):
    """Fields required to create a new health check in ``config.checks_master``.

    Req 2.2 — ``check_code``, ``category``, ``check_name``, and ``query_text``
    are mandatory.
    Req 2.10 — ``timeout_ms`` must be a positive integer when provided.
    """

    check_code: str
    category: str
    check_name: str
    query_text: str
    timeout_ms: int | None = None
    default_frequency_sec: int | None = None
    is_active: bool = True
    description: str | None = None

    @field_validator("timeout_ms")
    @classmethod
    def timeout_must_be_positive(cls, v: int | None) -> int | None:
        """Req 2.10 — timeout_ms must be a positive integer when provided."""
        if v is not None and v <= 0:
            raise ValueError("timeout_ms must be a positive integer")
        return v

    @field_validator("default_frequency_sec")
    @classmethod
    def frequency_must_be_positive(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("default_frequency_sec must be a positive integer")
        return v


class CheckUpdateRequest(BaseModel):
    """Partial-update body for ``PUT /api/v1/checks/{check_id}``.

    All fields are optional to support partial updates.

    The optional ``version`` field enables optimistic locking (Req 2.14):
    when supplied the API compares it against the stored version and rejects
    the request with HTTP 409 if they differ.

    Req 2.10 — ``timeout_ms`` must be a positive integer when provided.
    """

    check_code: str | None = None
    category: str | None = None
    check_name: str | None = None
    query_text: str | None = None
    timeout_ms: int | None = None
    default_frequency_sec: int | None = None
    is_active: bool | None = None
    description: str | None = None
    version: int | None = None  # optimistic locking (Req 2.14)

    @field_validator("timeout_ms")
    @classmethod
    def timeout_must_be_positive(cls, v: int | None) -> int | None:
        """Req 2.10 — timeout_ms must be a positive integer when provided."""
        if v is not None and v <= 0:
            raise ValueError("timeout_ms must be a positive integer")
        return v

    @field_validator("default_frequency_sec")
    @classmethod
    def frequency_must_be_positive(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("default_frequency_sec must be a positive integer")
        return v


class MappingCreateRequest(BaseModel):
    """Fields required to create a new server-check mapping in
    ``config.server_checks_mapping``.

    ``custom_frequency_sec`` must be a positive integer when provided.
    """

    server_id: int
    check_id: int
    custom_frequency_sec: int | None = None
    is_enabled: bool = True

    @field_validator("custom_frequency_sec")
    @classmethod
    def frequency_must_be_positive(cls, v: int | None) -> int | None:
        """custom_frequency_sec must be a positive integer when provided."""
        if v is not None and v <= 0:
            raise ValueError("custom_frequency_sec must be a positive integer")
        return v


class MappingUpdateRequest(BaseModel):
    """Partial-update body for ``PUT /api/v1/mappings/{mapping_id}``.

    Req 2.6 — only ``custom_frequency_sec`` and ``is_enabled`` may be updated
    through the API.  ``consecutive_failures`` and ``backoff_until`` are
    managed exclusively by the Collector and MUST NOT appear here.
    """

    custom_frequency_sec: int | None = None
    is_enabled: bool | None = None

    @field_validator("custom_frequency_sec")
    @classmethod
    def frequency_must_be_positive(cls, v: int | None) -> int | None:
        """custom_frequency_sec must be a positive integer when provided."""
        if v is not None and v <= 0:
            raise ValueError("custom_frequency_sec must be a positive integer")
        return v
