"""
Pydantic request models for threshold management endpoints.

``ThresholdCreateRequest`` — body accepted by ``POST /api/v1/thresholds``.
``ThresholdUpdateRequest`` — body accepted by ``PUT /api/v1/thresholds/{threshold_id}``.
"""

from __future__ import annotations

from pydantic import BaseModel, field_validator

# Valid comparison operators (Req 3.3)
_VALID_OPERATORS = {">", "<", "=", "!=", "~"}


class ThresholdCreateRequest(BaseModel):
    """Fields required to create a new check threshold."""

    check_id: int
    metric_name: str
    comparison_operator: str
    server_id: int | None = None
    warning_value: float | None = None
    critical_value: float | None = None
    is_active: bool = True

    @field_validator("comparison_operator")
    @classmethod
    def validate_operator(cls, v: str) -> str:
        if v not in _VALID_OPERATORS:
            raise ValueError(
                f"Must be one of: {', '.join(sorted(_VALID_OPERATORS))}"
            )
        return v


class ThresholdUpdateRequest(BaseModel):
    """
    Partial-update body for ``PUT /api/v1/thresholds/{threshold_id}``.
    All fields are optional to support partial updates.
    """

    check_id: int | None = None
    metric_name: str | None = None
    comparison_operator: str | None = None
    server_id: int | None = None
    warning_value: float | None = None
    critical_value: float | None = None
    is_active: bool | None = None
    version: int | None = None

    @field_validator("comparison_operator")
    @classmethod
    def validate_operator(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_OPERATORS:
            raise ValueError(
                f"Must be one of: {', '.join(sorted(_VALID_OPERATORS))}"
            )
        return v
