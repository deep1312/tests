"""
Pydantic response models for monitoring visibility endpoints.

Updated to support deep PostgreSQL checks including tabular data for
Top Queries, Table Bloat, and Index Usage, as well as time-range
and bucketed historical aggregation filters.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Status code → label mappings
# ---------------------------------------------------------------------------

CHECK_RUN_STATUS_MAP: dict[int, str] = {
    1: "SUCCESS",
    2: "FAILED",
    3: "TIMEOUT",
}

MONITORING_LOG_STATUS_MAP: dict[int, str] = {
    1: "WARNING",
    2: "CRITICAL",
    3: "FAILURE",
}

# ---------------------------------------------------------------------------
# Specialized Data Models for DB Internals
# ---------------------------------------------------------------------------

class TabularResult(BaseModel):
    """
    Used for "Top Queries", "Top Tables", "Blocking Sessions", etc.
    Allows the frontend to render dynamic tables.
    """
    columns: List[str] = Field(..., description="List of headers/keys")
    rows: List[Dict[str, Any]] = Field(..., description="The actual data rows")
    collected_at: Optional[datetime] = None  # <--- ADD THIS


class MetricPoint(BaseModel):
    """Simple key-value pair for Gauges and KPI cards."""
    label: str
    value: float
    unit: Optional[str] = None


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class CheckRunResponse(BaseModel):
    run_id: int
    started_at: datetime
    scheduled_at: datetime | None
    ended_at: datetime | None
    server_id: int
    check_id: int
    status: str
    execution_time_ms: int | None
    error_message: str | None


class MonitoringLogResponse(BaseModel):
    log_id: int
    collected_at: datetime
    server_id: int
    check_id: int
    raw_result: Any | None  # Changed to Any to handle lists or dicts
    status_code: str
    execution_time_ms: int | None
    # Added to support tabular visualization in DetailDrawer
    tabular_data: Optional[TabularResult] = None


class MetricResponse(BaseModel):
    metric_id: int
    collected_at: datetime
    server_id: int
    check_id: int
    metric_name: str
    metric_value: float
    labels: dict | None


class MetricAggregatePoint(BaseModel):
    bucket: datetime
    avg_value: float
    min_value: float
    max_value: float
    sample_count: int


class RunsSummaryResponse(BaseModel):
    """
    Aggregated KPIs for the Summary Panel.
    """
    total_count: int = 0
    success_count: int = 0
    failed_count: int = 0
    timeout_count: int = 0
    avg_execution_time_ms: int = 0
    success_rate_pct: float = 0.0

    # Dynamic Live Metrics
    live_metrics: List[MetricPoint] = Field(
        default_factory=list,
        description="Key performance indicators currently active"
    )


class RunsAggregatePoint(BaseModel):
    bucket: datetime
    success_count: int
    failed_count: int
    timeout_count: int
    total_count: int
    success_rate_pct: float | None
    avg_execution_time_ms: int | None


class LatestPerCheckRow(BaseModel):
    server_id: int
    server_label: str
    check_id: int
    check_name: str
    check_category: str
    status: str
    started_at: datetime
    collected_at: Optional[datetime] = None  # <--- ADD THIS
    execution_time_ms: int | None
    latest_value: Optional[float | str] = None
    result_metadata: Optional[Any] = None
    
    # --- CRITICAL FIX: Add this field so the Service/Router doesn't strip it ---
    # This carries the JSON results needed for the Recharts visualizer.
    result_metadata: Optional[Any] = None 


class CheckDetailViewResponse(BaseModel):
    check_id: int
    check_name: str
    last_run_status: str
    # Add this to capture the specific collection time for the drawer header
    collected_at: Optional[datetime] = None  # <--- ADD THIS
    timeseries_data: List[MetricAggregatePoint] = []
    tabular_data: Optional[TabularResult] = None
    summary_stats: List[MetricPoint] = []


# ---------------------------------------------------------------------------
# Filtered Historical Dashboard Response Model
# ---------------------------------------------------------------------------

class HistoricalDashboardResponse(BaseModel):
    """
    Unified payload returning filtered historical snapshots to populate 
    telemetry charts, gauges, and deep DB internal logs.
    """
    instance: str = Field(..., description="Target server/instance label")
    time_range: str = Field(..., description="Selected filter range e.g., 1H, 6H, 24H, 7D")
    bucket: str = Field(..., description="Aggregation group interval e.g., 5M, 15M, 1H, 1D")
    
    # Scalar/Continuous time series mappings (Connections, WAL, Lag, etc.)
    timeseries_metrics: Dict[str, List[MetricAggregatePoint]] = Field(
        default_factory=dict, 
        description="Historical data arrays indexed by metric key name"
    )
    
    # Tabular metrics snapshots corresponding to the selected time context 
    # (Slow Queries, Bloat, Unused Indexes)
    tabular_metrics: Dict[str, TabularResult] = Field(
        default_factory=dict,
        description="Aggregated tabular datasets mapped by check category"
    )


class HistoricalPerCheckPoint(BaseModel):
    """
    A single time-bucketed data point for one of the 9 PostgreSQL checks,
    with fields extracted from the monitoring_logs raw_result JSONB.
    """
    bucket: datetime
    check_id: int

    # Check 1 — Connections
    connection_pct: Optional[float] = None
    total_connections: Optional[int] = None
    active_connections: Optional[int] = None
    idle_connections: Optional[int] = None
    idle_in_txn_connections: Optional[int] = None
    max_connections: Optional[int] = None

    # Check 2 — Blocking Sessions
    blocking_count: Optional[int] = None

    # Check 3 — Table Bloat
    bloat_pct: Optional[float] = None

    # Check 4 — Index Usage
    index_usage_pct: Optional[float] = None

    # Check 5 — Unused Indexes
    unused_count: Optional[int] = None
    total_size: Optional[str] = None

    # Check 6 — Replication Lag
    lag_seconds: Optional[float] = None

    # Check 7 — WAL Usage
    wal_dir_gb: Optional[float] = None
    wal_gb_total: Optional[float] = None
    wal_gb_total_display: Optional[str] = None
    wal_file_count: Optional[int] = None

    # Check 8 — Database Size
    size_gb: Optional[float] = None

    # Check 9 — Slow Queries
    avg_mean_ms: Optional[float] = None

    # Check 10 — Table Count
    table_count: Optional[int] = None

    # Check 11 — Database Age
    xid_age: Optional[int] = None


class TableCountHistoryPoint(BaseModel):
    collected_at: datetime
    record_count: Optional[int] = None
    status: str