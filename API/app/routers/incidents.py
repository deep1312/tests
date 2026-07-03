"""
Incident management router.

Endpoints
---------
GET   /incidents                  — viewer+; list incidents with filters (paginated)
GET   /incidents/{incident_id}    — viewer+; incident detail with associated alerts
PATCH /incidents/{incident_id}    — admin only; update root_cause

All endpoints return the standard envelope format.
Empty result sets return HTTP 200 with "data": [] (Req 8.12).

Req 8.1  — list incidents endpoint
Req 8.4  — incident detail endpoint
Req 8.10 — patch root_cause endpoint
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.core.dependencies import DBConn, require_role
from app.models.requests.incident import IncidentPatchRequest
from app.services.incident_service import IncidentService
from app.utils.envelope import success_response
from app.utils.pagination import PaginationParams, build_pagination_meta

router = APIRouter(prefix="/incidents", tags=["incidents"])

_service = IncidentService()


# ---------------------------------------------------------------------------
# GET /incidents
# ---------------------------------------------------------------------------


@router.get("")
async def list_incidents(
    request: Request,
    conn: DBConn,
    pagination: PaginationParams = Depends(),
    server_id: int | None = Query(default=None, description="Filter by server ID."),
    check_id: int | None = Query(default=None, description="Filter by check ID."),
    status: int | None = Query(
        default=None,
        description="Filter by status integer (1=OPEN, 2=RESOLVED).",
    ),
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    List incidents with optional filters and pagination.

    Req 8.1  — filter by server_id, check_id, status.
    Req 8.5  — pagination via limit/offset.
    Req 8.6  — ordered by started_at DESC.
    Req 8.7  — filter by status to view only open or resolved incidents.
    Req 8.12 — empty result returns HTTP 200 with data: [].
    """
    incidents, total = await _service.list_incidents(
        conn=conn,
        server_id=server_id,
        check_id=check_id,
        status=status,
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

    return success_response(
        data=[i.model_dump() for i in incidents],
        pagination=build_pagination_meta(total, pagination.limit, pagination.offset),
        filters=filters if filters else None,
    )


# ---------------------------------------------------------------------------
# GET /incidents/{incident_id}
# ---------------------------------------------------------------------------


@router.get("/{incident_id}")
async def get_incident(
    incident_id: int,
    request: Request,
    conn: DBConn,
    _: None = Depends(require_role("viewer")),
) -> dict:
    """
    Return a single incident with its associated alerts.

    Req 8.4  — detail includes associated alerts ordered by triggered_at ASC.
    Req 8.8  — duration_seconds for OPEN incidents.
    Req 8.9  — duration_seconds for RESOLVED incidents.
    Req 8.11 — first_alert_at / last_alert_at derived from associated alerts.
    """
    incident = await _service.get_incident_detail(conn=conn, incident_id=incident_id)
    return success_response(data=incident.model_dump())


# ---------------------------------------------------------------------------
# PATCH /incidents/{incident_id}
# ---------------------------------------------------------------------------


@router.patch("/{incident_id}")
async def patch_incident(
    incident_id: int,
    body: IncidentPatchRequest,
    request: Request,
    conn: DBConn,
    _: None = Depends(require_role("admin")),
) -> dict:
    """
    Update the root_cause of an incident (admin only).

    Req 8.10 — admin only; root_cause is the only writable field.
    """
    user_context = request.state.user_context
    incident = await _service.patch_root_cause(
        conn=conn,
        incident_id=incident_id,
        root_cause=body.root_cause,
        user_role=user_context.role,
    )
    return success_response(data=incident.model_dump())
