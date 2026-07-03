"""
Pydantic request models for alert endpoints.

Models
------
AcknowledgeRequest — body for POST /alerts/{alert_id}/acknowledge
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AcknowledgeRequest(BaseModel):
    """
    Request body for acknowledging an alert.

    ``triggered_at`` is required because the alerts table is partitioned by
    time and the composite primary key is ``(alert_id, triggered_at)`` — both
    values are needed to locate the exact partition and row (Req 7.8).
    """

    triggered_at: datetime  # required for composite PK lookup (Req 7.8)
