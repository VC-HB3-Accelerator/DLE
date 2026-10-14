-- Migration: 174_media_agent_sessions
-- История задач медиа-агента в БД: по контакту (users.id) или общая студия (contact NULL)

CREATE TABLE IF NOT EXISTS media_agent_sessions (
  id TEXT PRIMARY KEY,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  skill_id TEXT NOT NULL DEFAULT '',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_agent_sessions_contact_updated
  ON media_agent_sessions (contact_user_id, updated_at DESC)
  WHERE contact_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_agent_sessions_owner_studio
  ON media_agent_sessions (owner_user_id, updated_at DESC)
  WHERE contact_user_id IS NULL;

-- DOWN
-- DROP TABLE IF EXISTS media_agent_sessions;
