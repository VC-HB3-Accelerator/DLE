-- Одна живая беседа оркестратора на owner_user_id. Id выдаёт сервер.

ALTER TABLE media_agent_sessions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

WITH keep AS (
  SELECT DISTINCT ON (owner_user_id) id
  FROM media_agent_sessions
  WHERE archived_at IS NULL
  ORDER BY owner_user_id, updated_at DESC
)
UPDATE media_agent_sessions
SET archived_at = NOW()
WHERE archived_at IS NULL
  AND id NOT IN (SELECT id FROM keep);

CREATE UNIQUE INDEX IF NOT EXISTS media_agent_sessions_one_live
  ON media_agent_sessions (owner_user_id)
  WHERE archived_at IS NULL;

-- DOWN
-- DROP INDEX IF EXISTS media_agent_sessions_one_live;
-- ALTER TABLE media_agent_sessions DROP COLUMN IF EXISTS archived_at;
