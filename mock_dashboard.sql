INSERT INTO alerts.incidents (server_id, check_id, status, started_at)
VALUES 
    (22, 1, 1, now() - interval '2 hours'),
    (16, 9, 1, now() - interval '5 hours');

INSERT INTO alerts.alerts (server_id, check_id, metric_name, observed_value, status, triggered_at)
VALUES 
    (22, 1, 'connection_pct', '95.5', 2, now() - interval '1 hour'),
    (16, 9, 'avg_mean_ms', '1500', 2, now() - interval '4 hours'),
    (22, 7, 'wal_file_count', '120', 2, now() - interval '30 minutes');
