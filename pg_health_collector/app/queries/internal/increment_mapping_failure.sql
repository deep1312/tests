UPDATE config.server_checks_mapping
SET
    consecutive_failures = COALESCE(consecutive_failures, 0) + 1,
    backoff_until = CASE
        WHEN COALESCE(consecutive_failures, 0) + 1 >= $3
            THEN NOW() + make_interval(secs => $4)
        ELSE backoff_until
    END
WHERE server_id = $1
  AND check_id = $2
RETURNING mapping_id, consecutive_failures, backoff_until;
