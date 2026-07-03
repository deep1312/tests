UPDATE monitoring.check_runs
SET
    ended_at = NOW(),
    status = 2,
    error_message = 'Collector restart - stale IN_PROGRESS run'
WHERE status = 4
  AND ended_at IS NULL