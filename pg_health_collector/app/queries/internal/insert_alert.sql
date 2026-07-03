INSERT INTO alerts.alerts (
    incident_id,
    server_id,
    check_id,
    metric_name,
    observed_value,
    status,
    triggered_at,
    acknowledged_at
)
VALUES (
    $1,                  -- incident_id nullable
    $2,                  -- server_id
    $3,                  -- check_id
    $4,                  -- metric_name
    $5,                  -- observed_value
    $6,                  -- status (1=WARNING,2=CRITICAL)
    COALESCE($7, NOW()),
    $8
)
RETURNING alert_id, triggered_at;
