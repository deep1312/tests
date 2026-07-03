WITH due_calc AS (
    SELECT
        scm.mapping_id,
        s.server_id,
        s.server_label,
        s.server_ip,
        s.port,
        s.db_name,
        s.username,
        s.password_encrypted,
        s.ssl_mode,
        cm.check_id,
        cm.check_code,
        cm.check_name,
        cm.query_text,
        cm.timeout_ms,
        GREATEST(1, COALESCE(scm.custom_frequency_sec, cm.default_frequency_sec, 30)) AS effective_frequency_sec,
        scm.consecutive_failures,
        scm.backoff_until,
        lr.last_cycle_at,
        CASE
            WHEN lr.last_cycle_at IS NULL THEN TRUE
            ELSE EXTRACT(EPOCH FROM (NOW() - lr.last_cycle_at)) >= GREATEST(1, COALESCE(scm.custom_frequency_sec, cm.default_frequency_sec, 30))
        END AS is_due
    FROM config.server_checks_mapping scm
    JOIN config.servers s ON s.server_id = scm.server_id
    JOIN config.checks_master cm ON cm.check_id = scm.check_id
    LEFT JOIN LATERAL (
        SELECT MAX(COALESCE(cr.cycle_started_at, cr.started_at)) AS last_cycle_at
        FROM monitoring.check_runs cr
        WHERE cr.server_id = scm.server_id
          AND cr.check_id = scm.check_id
    ) lr ON TRUE
    WHERE s.is_active = true
      AND scm.is_enabled = true
      AND cm.is_active = true
      AND (scm.backoff_until IS NULL OR scm.backoff_until <= NOW())
)
SELECT *
FROM due_calc
WHERE is_due = TRUE
ORDER BY server_id, check_id;
