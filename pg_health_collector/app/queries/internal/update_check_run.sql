UPDATE monitoring.check_runs
SET
    ended_at = COALESCE($3, NOW()),
    status = $4,             -- 1=SUCCESS, 2=FAILED, 3=TIMEOUT
    execution_time_ms = $5,
    error_message = $6
WHERE run_id = $1
  AND started_at = $2
RETURNING run_id, started_at, ended_at, status;
