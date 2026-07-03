INSERT INTO monitoring.monitoring_metrics (
    collected_at,
    server_id,
    check_id,
    metric_name,
    metric_value,
    labels
)
VALUES (
    COALESCE($1, NOW()), -- collected_at
    $2,                  -- server_id
    $3,                  -- check_id
    $4,                  -- metric_name
    $5,                  -- metric_value
    $6                   -- labels jsonb
)
RETURNING metric_id, collected_at;
