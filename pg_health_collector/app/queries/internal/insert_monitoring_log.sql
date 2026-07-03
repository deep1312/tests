INSERT INTO monitoring.monitoring_logs (
    collected_at,
    server_id,
    check_id,
    raw_result,
    status_code,
    execution_time_ms
)
VALUES (
    COALESCE($1, NOW()), -- collected_at
    $2,                  -- server_id
    $3,                  -- check_id
    $4,                  -- raw_result jsonb
    $5,                  -- status_code (1=WARNING,2=CRITICAL,3=FAILURE)
    $6                   -- execution_time_ms
)
RETURNING log_id, collected_at;
