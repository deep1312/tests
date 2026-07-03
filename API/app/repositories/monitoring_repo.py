# C:\Users\RishiShah\pg_utility\PG Utility\api\app\repositories\monitoring_repo.py

"""
Monitoring repository — read-only SQL access to monitoring.* tables.
Provides raw data, time-series aggregation, and real-time metric snapshots.
Updated to support nested JSONB results for proper UI chart rendering.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import asyncpg

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

STATUS_MAP = {1: "SUCCESS", 2: "FAILED", 3: "TIMEOUT"}

def _now_utc() -> datetime:
    """Return the current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


def _default_from(to_dt: datetime) -> datetime:
    """Return 24 hours before *to_dt* as the default lower bound."""
    return to_dt - timedelta(hours=24)


def _row_to_dict(row: asyncpg.Record) -> dict:
    """
    Convert an asyncpg Record to a plain dict and handle JSONB/JSON parsing.
    """
    d = dict(row)
    for field in ["labels", "raw_result", "result_metadata"]:
        if field in d and d[field] is not None:
            if isinstance(d[field], (dict, list)):
                continue
            if isinstance(d[field], str):
                try:
                    d[field] = json.loads(d[field])
                except (ValueError, TypeError):
                    pass
    return d


# ---------------------------------------------------------------------------
# 1. KPIs & Summaries
# ---------------------------------------------------------------------------

async def get_runs_summary(
    conn: asyncpg.Connection,
    server_id: int | None = None,
    check_id: int | None = None,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
) -> dict:
    effective_to = to_dt if to_dt is not None else _now_utc()
    effective_from = from_dt if from_dt is not None else _default_from(effective_to)

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    conditions.append(f"started_at >= ${param_idx}"); params.append(effective_from); param_idx += 1
    conditions.append(f"started_at <= ${param_idx}"); params.append(effective_to); param_idx += 1

    if server_id is not None:
        conditions.append(f"server_id = ${param_idx}"); params.append(server_id); param_idx += 1

    if check_id is not None:
        conditions.append(f"check_id = ${param_idx}"); params.append(check_id); param_idx += 1

    where_clause = "WHERE " + " AND ".join(conditions)

    stats_query = f"""
        SELECT
            COUNT(*)::int                                     AS total_count,
            COUNT(*) FILTER (WHERE status = 1)::int           AS success_count,
            COUNT(*) FILTER (WHERE status = 2)::int           AS failed_count,
            COUNT(*) FILTER (WHERE status = 3)::int           AS timeout_count,
            COALESCE(AVG(execution_time_ms), 0)::int         AS avg_execution_time_ms,
            ROUND(
                COALESCE(COUNT(*) FILTER (WHERE status = 1)::numeric
                / NULLIF(COUNT(*), 0) * 100, 0), 1
            )::float                                        AS success_rate_pct
        FROM monitoring.check_runs
        {where_clause}
    """
    stats_row = await conn.fetchrow(stats_query, *params)
    result = dict(stats_row) if stats_row else {
        "total_count": 0, "success_count": 0, "failed_count": 0,
        "timeout_count": 0, "avg_execution_time_ms": 0, "success_rate_pct": 0.0
    }

    if server_id is not None:
        metrics_query = """
            SELECT DISTINCT ON (metric_name)
                metric_name as label,
                metric_value as value
            FROM monitoring.monitoring_metrics
            WHERE server_id = $1 
              AND collected_at >= $2 AND collected_at <= $3
            ORDER BY metric_name, collected_at DESC
        """
        metric_rows = await conn.fetch(metrics_query, server_id, effective_from, effective_to)
        result["live_metrics"] = [dict(r) for r in metric_rows]
    else:
        result["live_metrics"] = []

    return result


async def aggregate_check_runs(
    conn: asyncpg.Connection,
    from_dt: datetime,
    to_dt: datetime,
    bucket_interval: str,
    server_id: int | None = None,
    check_id: int | None = None,
) -> list[dict]:
    conditions = ["started_at >= $1", "started_at <= $2"]
    params = [from_dt, to_dt]
    param_idx = 3

    if server_id is not None:
        conditions.append(f"server_id = ${param_idx}"); params.append(server_id); param_idx += 1
    if check_id is not None:
        conditions.append(f"check_id = ${param_idx}"); params.append(check_id); param_idx += 1

    where_clause = "WHERE " + " AND ".join(conditions)

    if bucket_interval in {"5m", "15m"}:
        secs = 300 if bucket_interval == "5m" else 900
        bucket_expr = f"to_timestamp(floor(extract(epoch FROM started_at) / {secs}) * {secs})"
    elif bucket_interval == "6h":
        bucket_expr = "to_timestamp(floor(extract(epoch FROM started_at) / 21600) * 21600)"
    else:
        unit = {"1h": "hour", "1d": "day"}.get(bucket_interval, "hour")
        bucket_expr = f"date_trunc('{unit}', started_at)"

    query = f"""
        SELECT
            {bucket_expr}                                    AS bucket,
            COUNT(*) FILTER (WHERE status = 1)::int           AS success_count,
            COUNT(*) FILTER (WHERE status = 2)::int           AS failed_count,
            COUNT(*) FILTER (WHERE status = 3)::int           AS timeout_count,
            COUNT(*)::int                                    AS total_count,
            ROUND(
                COALESCE(COUNT(*) FILTER (WHERE status = 1)::numeric
                / NULLIF(COUNT(*), 0) * 100, 0), 1
            )::float                                        AS success_rate_pct,
            COALESCE(AVG(execution_time_ms), 0)::int         AS avg_execution_time_ms
        FROM monitoring.check_runs
        {where_clause}
        GROUP BY bucket ORDER BY bucket ASC
    """
    rows = await conn.fetch(query, *params)
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# 2. Latest State & Tabular Data
# ---------------------------------------------------------------------------

async def get_latest_tabular_data(
    conn: asyncpg.Connection,
    server_id: int,
    check_id: int
) -> dict | None:
    query = """
        SELECT raw_result, collected_at
        FROM monitoring.monitoring_logs
        WHERE server_id = $1 AND check_id = $2
        ORDER BY collected_at DESC
        LIMIT 1
    """
    row = await conn.fetchrow(query, server_id, check_id)
    if not row or not row["raw_result"]:
        return None
    
    data = row["raw_result"]
    if isinstance(data, dict) and "rows" in data:
        data = data["rows"]
    
    if isinstance(data, list) and len(data) > 0:
        return {
            "columns": list(data[0].keys()),
            "rows": data,
            "collected_at": row["collected_at"]
        }
    return None


async def get_latest_per_check(
    conn: asyncpg.Connection,
    server_id: int | None = None,
    check_id: int | None = None,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
) -> list[dict]:
    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if from_dt:
        conditions.append(f"cr.started_at >= ${param_idx}"); params.append(from_dt); param_idx += 1
    if to_dt:
        conditions.append(f"cr.started_at <= ${param_idx}"); params.append(to_dt); param_idx += 1

    if server_id:
        conditions.append(f"cr.server_id = ${param_idx}"); params.append(server_id); param_idx += 1
    if check_id:
        conditions.append(f"cr.check_id = ${param_idx}"); params.append(check_id); param_idx += 1

    where_clause = " AND ".join(conditions)
    if where_clause:
        where_clause = "WHERE " + where_clause

    query = f"""
        SELECT DISTINCT ON (cr.server_id, cr.check_id)
            cr.server_id,
            s.server_label,
            cr.check_id,
            c.check_name,
            c.category AS check_category,
            cr.status,
            cr.started_at,
            cr.execution_time_ms,
            COALESCE(ml.raw_result->'rows', ml.raw_result) AS result_metadata,
            ml.collected_at
        FROM monitoring.check_runs cr
        JOIN config.servers s ON s.server_id = cr.server_id
        JOIN config.checks_master c ON c.check_id = cr.check_id
        LEFT JOIN LATERAL (
            SELECT raw_result, collected_at
            FROM monitoring.monitoring_logs
            WHERE server_id = cr.server_id
              AND check_id = cr.check_id
              AND collected_at <= cr.started_at
            ORDER BY collected_at DESC
            LIMIT 1
        ) ml ON true
        {where_clause}
        ORDER BY cr.server_id, cr.check_id, cr.started_at DESC
    """
    rows = await conn.fetch(query, *params)
    
    final_results = []
    for row in rows:
        d = _row_to_dict(row)
        if "status" in d and isinstance(d["status"], int):
            d["status"] = STATUS_MAP.get(d["status"], "UNKNOWN")
        final_results.append(d)
        
    return final_results


# ---------------------------------------------------------------------------
# 3. Paginated Lists (Logs & Metrics)
# ---------------------------------------------------------------------------

async def list_check_runs(
    conn: asyncpg.Connection,
    server_id: int | None = None,
    check_id: int | None = None,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict], int]:
    effective_to = to_dt if to_dt is not None else _now_utc()
    effective_from = from_dt if from_dt is not None else _default_from(effective_to)

    conditions = ["started_at >= $1", "started_at <= $2"]
    params = [effective_from, effective_to]
    param_idx = 3

    if server_id:
        conditions.append(f"server_id = ${param_idx}"); params.append(server_id); param_idx += 1
    if check_id:
        conditions.append(f"check_id = ${param_idx}"); params.append(check_id); param_idx += 1

    where_clause = "WHERE " + " AND ".join(conditions)
    query = f"""
        SELECT *, COUNT(*) OVER()::int AS total_count
        FROM monitoring.check_runs
        {where_clause}
        ORDER BY started_at DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """
    params.extend([limit, offset])
    rows = await conn.fetch(query, *params)
    if not rows: return [], 0
    
    formatted_rows = []
    for r in rows:
        d = _row_to_dict(r)
        if "status" in d and isinstance(d["status"], int):
            d["status"] = STATUS_MAP.get(d["status"], "UNKNOWN")
        formatted_rows.append(d)
        
    return (formatted_rows, rows[0]["total_count"])


async def list_monitoring_logs(
    conn: asyncpg.Connection,
    server_id: int | None = None,
    check_id: int | None = None,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict], int]:
    effective_to = to_dt if to_dt is not None else _now_utc()
    effective_from = from_dt if from_dt is not None else _default_from(effective_to)

    conditions = ["collected_at >= $1", "collected_at <= $2"]
    params = [effective_from, effective_to]
    param_idx = 3

    if server_id:
        conditions.append(f"server_id = ${param_idx}"); params.append(server_id); param_idx += 1
    if check_id:
        conditions.append(f"check_id = ${param_idx}"); params.append(check_id); param_idx += 1

    where_clause = "WHERE " + " AND ".join(conditions)
    query = f"""
        SELECT *, COUNT(*) OVER()::int AS total_count
        FROM monitoring.monitoring_logs
        {where_clause}
        ORDER BY collected_at DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """
    params.extend([limit, offset])
    rows = await conn.fetch(query, *params)
    if not rows: return [], 0
    return ([_row_to_dict(r) for r in rows], rows[0]["total_count"])


# ---------------------------------------------------------------------------
# 4. Metric Aggregation
# ---------------------------------------------------------------------------

async def aggregate_metrics(
    conn: asyncpg.Connection,
    server_id: int,
    metric_name: str,
    from_dt: datetime,
    to_dt: datetime,
    bucket_interval: str,
) -> list[dict]:
    if bucket_interval in {"5m", "15m"}:
        secs = 300 if bucket_interval == "5m" else 900
        bucket_sql = f"to_timestamp(floor(extract(epoch FROM collected_at) / {secs}) * {secs})"
    elif bucket_interval == "6h":
        bucket_sql = "to_timestamp(floor(extract(epoch FROM collected_at) / 21600) * 21600)"
    else:
        unit = {"1h": "hour", "1d": "day"}.get(bucket_interval, "hour")
        bucket_sql = f"date_trunc('{unit}', collected_at)"

    query = f"""
        SELECT
            {bucket_sql} AS bucket,
            COALESCE(AVG(metric_value), 0)::float AS avg_value,
            COALESCE(MIN(metric_value), 0)::float AS min_value,
            COALESCE(MAX(metric_value), 0)::float AS max_value,
            COUNT(*)::int AS sample_count
        FROM monitoring.monitoring_metrics
        WHERE server_id = $1 AND metric_name = $2 AND collected_at BETWEEN $3 AND $4
        GROUP BY bucket ORDER BY bucket ASC
    """
    rows = await conn.fetch(query, server_id, metric_name, from_dt, to_dt)
    return [dict(row) for row in rows]  



# ---------------------------------------------------------------------------
# 6. Historical Logs For Selected Time Window
# ---------------------------------------------------------------------------

async def get_logs_for_time_range(
    conn: asyncpg.Connection,
    server_id: int,
    check_id: int,
    from_dt: datetime,
    to_dt: datetime,
) -> list[dict]:
    """
    Returns all monitoring log records within the selected
    historical time window.
    """

    query = """
        SELECT
            log_id,
            collected_at,
            server_id,
            check_id,
            raw_result,
            result_metadata,
            status_code,
            execution_time_ms
        FROM monitoring.monitoring_logs
        WHERE server_id = $1
          AND check_id = $2
          AND collected_at >= $3
          AND collected_at <= $4
        ORDER BY collected_at DESC
    """

    rows = await conn.fetch(
        query,
        server_id,
        check_id,
        from_dt,
        to_dt,
    )

    return [_row_to_dict(r) for r in rows]

# ---------------------------------------------------------------------------
# 5. Filtered Historical Tabular Data Extractor
# ---------------------------------------------------------------------------

async def get_historical_tabular_data(
    conn: asyncpg.Connection,
    server_id: int,
    check_id: int,
    from_dt: datetime,
    to_dt: datetime
) -> dict | None:
    """
    Fetches the most representative tabular metadata record (e.g., Table Bloat, Top Queries)
    within a specific historical time window boundary.
    """
    query = """
        SELECT raw_result, collected_at
        FROM monitoring.monitoring_logs
        WHERE server_id = $1 
          AND check_id = $2 
          AND collected_at >= $3 
          AND collected_at <= $4
        ORDER BY collected_at DESC
        LIMIT 1
    """
    row = await conn.fetchrow(query, server_id, check_id, from_dt, to_dt)
    
    if not row or not row["raw_result"]:
        fallback_query = """
        SELECT raw_result, collected_at
        FROM monitoring.monitoring_logs
        WHERE server_id = $1
          AND check_id = $2
          AND collected_at <= $3
        ORDER BY collected_at DESC
        LIMIT 1
    """

    row = await conn.fetchrow(
        fallback_query,
        server_id,
        check_id,
        to_dt,
    )
    if not row or not row["raw_result"]:
        return None
        
    data = row["raw_result"]
    collected_time = row["collected_at"]
    
    if isinstance(data, dict) and "rows" in data:
        data = data["rows"]
        
    if isinstance(data, list) and len(data) > 0:
        return {
            "columns": list(data[0].keys()),
            "rows": data,
            "collected_at": collected_time
        }
        
    return None


# ---------------------------------------------------------------------------
# 7. Historical Per-Check (Bucketed Aggregation from raw_result JSONB)
# ---------------------------------------------------------------------------

# Maps each check_id to the fields to extract from raw_result JSONB.
# Each entry: field_name -> (sql_cast_type, [list_of_jsonb_paths_to_try])
_CHECK_JSONB_FIELDS: dict[int, dict[str, tuple[str, list[list[str]] | None]]] = {
    1: {  # Connections
        "total_connections": ("int", [["rows", "0", "total_connections"], ["total_connections"]]),
        "active_connections": ("int", [["rows", "0", "active_connections"], ["active_connections"]]),
        "idle_connections": ("int", [["rows", "0", "idle_connections"], ["idle_connections"]]),
        "idle_in_txn_connections": ("int", [["rows", "0", "idle_in_txn_connections"], ["idle_in_txn_connections"]]),
        "max_connections": ("int", [["rows", "0", "max_connections"], ["max_connections"]]),
        "connection_pct": ("numeric", [["rows", "0", "connection_pct"], ["connection_pct"]]),
    },
    2: {  # Blocking Sessions
        "blocking_count": ("int", [["rows", "0", "blocking_count"], ["blocking_count"]]),
    },
    3: {  # Table Bloat
        "bloat_pct": ("numeric", [["rows", "0", "bloat_pct"], ["bloat_pct"]]),
    },
    4: {  # Index Usage
        "index_usage_pct": ("numeric", [["rows", "0", "index_usage_pct"], ["index_usage_pct"]]),
    },
    5: {  # Unused Indexes
        "unused_count": ("int", [["rows", "0", "unused_count"], ["unused_count"]]),
        "total_size": ("text", [["rows", "0", "total_size"], ["total_size"]]),
    },
    6: {  # Replication Lag
        "lag_seconds": ("numeric", [["rows", "0", "lag_seconds"], ["lag_seconds"]]),
    },
    7: {  # WAL Usage
        "wal_dir_gb": ("numeric", [["rows", "0", "wal_dir_gb"], ["wal_dir_gb"]]),
        "wal_gb_total": ("numeric", [["regex_numeric", "rows", "0", "wal_gb_total"], ["regex_numeric", "wal_gb_total"]]),
        "wal_gb_total_display": ("text", [["rows", "0", "wal_gb_total"], ["wal_gb_total"]]),
        "wal_file_count": ("int", [["rows", "0", "wal_file_count"], ["wal_file_count"]]),
    },
    8: {  # Database Size
        "size_gb": ("numeric", [["rows", "0", "size_gb"], ["size_gb"]]),
    },
    9: {  # Slow Queries
        "avg_mean_ms": ("numeric", [["rows", "0", "avg_mean_ms"], ["avg_mean_ms"]]),
    },
    10: {  # Table Count — count of rows = number of tables checked
        "table_count": ("int", [["row_count"], ["rows", "row_count"]]),
    },
    11: {  # Database Age
        "xid_age": ("int", [["rows", "0", "xid_age"], ["xid_age"]]),
    },
    12: {  # Partition Count — count of rows returned by getrawdatatablestatus()
        "partition_count": ("int", [["row_count"], ["rows", "row_count"]]),
    },
}


def _build_bucket_expr(interval: str, column: str = "collected_at") -> str:
    """Return a SQL expression that truncates *column* to the given bucket interval."""
    if interval in {"5m", "15m"}:
        secs = 300 if interval == "5m" else 900
        return f"to_timestamp(floor(extract(epoch FROM {column}) / {secs}) * {secs})"
    if interval == "6h":
        return f"to_timestamp(floor(extract(epoch FROM {column}) / 21600) * 21600)"
    unit = {"1h": "hour", "1d": "day"}.get(interval, "hour")
    return f"date_trunc('{unit}', {column})"


def _build_jsonb_coalesce(field: str, cast: str, paths: list[list[str]] | None) -> str:
    """
    Build a COALESCE chain that tries multiple JSONB paths.
    For special fields (None paths), uses jsonb_array_length.
    A path starting with "regex_numeric" uses regexp_replace to strip
    non-numeric characters before casting (handles values like "4096 MB").
    """
    if paths is None:
        return (
            "COALESCE("
            "jsonb_array_length(raw_result #> '{rows,0,indexes}'), "
            "jsonb_array_length(raw_result #> '{0,indexes}'), "
            "0"
            f")::int AS {field}"
        )

    parts = []
    for path in paths:
        if len(path) >= 2 and path[0] == "regex_numeric":
            remaining = path[1:]
            if len(remaining) == 1:
                parts.append(
                    f"(regexp_replace(raw_result->>'{remaining[0]}', '[^0-9.]', '', 'g'))::{cast}"
                )
            else:
                p = "{" + ",".join(remaining) + "}"
                parts.append(
                    f"(regexp_replace(raw_result #>> '{p}', '[^0-9.]', '', 'g'))::{cast}"
                )
        elif len(path) == 1:
            parts.append(f"(raw_result->>'{path[0]}')::{cast}")
        else:
            p = "{" + ",".join(path) + "}"
            parts.append(f"(raw_result #>> '{p}')::{cast}")

    return "COALESCE(" + ", ".join(parts) + f") AS {field}"


async def get_historical_per_check(
    conn: asyncpg.Connection,
    server_id: int | None = None,
    check_id: int = 1,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    bucket_interval: str = "1h",
) -> list[dict]:
    """
    Returns all individual monitoring_log records within the time range
    for a single check, with scalar fields extracted from raw_result JSONB.
    The bucket_interval parameter is accepted for backward compatibility
    but is no longer used — every available record is returned.
    When server_id is None, returns data across all servers.
    """
    fields = _CHECK_JSONB_FIELDS.get(check_id)
    if not fields:
        logger.warning("No JSONB field mapping for check_id=%s", check_id)
        return []

    select_parts = [f"ml.collected_at AS bucket", f"{check_id}::int AS check_id"]
    for field_name, (cast_type, paths) in fields.items():
        select_parts.append(_build_jsonb_coalesce(field_name, cast_type, paths))

    select_clause = ",\n            ".join(select_parts)

    conditions = ["ml.check_id = $1", "ml.collected_at >= $2", "ml.collected_at <= $3"]
    params: list = [check_id, from_dt, to_dt]
    if server_id is not None:
        conditions.append(f"ml.server_id = ${len(params) + 1}")
        params.append(server_id)

    where_clause = "WHERE " + " AND ".join(conditions)

    query = f"""
        SELECT
            {select_clause}
        FROM monitoring.monitoring_logs ml
        {where_clause}
        ORDER BY ml.collected_at ASC
    """

    rows = await conn.fetch(query, *params)
    return [dict(row) for row in rows]


async def get_table_count_history(
    conn: asyncpg.Connection,
    server_id: int,
    table_name: str,
) -> list[dict]:
    rows = await conn.fetch(
        "SELECT collected_at, record_count, status FROM monitoring.get_table_count_history($1, $2)",
        server_id,
        table_name,
    )
    return [dict(row) for row in rows]