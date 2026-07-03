CREATE SCHEMA IF NOT EXISTS monitoring_dashboard;

CREATE OR REPLACE FUNCTION monitoring_dashboard.speed_monitoring_summary()
RETURNS TABLE(di_name text, latest_pulltimestamp timestamp, frequency text, status text) AS $$
BEGIN
    RETURN QUERY VALUES
        ('Congestion', now() - interval '5 minutes', '5m', 'SUCCESS'),
        ('Spatel', now() - interval '2 minutes', '1m', 'SUCCESS'),
        ('Navteq', now() - interval '10 minutes', '15m', 'WARNING'),
        ('Inrix', now() - interval '30 minutes', '1h', 'FAILED'),
        ('Timed', now() - interval '1 hour', '1h', 'SUCCESS');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION monitoring_dashboard.monitoring_summary()
RETURNS TABLE(o_di_name text, o_latest_pulltimestamp timestamp, o_frequency text, o_status text) AS $$
BEGIN
    RETURN QUERY VALUES
        ('LinkCalc Data', now() - interval '5 minutes', '5m', 'SUCCESS'),
        ('Timed Pull', now() - interval '2 minutes', '1m', 'SUCCESS'),
        ('WAZE_EVENT Condition', now() - interval '10 minutes', '15m', 'WARNING');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION monitoring_dashboard.speed_source_details(p_di_name text)
RETURNS TABLE(record jsonb) AS $$
BEGIN
    RETURN QUERY SELECT jsonb_build_object(
        'pulltime', now() - interval '5 minutes',
        'records_processed', floor(random() * 1000)::int,
        'error_count', 0,
        'duration_ms', floor(random() * 500 + 100)::int
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION monitoring_dashboard.monitoring_details(p_di_name text)
RETURNS TABLE(record jsonb) AS $$
BEGIN
    RETURN QUERY SELECT jsonb_build_object(
        'pulltime', now() - interval '5 minutes',
        'records_processed', floor(random() * 1000)::int,
        'error_count', 0,
        'duration_ms', floor(random() * 500 + 100)::int
    );
END;
$$ LANGUAGE plpgsql;
