"""
Incident service — business logic for incident endpoints.

``IncidentService`` orchestrates:
  - Status code mapping from int → string labels (Req 8.3)
  - duration_seconds computation (Req 8.8, 8.9)
  - first_alert_at / last_alert_at derivation (Req 8.11)
  - Admin-only enforcement for patch (Req 8.10)
  - Delegation to incident_repo for raw SQL

Req 8.1  — list incidents endpoint
Req 8.3  — status code mapping
Req 8.4  — detail endpoint with associated alerts
Req 8.8  — duration_seconds for OPEN incidents
Req 8.9  — duration_seconds for RESOLVED incidents
Req 8.10 — patch root_cause (admin only)
Req 8.11 — first_alert_at / last_alert_at derivation
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import asyncpg
from fastapi import HTTPException

from app.models.responses.alert import ALERT_STATUS_MAP, AlertResponse
from app.models.responses.incident import (
    INCIDENT_STATUS_MAP,
    IncidentDetailResponse,
    IncidentResponse,
)
from app.repositories import incident_repo

logger = logging.getLogger(__name__)


def _now_utc() -> datetime:
    """Return the current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


def _compute_duration_seconds(
    status_int: int,
    started_at: datetime,
    ended_at: datetime | None,
) -> int:
    """
    Compute duration_seconds for an incident.

    - RESOLVED (status=2): int((ended_at - started_at).total_seconds())
    - OPEN (status=1):     int((now() - started_at).total_seconds())

    Req 8.8 — OPEN duration uses current timestamp.
    Req 8.9 — RESOLVED duration uses ended_at.
    """
    if status_int == 2 and ended_at is not None:
        # RESOLVED
        return int((ended_at - started_at).total_seconds())
    else:
        # OPEN (or RESOLVED without ended_at — fallback to now)
        now = _now_utc()
        # Ensure started_at is timezone-aware for subtraction
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        return int((now - started_at).total_seconds())


def _build_incident_response(row: dict) -> IncidentResponse:
    """Build an IncidentResponse from a raw DB row dict."""
    status_int = row["status"]
    return IncidentResponse(
        incident_id=row["incident_id"],
        server_id=row["server_id"],
        check_id=row["check_id"],
        status=INCIDENT_STATUS_MAP.get(status_int, str(status_int)),
        started_at=row["started_at"],
        ended_at=row.get("ended_at"),
        root_cause=row.get("root_cause"),
        duration_seconds=_compute_duration_seconds(
            status_int, row["started_at"], row.get("ended_at")
        ),
    )


def _build_alert_response(row: dict) -> AlertResponse:
    """Build an AlertResponse from a raw DB row dict."""
    return AlertResponse(
        alert_id=row["alert_id"],
        triggered_at=row["triggered_at"],
        incident_id=row.get("incident_id"),
        server_id=row["server_id"],
        check_id=row["check_id"],
        metric_name=row["metric_name"],
        observed_value=row.get("observed_value"),
        status=ALERT_STATUS_MAP.get(row["status"], str(row["status"])),
        acknowledged_at=row.get("acknowledged_at"),
    )


class IncidentService:
    """
    Service layer for incident operations.

    All public methods accept an asyncpg connection so that callers can
    control transaction boundaries.
    """

    # ------------------------------------------------------------------
    # list_incidents
    # ------------------------------------------------------------------

    async def list_incidents(
        self,
        conn: asyncpg.Connection,
        server_id: int | None = None,
        check_id: int | None = None,
        status: int | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[IncidentResponse], int]:
        """
        Return a paginated list of incidents.

        Req 8.1 — filter by server_id, check_id, status.
        Req 8.3 — map status int → string label.
        Req 8.6 — ordered by started_at DESC.

        Returns
        -------
        tuple[list[IncidentResponse], int]
            A 2-tuple of (responses, total_count).
        """
        rows, total = await incident_repo.list_incidents(
            conn,
            server_id=server_id,
            check_id=check_id,
            status=status,
            limit=limit,
            offset=offset,
        )

        responses = [_build_incident_response(row) for row in rows]
        return responses, total

    # ------------------------------------------------------------------
    # get_incident_detail
    # ------------------------------------------------------------------

    async def get_incident_detail(
        self,
        conn: asyncpg.Connection,
        incident_id: int,
    ) -> IncidentDetailResponse:
        """
        Return a single incident with its associated alerts.

        Req 8.4  — detail includes associated alerts ordered by triggered_at ASC.
        Req 8.8  — duration_seconds for OPEN incidents.
        Req 8.9  — duration_seconds for RESOLVED incidents.
        Req 8.11 — first_alert_at / last_alert_at derived from associated alerts.

        Returns
        -------
        IncidentDetailResponse
            The incident with associated alerts and derived fields.

        Raises
        ------
        HTTPException(404)
            If the incident does not exist.
        """
        row = await incident_repo.get_incident(conn, incident_id)
        if row is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "not_found",
                    "message": f"Incident {incident_id} not found.",
                },
            )

        alert_rows = await incident_repo.get_incident_alerts(conn, incident_id)
        alert_responses = [_build_alert_response(a) for a in alert_rows]

        # Derive first_alert_at and last_alert_at from associated alerts (Req 8.11)
        first_alert_at: datetime | None = None
        last_alert_at: datetime | None = None
        if alert_responses:
            # Alerts are ordered by triggered_at ASC from the repo
            first_alert_at = alert_responses[0].triggered_at
            last_alert_at = alert_responses[-1].triggered_at

        status_int = row["status"]
        return IncidentDetailResponse(
            incident_id=row["incident_id"],
            server_id=row["server_id"],
            check_id=row["check_id"],
            status=INCIDENT_STATUS_MAP.get(status_int, str(status_int)),
            started_at=row["started_at"],
            ended_at=row.get("ended_at"),
            root_cause=row.get("root_cause"),
            duration_seconds=_compute_duration_seconds(
                status_int, row["started_at"], row.get("ended_at")
            ),
            alerts=alert_responses,
            first_alert_at=first_alert_at,
            last_alert_at=last_alert_at,
        )

    # ------------------------------------------------------------------
    # patch_root_cause
    # ------------------------------------------------------------------

    async def patch_root_cause(
        self,
        conn: asyncpg.Connection,
        incident_id: int,
        root_cause: str,
        user_role: str,
    ) -> IncidentResponse:
        """
        Update the root_cause of an incident (admin only).

        Req 8.10 — admin only; root_cause is the only writable field.

        Parameters
        ----------
        conn:
            An asyncpg connection.
        incident_id:
            The incident's integer ID.
        root_cause:
            The new root cause text.
        user_role:
            The authenticated user's role; must be ``"admin"`` (Req 8.10).

        Returns
        -------
        IncidentResponse
            The updated incident record.

        Raises
        ------
        HTTPException(403)
            If the user is not an admin.
        HTTPException(404)
            If the incident does not exist.
        """
        if user_role != "admin":
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "forbidden",
                    "message": "Only admin users can update incident root cause.",
                },
            )

        row = await incident_repo.patch_root_cause(conn, incident_id, root_cause)
        if row is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "not_found",
                    "message": f"Incident {incident_id} not found.",
                },
            )

        return _build_incident_response(row)
