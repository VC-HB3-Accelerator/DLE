-- UP Migration
-- Настройки ИИ-агента персонализации рассылки + флаг на кампании

CREATE TABLE IF NOT EXISTS broadcast_ai_agent_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  provider VARCHAR(50) NOT NULL DEFAULT 'ollama',
  model VARCHAR(255),
  system_prompt_encrypted TEXT,
  temperature NUMERIC(4,2) NOT NULL DEFAULT 0.30,
  max_tokens INTEGER NOT NULL DEFAULT 800,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO broadcast_ai_agent_settings (id, enabled, provider)
VALUES (1, false, 'ollama')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE broadcast_campaigns
  ADD COLUMN IF NOT EXISTS ai_personalize BOOLEAN NOT NULL DEFAULT false;

-- DOWN Migration
-- ALTER TABLE broadcast_campaigns DROP COLUMN IF EXISTS ai_personalize;
-- DROP TABLE IF EXISTS broadcast_ai_agent_settings;
