-- Запись голосового звонка ИИ: ссылка на content_media + транскрипт + флаг настроек
-- ai_call_sessions создаётся runtime (voiceCallSchema.js); на fresh DB таблицы ещё нет.

CREATE TABLE IF NOT EXISTS ai_call_sessions (
  id UUID PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_user_id INTEGER,
  owner_guest_id TEXT,
  invoice_id UUID,
  package_id TEXT,
  minutes INTEGER NOT NULL,
  model_call TEXT,
  status TEXT NOT NULL DEFAULT 'ready',
  ended_reason TEXT,
  ticket TEXT,
  started_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  seconds_used INTEGER NOT NULL DEFAULT 0,
  credit_debited BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_call_sessions_owner_idx
  ON ai_call_sessions (owner_type, owner_user_id, owner_guest_id, status);

ALTER TABLE ai_call_sessions
  ADD COLUMN IF NOT EXISTS recording_media_id INTEGER REFERENCES content_media(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transcript_text TEXT;

ALTER TABLE voice_call_settings
  ADD COLUMN IF NOT EXISTS save_call_recording BOOLEAN NOT NULL DEFAULT TRUE;

-- Медиатека исторически разрешала только image/video. Запись звонка — audio.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_media_media_type_check'
  ) THEN
    ALTER TABLE content_media DROP CONSTRAINT content_media_media_type_check;
  END IF;
  ALTER TABLE content_media
    ADD CONSTRAINT content_media_media_type_check
    CHECK (media_type IN ('image', 'video', 'audio'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
