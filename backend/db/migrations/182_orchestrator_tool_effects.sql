-- Повтор пишущего вызова карточки/таблицы не плодит вторую запись.

CREATE TABLE IF NOT EXISTS orchestrator_tool_effects (
  idempotency_key TEXT PRIMARY KEY,
  tool TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orchestrator_tool_effects_tool
  ON orchestrator_tool_effects (tool, created_at DESC);

-- DOWN
-- DROP TABLE IF EXISTS orchestrator_tool_effects;
