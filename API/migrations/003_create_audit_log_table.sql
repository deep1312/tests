-- Migration 003: Create api.audit_log table
-- Append-only audit trail for all configuration mutations performed via the API.
-- The API DB user must NOT be granted UPDATE or DELETE privileges on this table.

CREATE TABLE api.audit_log (
    log_id        BIGSERIAL PRIMARY KEY,
    user_id       TEXT NOT NULL,        -- username at time of action (denormalised for immutability)
    action        TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'CREDENTIAL_ROTATION')),
    resource_type TEXT NOT NULL,        -- 'server', 'check', 'mapping', 'threshold', 'system'
    resource_id   TEXT NOT NULL,        -- stringified PK of the affected row
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload       JSONB NOT NULL        -- field snapshot; passwords replaced with "[REDACTED]"
);

-- Support efficient time-range queries (most common access pattern)
CREATE INDEX idx_audit_log_changed_at ON api.audit_log (changed_at DESC);

-- Support resource-scoped lookups (e.g. "all changes to server 42")
CREATE INDEX idx_audit_log_resource ON api.audit_log (resource_type, resource_id);

-- Support user-scoped lookups (e.g. "all actions by user 'alice'")
CREATE INDEX idx_audit_log_user ON api.audit_log (user_id);
