-- Migration: 176_orchestrator_capability_observations
-- Append-only facts about provider discovery and real route calls.
-- API keys are never stored; credential_fingerprint separates rotated keys.

CREATE TABLE IF NOT EXISTS capability_observations (
  id BIGSERIAL PRIMARY KEY,
  connection_id TEXT NOT NULL,
  key_type TEXT NOT NULL,
  credential_fingerprint CHAR(64) NOT NULL,
  base_url TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  capability TEXT NOT NULL,
  outcome TEXT NOT NULL,
  health_scope TEXT NOT NULL DEFAULT 'none',
  permanent BOOLEAN NOT NULL DEFAULT FALSE,
  retryable BOOLEAN NOT NULL DEFAULT FALSE,
  status INTEGER,
  error_code TEXT,
  error_message TEXT,
  latency_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  CONSTRAINT capability_observations_latency_chk
    CHECK (latency_ms IS NULL OR latency_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_capability_observations_route_fresh
  ON capability_observations (
    connection_id,
    credential_fingerprint,
    endpoint,
    model,
    capability,
    observed_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_capability_observations_expires
  ON capability_observations (expires_at)
  WHERE expires_at IS NOT NULL;

-- DOWN
-- DROP TABLE IF EXISTS capability_observations;
