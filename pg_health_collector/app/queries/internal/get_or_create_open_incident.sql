WITH existing_open AS (
    SELECT i.incident_id
    FROM alerts.incidents AS i
    WHERE i.server_id = $1
      AND i.check_id = $2
      AND i.status = 1
    ORDER BY i.started_at DESC
    LIMIT 1
),
inserted AS (
    INSERT INTO alerts.incidents (
        server_id,
        check_id,
        status,
        started_at,
        root_cause
    )
    SELECT
        $1,                  -- server_id
        $2,                  -- check_id
        1,                   -- status OPEN
        COALESCE($3, NOW()),
        $4                   -- root_cause
    WHERE NOT EXISTS (SELECT 1 FROM existing_open)
    RETURNING incident_id, server_id, check_id, status, started_at
)
SELECT incident_id, server_id, check_id, status, started_at
FROM inserted
UNION ALL
SELECT i.incident_id, i.server_id, i.check_id, i.status, i.started_at
FROM alerts.incidents AS i
JOIN existing_open eo ON eo.incident_id = i.incident_id
LIMIT 1;
