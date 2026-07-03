"""
Pydantic request models for incident endpoints.

Models
------
IncidentPatchRequest — body for PATCH /incidents/{incident_id}
"""

from __future__ import annotations

from pydantic import BaseModel


class IncidentPatchRequest(BaseModel):
    """
    Request body for patching an incident's root_cause.

    ``root_cause`` is the only Incident field writable by the API — all other
    Incident fields are Collector-owned and must not be modified through the
    API (Req 8.10).
    """

    root_cause: str  # required (Req 8.10)
