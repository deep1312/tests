UPDATE alerts.incidents
SET
    status = 2,                -- RESOLVED
    ended_at = COALESCE($3, NOW()),
    root_cause = COALESCE($4, root_cause)
WHERE server_id = $1
  AND check_id = $2
  AND status = 1
RETURNING incident_id, ended_at, status;
