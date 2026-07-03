"""
Pydantic response models for threshold management endpoints.

``ThresholdResponse`` — returned by all threshold read/write endpoints.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ThresholdResponse(BaseModel):
    """All fields for a check threshold record."""

    threshold_id: int
    check_id: int
    server_id: int | None
    metric_name: str
    comparison_operator: str
    warning_value: float | None = None
    critical_value: float | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    version: int
