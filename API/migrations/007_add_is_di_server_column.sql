-- Migration 007: Add is_di_server column to config.servers
--
-- The API model and repo already reference this column; the DDL must exist
-- in the database for all SELECT / RETURNING queries to work.

ALTER TABLE config.servers
    ADD COLUMN IF NOT EXISTS is_di_server BOOLEAN NOT NULL DEFAULT false;
