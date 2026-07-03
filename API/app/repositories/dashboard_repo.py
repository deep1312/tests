"""
Dashboard repository — read-only SQL access for dashboard aggregation queries.

Functions
---------
get_summary(conn, staleness_threshold_secs)
    Single CTE query returning per-server health summary for all active servers.

get_top_failing_checks(conn)
    Top 5 checks by failure count in the last 24 hours.

get_server_health(conn, server_id, n)
    Last N check runs per check for a given server (most recent status/time).

get_metrics_chart(conn, server_id, metric_name, bucket_interval, from_dt, to_dt)
    Time-bucketed metric aggregates for chart rendering.

Req 9.1  — dashboard summary via single CTE query
Req 9.3  — per-server health endpoint
Req 9.4  — metrics chart endpoint
Req 9.7  — top failing checks
"""

from __future__ import annotations

from datetime import datetime

import asyncpg

# ---------------------------------------------------------------------------
# Epoch-based bucket sizes for sub-hour intervals (mirrors monitoring_repo)
# ---------------------------------------------------------------------------

_EPOCH_BUCKET_SECONDS: dict[str, int] = {
    "5m": 300,
    "15m": 900,
    "6h": 21600,
}

_DATE_TRUNC_MAP: dict[str, str] = {
    "1h": "hour",
    "1d": "day",
}


# ---------------------------------------------------------------------------
# 30.1 — get_summary
# ---------------------------------------------------------------------------

_SUMMARY_QUERY = """
WITH active_servers AS (
    SELECT server_id, server_label, env_type, server_role,
           last_heartbeat, retention_metrics_days, retention_logs_days
    FROM config.servers WHERE is_active = true
),
open_incidents AS (
    SELECT server_id, COUNT(*) AS cnt
    FROM alerts.incidents WHERE status = 1
    GROUP BY server_id
),
unack_alerts AS (
    SELECT server_id, COUNT(*) AS cnt
    FROM alerts.alerts
    WHERE acknowledged_at IS NULL
      AND triggered_at >= now() - INTERVAL '24 hours'
    GROUP BY server_id
),
latest_run AS (
    SELECT DISTINCT ON (server_id) server_id, status
    FROM monitoring.check_runs
    ORDER BY server_id, started_at DESC
),
trend_current AS (
    SELECT server_id,
           COUNT(*) FILTER (WHERE status != 1)::float / NULLIF(COUNT(*), 0) AS fail_rate
    FROM monitoring.check_runs
    WHERE started_at >= now() - INTERVAL '6 hours'
    GROUP BY server_id
),
trend_prior AS (
    SELECT server_id,
           COUNT(*) FILTER (WHERE status != 1)::float / NULLIF(COUNT(*), 0) AS fail_rate
    FROM monitoring.check_runs
    WHERE started_at BETWEEN now() - INTERVAL '12 hours' AND now() - INTERVAL '6 hours'
    GROUP BY server_id
)
SELECT s.*,
       COALESCE(oi.cnt, 0)  AS open_incident_count,
       COALESCE(ua.cnt, 0)  AS unack_alert_count,
       lr.status             AS latest_run_status,
       CASE
           WHEN tc.fail_rate < tp.fail_rate THEN 'IMPROVING'
           WHEN tc.fail_rate > tp.fail_rate THEN 'DEGRADING'
           ELSE 'STABLE'
       END                   AS health_trend,
       CASE
           WHEN s.last_heartbeat IS NULL
             OR s.last_heartbeat < now() - make_interval(secs => $1)
           THEN 'STALE' ELSE 'ACTIVE'
       END                   AS collector_state
FROM active_servers s
LEFT JOIN open_incidents oi  ON oi.server_id = s.server_id
LEFT JOIN unack_alerts ua    ON ua.server_id = s.server_id
LEFT JOIN latest_run lr      ON lr.server_id = s.server_id
LEFT JOIN trend_current tc   ON tc.server_id = s.server_id
LEFT JOIN trend_prior tp     ON tp.server_id = s.server_id
ORDER BY
    COALESCE(oi.cnt, 0) DESC,
    COALESCE(ua.cnt, 0) DESC,
    s.server_label
"""


async def get_summary(
    conn: asyncpg.Connection,
    staleness_threshold_secs: int,
) -> list[dict]:
    """
    Return per-server health summary for all active servers.

    Executes a single CTE query to minimise round-trips (Req 9.2).
    The staleness threshold is passed as a parameter to avoid SQL injection
    and to allow runtime configuration.

    Parameters
    ----------
    conn:
        An asyncpg connection.
    staleness_threshold_secs:
        Number of seconds after which a server is considered STALE.

    Returns
    -------
    list[dict]
        One dict per active server, ordered by severity then server_label.
    """
    rows = await conn.fetch(_SUMMARY_QUERY, staleness_threshold_secs)
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# 30.2 — get_top_failing_checks
# ---------------------------------------------------------------------------

_TOP_FAILING_QUERY = """
SELECT cr.check_id,
       cm.check_name,
       COUNT(*) AS failure_count
FROM monitoring.check_runs cr
JOIN config.checks_master cm USING (check_id)
WHERE cr.status != 1
  AND cr.started_at >= now() - INTERVAL '24 hours'
GROUP BY cr.check_id, cm.check_name
ORDER BY failure_count DESC
LIMIT 5
"""


async def get_top_failing_checks(conn: asyncpg.Connection) -> list[dict]:
    """
    Return the top 5 checks by failure count in the last 24 hours.

    Joins with ``config.checks_master`` to include ``check_name`` (Req 9.7).

    Parameters
    ----------
    conn:
        An asyncpg connection.

    Returns
    -------
    list[dict]
        Up to 5 dicts with keys: check_id, check_name, failure_count.
    """
    rows = await conn.fetch(_TOP_FAILING_QUERY)
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# 30.3 — get_server_health
# ---------------------------------------------------------------------------

_SERVER_HEALTH_QUERY = """
SELECT DISTINCT ON (check_id)
    $1::int          AS server_id,
    check_id,
    status,
    execution_time_ms,
    started_at
FROM monitoring.check_runs
WHERE server_id = $1
ORDER BY check_id, started_at DESC
LIMIT $2
"""


async def get_server_health(
    conn: asyncpg.Connection,
    server_id: int,
    n: int = 20,
) -> list[dict]:
    """
    Return the most recent check run per check for a given server.

    Uses ``DISTINCT ON (check_id)`` ordered by ``started_at DESC`` to get
    the latest status and execution time for each check (Req 9.3).

    Parameters
    ----------
    conn:
        An asyncpg connection.
    server_id:
        The server to query.
    n:
        Maximum number of distinct checks to return (default 20).

    Returns
    -------
    list[dict]
        One dict per check with keys: server_id, check_id, status,
        execution_time_ms, started_at.
    """
    rows = await conn.fetch(_SERVER_HEALTH_QUERY, server_id, n)
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# 30.4 — get_metrics_chart
# ---------------------------------------------------------------------------


async def get_metrics_chart(
    conn: asyncpg.Connection,
    server_id: int,
    metric_name: str,
    bucket_interval: str,
    from_dt: datetime,
    to_dt: datetime,
) -> list[dict]:
    """
    Return time-bucketed metric aggregates for chart rendering.

    Reuses the same epoch-based bucketing logic from ``monitoring_repo.aggregate_metrics``
    for sub-hour intervals (5m, 15m, 6h) and ``date_trunc`` for 1h and 1d (Req 9.4).

    Parameters
    ----------
    conn:
        An asyncpg connection.
    server_id:
        Required filter on ``server_id``.
    metric_name:
        Required filter on ``metric_name``.
    bucket_interval:
        One of ``'5m'``, ``'15m'``, ``'1h'``, ``'6h'``, ``'1d'``.
    from_dt:
        Lower bound for ``collected_at`` (inclusive).
    to_dt:
        Upper bound for ``collected_at`` (inclusive).

    Returns
    -------
    list[dict]
        List of dicts with keys: bucket, avg_value, min_value, max_value,
        sample_count.  Ordered by bucket ASC.
    """
    if bucket_interval in _EPOCH_BUCKET_SECONDS:
        bucket_secs = _EPOCH_BUCKET_SECONDS[bucket_interval]
        query = f"""
            SELECT
                to_timestamp(
                    floor(extract(epoch FROM collected_at) / {bucket_secs}) * {bucket_secs}
                ) AT TIME ZONE 'UTC' AS bucket,
                AVG(metric_value)   AS avg_value,
                MIN(metric_value)   AS min_value,
                MAX(metric_value)   AS max_value,
                COUNT(*)            AS sample_count
            FROM monitoring.monitoring_metrics
            WHERE server_id   = $1
              AND metric_name = $2
              AND collected_at BETWEEN $3 AND $4
            GROUP BY bucket
            ORDER BY bucket ASC
        """
    else:
        # date_trunc for 1h and 1d
        trunc_unit = _DATE_TRUNC_MAP[bucket_interval]
        query = f"""
            SELECT
                date_trunc('{trunc_unit}', collected_at) AS bucket,
                AVG(metric_value)   AS avg_value,
                MIN(metric_value)   AS min_value,
                MAX(metric_value)   AS max_value,
                COUNT(*)            AS sample_count
            FROM monitoring.monitoring_metrics
            WHERE server_id   = $1
              AND metric_name = $2
              AND collected_at BETWEEN $3 AND $4
            GROUP BY bucket
            ORDER BY bucket ASC
        """

    rows = await conn.fetch(query, server_id, metric_name, from_dt, to_dt)
    return [dict(row) for row in rows]
