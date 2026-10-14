-- Migration: 101_broadcast_queue
-- Description: Очередь рассылок на backend и журнал событий
-- Date: 2026-07-09

ALTER TABLE broadcast_campaigns
  ADD COLUMN IF NOT EXISTS message_body TEXT,
  ADD COLUMN IF NOT EXISTS recipient_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT;

CREATE TABLE IF NOT EXISTS broadcast_campaign_events (
  id          SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  event_type  VARCHAR(32) NOT NULL,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcast_campaign_attachments (
  id           SERIAL PRIMARY KEY,
  campaign_id  INTEGER NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  content_type TEXT,
  storage_path TEXT NOT NULL,
  file_size    INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaign_events_campaign_id
  ON broadcast_campaign_events(campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaign_attachments_campaign_id
  ON broadcast_campaign_attachments(campaign_id);

COMMENT ON TABLE broadcast_campaign_events IS 'Журнал событий рассылки: started, paused, resumed, completed, interrupted';
COMMENT ON TABLE broadcast_campaign_attachments IS 'Вложения рассылки, сохранённые на сервере';
