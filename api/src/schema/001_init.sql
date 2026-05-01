-- Bootstrap: pgvector extension + the migrations bookkeeping table.
-- Idempotent so the migrate runner can re-run on every deploy.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS _migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
