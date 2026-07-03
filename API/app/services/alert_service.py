"""
Alert service — business logic for alert endpoints.

``AlertService`` orchestrates:
  - Status code mapping from int → string labels
  - Admin-only enforcement for acknowledge (Req 7.8)
  - Delegation to alert_repo for raw SQL

Req 7.1  — list alerts endpoint
Req 7.3  — status code mapping
Req 7.8  — acknowledge alert (admin only)
Req 7.9  — 404 / 409 on acknowledge errors
"""

from __future__ import annotations

import logging
from datetime import datetime

import asyncpg
from fastapi import HTTPException

from app.models.responses.alert import ALERT_STATUS_MAP, AlertResponse
from app.repositories import alert_repo

logger = logging.getLogger(__name__)


class AlertService:
    """
    Service layer for alert operations.

    All public methods accept an asyncpg connection so that callers can
    control transaction boundaries.
    """

    # ------------------------------------------------------------------
    # list_alerts
    # ------------------------------------------------------------------

    async def list_alerts(
        self,
        conn: asyncpg.Connection,
        server_id: int | None = None,
        check_id: int | None = None,
        status: int | None = None,
        ack_state: str | None = None,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[AlertResponse], int]:
        """
        Return a paginated list of alerts.

        Req 7.1 — filter by server_id, check_id, status, ack_state, time range.
        Req 7.3 — map status int → string label.
        Req 7.7 — default to last 24h when no time range supplied.

        Returns
        -------
        tuple[list[AlertResponse], int]
            A 2-tuple of (responses, total_count).
        """
        rows, total = await alert_repo.list_alerts(
            conn,
            server_id=server_id,
            check_id=check_id,
            status=status,
            ack_state=ack_state,
            from_dt=from_dt,
            to_dt=to_dt,
            limit=limit,
            offset=offset,
        )

        responses = [
            AlertResponse(
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
            for row in rows
        ]
        return responses, total

    # ------------------------------------------------------------------
    # acknowledge_alert
    # ------------------------------------------------------------------

    async def acknowledge_alert(
        self,
        conn: asyncpg.Connection,
        alert_id: int,
        triggered_at: datetime,
        user_role: str,
    ) -> AlertResponse:
        """
        Acknowledge an alert (admin only).

        Req 7.8 — admin-only; sets acknowledged_at to current timestamp.
        Req 7.9 — raises HTTP 404 if not found, HTTP 409 if already acknowledged.

        Parameters
        ----------
        conn:
            An asyncpg connection.
        alert_id:
            The alert's integer ID.
        triggered_at:
            The alert's trigger timestamp (partition key for composite PK lookup).
        user_role:
            The authenticated user's role; must be ``"admin"`` (Req 7.8).

        Returns
        -------
        AlertResponse
            The updated alert record.

        Raises
        ------
        HTTPException(403)
            If the user is not an admin.
        HTTPException(404)
            If the alert does not exist.
        HTTPException(409)
            If the alert is already acknowledged.
        """
        if user_role != "admin":
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "forbidden",
                    "message": "Only admin users can acknowledge alerts.",
                },
            )

        row = await alert_repo.acknowledge_alert(conn, alert_id, triggered_at)

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
