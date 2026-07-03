-- Migration 006: Seed read-only viewer user (DEVELOPMENT BOOTSTRAP ONLY)
--
-- WARNING: This seed is intended for local development and initial deployment
-- bootstrapping ONLY. The placeholder password MUST be changed before the
-- system is used in any non-development environment.
--
-- Placeholder password: "viewer123"
-- Hash below: bcrypt, cost factor 12
--
-- To generate a new hash (Python):
--   import bcrypt
--   bcrypt.hashpw(b"your-new-password", bcrypt.gensalt(rounds=12)).decode()

INSERT INTO api.users (username, password_hash, role, is_active)
VALUES (
    'viewer',
    '$2b$12$1wpvn5IPVDhwtX00e9hZKeMwZTL93ZKrlAHR3KUbKCD4l4fpXCive',  -- bcrypt hash of "viewer123", cost 12
    'viewer',
    true
)
ON CONFLICT (username) DO NOTHING;

-- IMPORTANT: Change the viewer password immediately after first login.
-- This seed must NOT be run in production without replacing the hash above.
