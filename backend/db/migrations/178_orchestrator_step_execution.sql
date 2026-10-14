-- R4b: execution ownership and replay protection for durable steps.

ALTER TABLE orchestrator_job_steps
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS lease_owner TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS result JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orchestrator_steps_idempotency_key
  ON orchestrator_job_steps (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orchestrator_steps_active_lease
  ON orchestrator_job_steps (lease_expires_at)
  WHERE lease_owner IS NOT NULL;

-- DOWN
-- DROP INDEX IF EXISTS idx_orchestrator_steps_active_lease;
-- DROP INDEX IF EXISTS idx_orchestrator_steps_idempotency_key;
-- ALTER TABLE orchestrator_job_steps
--   DROP COLUMN IF EXISTS result,
--   DROP COLUMN IF EXISTS attempt,
--   DROP COLUMN IF EXISTS heartbeat_at,
--   DROP COLUMN IF EXISTS lease_expires_at,
--   DROP COLUMN IF EXISTS lease_owner,
--   DROP COLUMN IF EXISTS idempotency_key;
