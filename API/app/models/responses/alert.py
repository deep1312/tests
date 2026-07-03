"""
Pydantic response models for alert endpoints.

Models
------
AlertResponse — one row from alerts.alerts

Status code mappings (Req 7.3):
  alert.status: 1 → WARNING, 2 → CRITICAL
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Status code → label mappings
# ---------------------------------------------------------------------------

ALERT_STATUS_MAP: dict[int, str] = {
    1: "WARNING",
    2: "CRITICAL",
}


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class AlertResponse(BaseModel):
    """
    One row from ``alerts.alerts``.

    ``status`` is the human-readable label derived from the integer stored in
    the database (1 → WARNING, 2 → CRITICAL).

    Req 7.2 — all listed fields are returned.
    Req 7.3 — status codes mapped to labels.
    Req 7.11 — timestamps are ISO 8601 UTC.
    """

    alert_id: int
    triggered_at: datetime          # ISO 8601 UTC (Req 7.11)
    incident_id: int | None
    server_id: int
    check_id: int
    metric_name: str
    observed_value: float | None
    status: str                     # "WARNING" | "CRITICAL"
    acknowledged_at: datetime | None  # ISO 8601 UTC (Req 7.11)
