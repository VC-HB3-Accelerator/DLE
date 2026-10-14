-- Durable orchestration state. Execution leases and idempotency belong to R4b.

CREATE TABLE IF NOT EXISTS orchestrator_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  run_mode TEXT,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orchestrator_jobs_status_updated
  ON orchestrator_jobs (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS orchestrator_job_steps (
  job_id TEXT NOT NULL REFERENCES orchestrator_jobs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  PRIMARY KEY (job_id, step_id)
);

CREATE TABLE IF NOT EXISTS orchestrator_approvals (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES orchestrator_jobs(id) ON DELETE CASCADE,
  step_id TEXT,
  status TEXT NOT NULL,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  CONSTRAINT orchestrator_approvals_status_chk
    CHECK (status IN ('proposed', 'approved', 'rejected', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_orchestrator_approvals_job_status
  ON orchestrator_approvals (job_id, status, requested_at DESC);

-- DOWN
-- DROP TABLE IF EXISTS orchestrator_approvals;
-- DROP TABLE IF EXISTS orchestrator_job_steps;
-- DROP TABLE IF EXISTS orchestrator_jobs;
