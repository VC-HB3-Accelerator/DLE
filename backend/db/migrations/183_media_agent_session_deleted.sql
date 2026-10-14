-- Удаление из «Недавних» отдельно от архива «Новая задача».
-- Архив остаётся в списке. Удалённая беседа — нет.

ALTER TABLE media_agent_sessions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- DOWN
-- ALTER TABLE media_agent_sessions DROP COLUMN IF EXISTS deleted_at;
