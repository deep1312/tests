-- Migration 002: Create api.users table
-- Stores API user accounts with hashed passwords and role-based access control.
-- Passwords are stored as bcrypt (cost 12) or Argon2id hashes — never plaintext.

CREATE TABLE api.users (
    user_id       SERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,       -- bcrypt or Argon2id hash; never plaintext
    role          TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
