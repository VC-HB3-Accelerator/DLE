-- UP Migration
-- Динамический таймаут LLM для AI-агента рассылки (мс)

ALTER TABLE broadcast_ai_agent_settings
  ADD COLUMN IF NOT EXISTS timeout_ms INTEGER NOT NULL DEFAULT 420000;

-- 7 минут по умолчанию (диапазон 6–8 мин)
UPDATE broadcast_ai_agent_settings
SET timeout_ms = 420000
WHERE id = 1 AND (timeout_ms IS NULL OR timeout_ms < 60000);

-- DOWN Migration
-- ALTER TABLE broadcast_ai_agent_settings DROP COLUMN IF EXISTS timeout_ms;
