"""
Pydantic response models for dashboard endpoints.

Models
------
TopFailingCheck         — one entry in the top-failing-checks list
DashboardSummaryItem    — per-server aggregated health summary row
DashboardSummaryResponse — full dashboard summary payload
PerServerHealthResponse — one check's latest run info for a server
MetricChartResponse     — one time-bucket from the metrics chart query

Status code mappings (Req 9.1):
  latest_run_status: 1 → SUCCESS, 2 → FAILED, 3 → TIMEOUT
  collector_state:   ACTIVE | STALE
  health_trend:      IMPROVING | DEGRADING | STABLE

Req 9.1  — dashboard summary endpoint returns aggregated health per active server
Req 9.3  — per-server health endpoint returns last N check runs grouped by check
Req 9.4  — metrics chart endpoint returns time-bucketed aggregates
Req 9.7  — top_failing_checks array with top 5 checks by failure count (last 24h)
Req 9.8  — health_trend computed from 6h window comparison
Req 9.10 — collector_state derived from last_heartbeat staleness
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Status code → label mapping for latest_run_status
# ---------------------------------------------------------------------------

LATEST_RUN_STATUS_MAP: dict[int, str] = {
    1: "SUCCESS",
    2: "FAILED",
    3: "TIMEOUT",
}


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class TopFailingCheck(BaseModel):
    """
    One entry in the top-failing-checks list.

    Represents a single check ranked by failure count in the last 24 hours.

    Req 9.7 — top 5 checks by failure count in last 24h; each entry includes
    check_id, check_name, and failure_count.

    Attributes
    ----------
    check_id : int
        Primary key of the check in config.checks_master.
    check_name : str
        Human-readable name of the check.
    failure_count : int
        Number of failed or timed-out runs in the last 24 hours.
    """

    check_id: int = Field(..., description="Primary key of the check")
    check_name: str = Field(..., description="Human-readable check name")
    failure_count: int = Field(..., ge=0, description="Failure count in last 24h")


class DashboardSummaryItem(BaseModel):
    """
    Per-server aggregated health summary row.

    Represents the current health status of a single active server, including
    incident and alert counts, latest check run status, health trend, and
    collector connectivity state.

    Req 9.1  — fields returned per active server.
    Req 9.8  — health_trend derived from 6h window comparison.
    Req 9.9  — retention fields included.
    Req 9.10 — collector_state derived from last_heartbeat staleness.

    Attributes
    ----------
    server_id : int
        Primary key of the server in config.servers.
    server_label : str
        Human-readable label for the server.
    env_type : str | None
        Environment type (e.g., "prod", "staging", "dev").
    server_role : str | None
        Role of the server (e.g., "primary", "replica").
    last_heartbeat : datetime | None
        Timestamp of the most recent heartbeat from the collector (ISO 8601 UTC).
    open_incident_count : int
        Number of open incidents (status = OPEN) for this server.
    unack_alert_count : int
        Number of unacknowledged alerts triggered in the last 24 hours.
    latest_run_status : str | None
        Status of the most recent check run: "SUCCESS", "FAILED", "TIMEOUT", or None.
    health_trend : str
        Trend indicator: "IMPROVING" (failure rate decreased), "DEGRADING"
        (failure rate increased), or "STABLE" (no change) over the last 6h.
    collector_state : str
        Connectivity state: "ACTIVE" if last_heartbeat is recent, "STALE" if
        older than the staleness threshold or NULL.
    retention_metrics_days : int
        Number of days metrics are retained for this server.
    retention_logs_days : int
        Number of days logs are retained for this server.
    """

    server_id: int = Field(..., description="Primary key of the server")
    server_label: str = Field(..., description="Human-readable server label")
    env_type: str | None = Field(None, description="Environment type (prod/staging/dev)")
    server_role: str | None = Field(None, description="Server role (primary/replica)")
    last_heartbeat: datetime | None = Field(None, description="Last heartbeat timestamp (ISO 8601 UTC)")
    open_incident_count: int = Field(..., ge=0, description="Count of open incidents")
    unack_alert_count: int = Field(..., ge=0, description="Count of unacknowledged alerts (last 24h)")
    latest_run_status: str | None = Field(
        None,
        description="Latest check run status: SUCCESS, FAILED, TIMEOUT, or None"
    )
    health_trend: str = Field(
        ...,
        description="Health trend: IMPROVING, DEGRADING, or STABLE"
    )
    collector_state: str = Field(
        ...,
        description="Collector connectivity state: ACTIVE or STALE"
    )
    retention_metrics_days: int = Field(..., ge=1, description="Metrics retention in days")
    retention_logs_days: int = Field(..., ge=1, description="Logs retention in days")


class DashboardSummaryResponse(BaseModel):
    """
    Full dashboard summary payload.

    Aggregated health overview for all active servers, including a list of
    top-failing checks across all servers.

    Req 9.1 — aggregated health overview for all active servers.
    Req 9.2 — computed in a single database round-trip or minimal queries.
    Req 9.6 — servers sorted by severity: open incidents first, then unack alerts,
              then healthy; STALE servers sorted within their tier.
    Req 9.7 — top_failing_checks array with top 5 checks by failure count (last 24h).

    Attributes
    ----------
    servers : list[DashboardSummaryItem]
        List of active servers sorted by severity (incidents > alerts > healthy).
    top_failing_checks : list[TopFailingCheck]
        Top 5 checks by failure count in the last 24 hours across all servers.
    """

    servers: list[DashboardSummaryItem] = Field(
        ...,
        description="List of active servers sorted by severity"
    )
    top_failing_checks: list[TopFailingCheck] = Field(
        ...,
        description="Top 5 checks by failure count in last 24h"
    )


class PerServerHealthResponse(BaseModel):
    """
    One check's latest run info for a given server.

    Represents the most recent execution status of a single check on a server,
    used when returning per-server health grouped by check.

    Req 9.3 — per-server last N check runs grouped by check, showing most recent
    status and execution time.

    Attributes
    ----------
    server_id : int
        Primary key of the server.
    check_id : int
        Primary key of the check.
    check_name : str | None
        Human-readable name of the check.
    latest_status : str | None
        Status of the most recent run: "SUCCESS", "FAILED", "TIMEOUT", or None.
    latest_execution_time_ms : int | None
        Execution time of the most recent run in milliseconds.
    run_count : int
        Total number of runs for this check on this server (in the query window).
    """

    server_id: int = Field(..., description="Primary key of the server")
    check_id: int = Field(..., description="Primary key of the check")
    check_name: str | None = Field(None, description="Human-readable check name")
    latest_status: str | None = Field(
        None,
        description="Latest run status: SUCCESS, FAILED, TIMEOUT, or None"
    )
    latest_execution_time_ms: int | None = Field(
        None,
        ge=0,
        description="Execution time of latest run in milliseconds"
    )
    run_count: int = Field(..., ge=0, description="Total run count in query window")


class MetricChartResponse(BaseModel):
    """
    One time-bucket from the metrics chart aggregation query.

    Represents aggregated metric statistics for a single time bucket, suitable
    for rendering line charts in the UI.

    Req 9.4 — metrics chart endpoint returns time-bucketed aggregates for line
    chart rendering.
    Req 6.6 — aggregation endpoint returns avg, min, max, count per bucket.

    Attributes
    ----------
    bucket : datetime
        Start of the time bucket (ISO 8601 UTC). The bucket interval is
        determined by the request parameter (e.g., 5m, 1h).
    avg_value : float
        Average metric value across all samples in the bucket.
    min_value : float
        Minimum metric value in the bucket.
    max_value : float
        Maximum metric value in the bucket.
    sample_count : int
        Number of samples aggregated into this bucket.
    """

    bucket: datetime = Field(..., description="Start of time bucket (ISO 8601 UTC)")
    avg_value: float = Field(..., description="Average metric value in bucket")
    min_value: float = Field(..., description="Minimum metric value in bucket")
    max_value: float = Field(..., description="Maximum metric value in bucket")
    sample_count: int = Field(..., ge=0, description="Number of samples in bucket")
