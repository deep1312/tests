"""
Pydantic response models for check management endpoints.

``CheckResponse``          — returned by all check read/write endpoints.
``MappingResponse``        — returned by all mapping read/write endpoints.
``CheckHealthSummaryItem`` — returned by the check health summary endpoint
                             (Req 4a).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CheckResponse(BaseModel):
    """All fields for a health check record from ``config.checks_master``."""

    check_id: int
    check_code: str
    category: str
    check_name: str
    query_text: str
    timeout_ms: int | None
    default_frequency_sec: int | None
    is_active: bool
    created_at: datetime | None  # ISO 8601 UTC
    updated_at: datetime | None   # ISO 8601 UTC
    version: int


class MappingResponse(BaseModel):
    """All fields for a server-check mapping from
    ``config.server_checks_mapping``.

    ``consecutive_failures`` and ``backoff_until`` are Collector-owned fields
    and are included here as read-only values (Req 2.6).
    """

    mapping_id: int
    server_id: int
    check_id: int
    custom_frequency_sec: int | None
    is_enabled: bool
    consecutive_failures: int
    backoff_until: datetime | None  # ISO 8601 UTC
    updated_at: datetime            # ISO 8601 UTC


class CheckHealthSummaryItem(BaseModel):
    """Derived health state for a single (server_id, check_id) pair.

    ``health_state`` is one of ``HEALTHY``, ``FLAKY``, or ``FAILING``
    (Req 4a.3).
    """

    server_id: int
    check_id: int
    last_success_at: datetime | None  # ISO 8601 UTC; None if never succeeded
    consecutive_failures: int
    failure_rate_pct: float
    health_state: Literal["HEALTHY", "FLAKY", "FAILING"]
