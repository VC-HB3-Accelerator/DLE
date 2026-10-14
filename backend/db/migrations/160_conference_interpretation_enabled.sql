-- UP Migration
-- Лайв-синхрон: флаг interpretation_enabled в БД (переживает рестарт)

ALTER TABLE conference_sessions
  ADD COLUMN IF NOT EXISTS interpretation_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN conference_sessions.interpretation_enabled IS
  'Лайв-синхрон речи host↔participant (перевод + озвучка)';

-- DOWN Migration
-- ALTER TABLE conference_sessions DROP COLUMN IF EXISTS interpretation_enabled;
