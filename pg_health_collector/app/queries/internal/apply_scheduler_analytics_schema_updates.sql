ALTER TABLE monitoring.check_runs
    ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS cycle_started_at timestamp with time zone;

COMMENT ON COLUMN monitoring.check_runs.scheduled_at
    IS 'Intended start time from scheduler; NULL = unscheduled/catch-up';
COMMENT ON COLUMN monitoring.check_runs.cycle_started_at
    IS 'Cycle boundary time when this check was scheduled (e.g. :00 or :30 trigger time).';

ALTER TABLE config.server_checks_mapping
    ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS backoff_until timestamp with time zone;

COMMENT ON COLUMN config.server_checks_mapping.consecutive_failures
    IS 'Incremented on each failed run, reset on success. Used for circuit breaker.';
COMMENT ON COLUMN config.server_checks_mapping.backoff_until
    IS 'Collector skips this mapping until this timestamp. NULL = no backoff active.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_check_runs_server_check_scheduled
    ON monitoring.check_runs (server_id, check_id, scheduled_at, started_at)
    WHERE scheduled_at IS NOT NULL;

COMMENT ON COLUMN monitoring.check_runs.status
    IS '1=SUCCESS, 2=FAILED, 3=TIMEOUT, 4=IN_PROGRESS';
