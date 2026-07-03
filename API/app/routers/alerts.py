"""
Alert management router.

Endpoints
---------
GET  /alerts                        — viewer+; list alerts with filters (paginated)
POST /alerts/{alert_id}/acknowledge — admin only; acknowledge an alert

All endpoints return the standard envelope format.
Empty result sets return HTTP 200 with "data": [] (Req 7.10).

Req 7.1  — list alerts endpoint
Req 7.8  — acknowledge alert endpoint
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request

from app.core.dependencies import DBConn, require_role
from app.models.requests.alert import AcknowledgeRequest
from app.services.alert_service import AlertService
from app.utils.envelope import success_response
from app.utils.pagination import PaginationParams, build_pagination_meta

router = APIRouter(prefix="/alerts", tags=["alerts"])

_service = AlertService()


# ---------------------------------------------------------------------------
# GET /alerts
# ---------------------------------------------------------------------------


@router.get("")
async def list_alerts(
    request: Request,
    conn: DBConn,
    pagination: PaginationParams = Depends(),
    server_id: int | None = Query(default=None, description="Filter by server ID."),
    check_id: int | None = Query(default=None, description="Filter by check ID."),
    status: int | None = Query(
        default=None,
        description="Filter by status integer (1=WARNING, 2=CRITICAL).",
    ),
    ack_state: str | None = Query(
        default=None,
        description=(
            "Filter by acknowledgement state: "
            "'unacknowledged', 'acknowledged', or omit for all."
        ),
    ),
    from_dt: datetime | None = Query(
        default=None,
        alias="from",
        description="Lower bound for triggered_at (ISO 8601). Defaults to 24h ago.",
    ),
    to_dt: datetime | None = Query(
        default=None,
        alias="to",
        description="Upper bound for triggered_at (ISO 8601). Defaults to now.",
    ),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    List alerts with optional filters and pagination.

    Req 7.1  — filter by server_id, check_id, status, ack_state, from, to.
    Req 7.5  — pagination via limit/offset.
    Req 7.6  — ordered by triggered_at DESC.
    Req 7.7  — defaults to last 24h when no time range supplied.
    Req 7.10 — empty result returns HTTP 200 with data: [].
    """
    alerts, total = await _service.list_alerts(
        conn=conn,
        server_id=server_id,
        check_id=check_id,
        status=status,
        ack_state=ack_state,
        from_dt=from_dt,
        to_dt=to_dt,
        limit=pagination.limit,
        offset=pagination.offset,
    )

    filters: dict = {}
    if server_id is not None:
        filters["server_id"] = server_id
    if check_id is not None:
        filters["check_id"] = check_id
    if status is not None:
        filters["status"] = status
    if ack_state is not None:
        filters["ack_state"] = ack_state
    if from_dt is not None:
        filters["from"] = from_dt.isoformat()
    if to_dt is not None:
        filters["to"] = to_dt.isoformat()

    return success_response(
        data=[a.model_dump() for a in alerts],
        pagination=build_pagination_meta(total, pagination.limit, pagination.offset),
        filters=filters if filters else None,
    )


# ---------------------------------------------------------------------------
# POST /alerts/{alert_id}/acknowledge
# ---------------------------------------------------------------------------


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    body: AcknowledgeRequest,
    request: Request,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> dict:
    """
    Acknowledge an alert by its composite PK (alert_id, triggered_at).

    Req 7.8 — admin only; sets acknowledged_at to current timestamp.
    Req 7.9 — returns HTTP 404 if not found, HTTP 409 if already acknowledged.
    """
    user_context = request.state.user_context
    alert = await _service.acknowledge_alert(
        conn=conn,
        alert_id=alert_id,
        triggered_at=body.triggered_at,
        user_role=user_context.role,
    )

    return success_response(data=alert.model_dump())
