INSERT INTO monitoring.monitoring_logs (server_id, check_id, collected_at, raw_result, status_code)
VALUES 
    (22, 10, now(), '[{"table_name": "public.users", "row_count": 1204}, {"table_name": "public.orders", "row_count": 45091}]'::jsonb, 1),
    (22, 10, now() - interval '1 hour', '[{"table_name": "public.users", "row_count": 1200}, {"table_name": "public.orders", "row_count": 44990}]'::jsonb, 1),
    (22, 10, now() - interval '2 hours', '[{"table_name": "public.users", "row_count": 1195}, {"table_name": "public.orders", "row_count": 44800}]'::jsonb, 1);
