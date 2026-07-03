INSERT INTO monitoring.check_runs (
    started_at,
    scheduled_at,
    cycle_started_at,
    server_id,
    check_id,
    status
)
VALUES (
    COALESCE($1, NOW()), -- started_at
    $2,                  -- scheduled_at
    $3,                  -- cycle_started_at
    $4,                  -- server_id
    $5,                  -- check_id
    $6                   -- status (1=SUCCESS,2=FAILED,3=TIMEOUT,4=IN_PROGRESS)
)
ON CONFLICT (server_id, check_id, scheduled_at, started_at)
WHERE scheduled_at IS NOT NULL
DO NOTHING
RETURNING run_id, started_at;
