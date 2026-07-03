UPDATE config.server_checks_mapping
SET
    consecutive_failures = 0,
    backoff_until = NULL
WHERE server_id = $1
  AND check_id = $2
RETURNING mapping_id, consecutive_failures, backoff_until;
