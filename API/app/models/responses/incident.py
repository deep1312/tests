"""
Pydantic response models for incident endpoints.

Models
------
IncidentResponse       — one row from alerts.incidents
IncidentDetailResponse — incident with associated alerts (Req 8.4, 8.11)

Status code mappings (Req 8.3):
  incident.status: 1 → OPEN, 2 → RESOLVED
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.models.responses.alert import AlertResponse

# ---------------------------------------------------------------------------
# Status code → label mappings
# ---------------------------------------------------------------------------

INCIDENT_STATUS_MAP: dict[int, str] = {
    1: "OPEN",
    2: "RESOLVED",
}


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class IncidentResponse(BaseModel):
    """
    One row from ``alerts.incidents``.

    ``status`` is the human-readable label derived from the integer stored in
    the database (1 → OPEN, 2 → RESOLVED).

    ``duration_seconds`` is computed:
      - RESOLVED: int((ended_at - started_at).total_seconds())
      - OPEN:     int((now() - started_at).total_seconds())

    Req 8.2  — all listed fields are returned.
    Req 8.3  — status codes mapped to labels.
    Req 8.8  — duration_seconds for OPEN incidents.
    Req 8.9  — duration_seconds for RESOLVED incidents.
    Req 8.13 — timestamps are ISO 8601 UTC.
    """

    incident_id: int
    server_id: int
    check_id: int
    status: str                     # "OPEN" | "RESOLVED"
    started_at: datetime            # ISO 8601 UTC (Req 8.13)
    ended_at: datetime | None       # ISO 8601 UTC (Req 8.13)
    root_cause: str | None
    duration_seconds: int           # computed (Req 8.8, 8.9)


class IncidentDetailResponse(IncidentResponse):
    """
    Incident detail with associated alerts.

    Extends ``IncidentResponse`` with:
      - ``alerts``: all associated alerts ordered by triggered_at ASC (Req 8.4)
      - ``first_alert_at``: timestamp of the earliest associated alert (Req 8.11)
      - ``last_alert_at``: timestamp of the most recent associated alert (Req 8.11)

    Req 8.4  — detail endpoint includes associated alerts.
    Req 8.11 — first_alert_at and last_alert_at derived from associated alerts.
    """

    alerts: list[AlertResponse]
    first_alert_at: datetime | None  # ISO 8601 UTC (Req 8.13)
    last_alert_at: datetime | None   # ISO 8601 UTC (Req 8.13)
