-- Persist route traces, quota spans and decision records (v1 slices 1+8).
-- No API keys. Restart must restore facts.

CREATE TABLE IF NOT EXISTS orchestrator_route_spans (
  id BIGSERIAL PRIMARY KEY,
  trace_id TEXT NOT NULL,
  job_id TEXT,
  role TEXT,
  provider TEXT,
  model TEXT,
  endpoint TEXT,
  capability TEXT,
  status TEXT NOT NULL,
  policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  error JSONB,
  critic JSONB,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orchestrator_route_spans_trace
  ON orchestrator_route_spans (trace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orchestrator_route_spans_job
  ON orchestrator_route_spans (job_id, created_at DESC)
  WHERE job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS orchestrator_quota_spans (
  id TEXT PRIMARY KEY,
  day DATE NOT NULL,
  role TEXT NOT NULL,
  provider TEXT,
  status TEXT NOT NULL,
  model TEXT,
  kind TEXT,
  latency_ms INTEGER,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_orchestrator_quota_spans_day_role
  ON orchestrator_quota_spans (day, role);

CREATE TABLE IF NOT EXISTS orchestrator_decisions (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  status TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  review_after TIMESTAMPTZ,
  supersedes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT orchestrator_decisions_status_chk
    CHECK (status IN ('proposed', 'active', 'superseded', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_orchestrator_decisions_scope_status
  ON orchestrator_decisions (scope, status);

-- DOWN
-- DROP TABLE IF EXISTS orchestrator_decisions;
-- DROP TABLE IF EXISTS orchestrator_quota_spans;
-- DROP TABLE IF EXISTS orchestrator_route_spans;
