-- Migration 005: Add missing columns required by the API service layer
-- These columns exist in the API models/repos but were absent from the
-- collector's original DDL dump.

-- config.checks_master: add version column for optimistic locking
ALTER TABLE config.checks_master
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- config.server_checks_mapping: add updated_at for tracking changes
ALTER TABLE config.server_checks_mapping
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- config.check_thresholds: add version, created_at, updated_at columns
-- The API repo expects these for optimistic locking and auditing.
-- Also add threshold_value as a unified column (maps to warning_value_num for now).
ALTER TABLE config.check_thresholds
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS threshold_value DOUBLE PRECISION;

-- Backfill threshold_value from warning_value_num where available
UPDATE config.check_thresholds
SET threshold_value = COALESCE(warning_value_num, critical_value_num)
WHERE threshold_value IS NULL;
