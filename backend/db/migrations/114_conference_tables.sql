-- UP Migration
-- ИИ-конференция: сессии, участники, настройки агента презентации

CREATE TABLE IF NOT EXISTS conference_sessions (
  id SERIAL PRIMARY KEY,
  contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(200),
  notes_encrypted TEXT,
  presentation_outline_encrypted TEXT,
  scheduled_at TIMESTAMPTZ,
  notify_telegram BOOLEAN NOT NULL DEFAULT false,
  notify_email BOOLEAN NOT NULL DEFAULT false,
  guest_language VARCHAR(10) NOT NULL DEFAULT 'ru',
  host_language VARCHAR(10) NOT NULL DEFAULT 'ru',
  agent_voice VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  room_id VARCHAR(64),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conference_sessions_status_check
    CHECK (status IN ('draft', 'scheduled', 'live', 'ended', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_conference_sessions_contact_status
  ON conference_sessions (contact_user_id, status);

CREATE INDEX IF NOT EXISTS idx_conference_sessions_scheduled_at
  ON conference_sessions (scheduled_at);

CREATE TABLE IF NOT EXISTS conference_participants (
  id SERIAL PRIMARY KEY,
  conference_id INTEGER NOT NULL REFERENCES conference_sessions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'participant',
  notified_via VARCHAR(20) NOT NULL DEFAULT 'none',
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conference_participants_role_check
    CHECK (role IN ('host', 'participant')),
  CONSTRAINT conference_participants_notified_check
    CHECK (notified_via IN ('email', 'telegram', 'none')),
  CONSTRAINT conference_participants_unique UNIQUE (conference_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conference_participants_user
  ON conference_participants (user_id);

CREATE TABLE IF NOT EXISTS conference_ai_agent_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  provider VARCHAR(50) NOT NULL DEFAULT 'openai',
  model VARCHAR(255),
  system_prompt_encrypted TEXT,
  temperature NUMERIC(4,2) NOT NULL DEFAULT 0.30,
  max_tokens INTEGER NOT NULL DEFAULT 1200,
  timeout_ms INTEGER NOT NULL DEFAULT 120000,
  rag_table_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  search_rag_first BOOLEAN NOT NULL DEFAULT true,
  generate_if_no_rag BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO conference_ai_agent_settings (id, enabled, provider)
VALUES (1, false, 'openai')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS conference_magic_links (
  id SERIAL PRIMARY KEY,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conference_id INTEGER REFERENCES conference_sessions(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conference_magic_links_user
  ON conference_magic_links (user_id);

CREATE TABLE IF NOT EXISTS conference_coach_rules (
  id SERIAL PRIMARY KEY,
  conference_id INTEGER NOT NULL REFERENCES conference_sessions(id) ON DELETE CASCADE,
  body_encrypted TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conference_coach_rules_conference
  ON conference_coach_rules (conference_id);

CREATE TABLE IF NOT EXISTS conference_transcript_items (
  id SERIAL PRIMARY KEY,
  conference_id INTEGER NOT NULL REFERENCES conference_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  text_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conference_transcript_role_check
    CHECK (role IN ('participant', 'agent', 'host_coach'))
);

CREATE INDEX IF NOT EXISTS idx_conference_transcript_conference
  ON conference_transcript_items (conference_id, created_at);

-- DOWN Migration
-- DROP TABLE IF EXISTS conference_transcript_items;
-- DROP TABLE IF EXISTS conference_coach_rules;
-- DROP TABLE IF EXISTS conference_magic_links;
-- DROP TABLE IF EXISTS conference_ai_agent_settings;
-- DROP TABLE IF EXISTS conference_participants;
-- DROP TABLE IF EXISTS conference_sessions;
