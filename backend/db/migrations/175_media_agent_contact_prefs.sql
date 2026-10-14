-- Migration: 175_media_agent_contact_prefs
-- Режим AI (оркестратор) на карточке контакта — переживает обновление страницы

CREATE TABLE IF NOT EXISTS media_agent_contact_prefs (
  contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contact_user_id, owner_user_id)
);

CREATE INDEX IF NOT EXISTS idx_media_agent_contact_prefs_owner
  ON media_agent_contact_prefs (owner_user_id, updated_at DESC);

-- DOWN
-- DROP TABLE IF EXISTS media_agent_contact_prefs;
