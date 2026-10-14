-- Bind one logical orchestrator media side effect to its durable content_media row.

CREATE TABLE IF NOT EXISTS orchestrator_media_effects (
  idempotency_key TEXT PRIMARY KEY,
  media_id INTEGER NOT NULL REFERENCES content_media(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orchestrator_media_effects_media
  ON orchestrator_media_effects (media_id);

-- DOWN
-- DROP TABLE IF EXISTS orchestrator_media_effects;
