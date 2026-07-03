-- Migration 004: Seed default admin user (DEVELOPMENT BOOTSTRAP ONLY)
--
-- WARNING: This seed is intended for local development and initial deployment
-- bootstrapping ONLY. The placeholder password MUST be changed before the
-- system is used in any non-development environment.
--
-- Placeholder password: "changeme"
-- Hash below: bcrypt, cost factor 12
--
-- To generate a new hash (Python):
--   import bcrypt
--   bcrypt.hashpw(b"your-new-password", bcrypt.gensalt(rounds=12)).decode()
--
-- To generate a new hash (CLI):
--   htpasswd -bnBC 12 "" your-new-password | tr -d ':\n'

INSERT INTO api.users (username, password_hash, role, is_active)
VALUES (
    'admin',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',  -- bcrypt hash of "changeme", cost 12
    'admin',
    true
)
ON CONFLICT (username) DO NOTHING;

-- IMPORTANT: Change the admin password immediately after first login.
-- This seed must NOT be run in production without replacing the hash above.
