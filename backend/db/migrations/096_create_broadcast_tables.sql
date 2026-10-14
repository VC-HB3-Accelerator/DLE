-- Migration: 096_create_broadcast_tables
-- Description: Таблицы для истории и аналитики массовых рассылок
-- Date: 2026-07-07

CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id                SERIAL PRIMARY KEY,
  sender_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subject           TEXT NOT NULL,
  message_preview   TEXT,
  total_recipients  INTEGER NOT NULL DEFAULT 0,
  planned_recipients INTEGER NOT NULL DEFAULT 0,
  success_count     INTEGER NOT NULL DEFAULT 0,
  error_count       INTEGER NOT NULL DEFAULT 0,
  skipped_count     INTEGER NOT NULL DEFAULT 0,
  warmup_mode       BOOLEAN NOT NULL DEFAULT FALSE,
  delay_seconds     INTEGER NOT NULL DEFAULT 0,
  attachments_count INTEGER NOT NULL DEFAULT 0,
  status            VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS broadcast_deliveries (
  id                  SERIAL PRIMARY KEY,
  campaign_id         INTEGER NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  recipient_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status              VARCHAR(20) NOT NULL,
  channel_results     JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message       TEXT,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_sender_id ON broadcast_campaigns(sender_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_started_at ON broadcast_campaigns(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status ON broadcast_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_campaign_id ON broadcast_deliveries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_recipient_user_id ON broadcast_deliveries(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_sent_at ON broadcast_deliveries(sent_at DESC);

COMMENT ON TABLE broadcast_campaigns IS 'Запуски массовых рассылок';
COMMENT ON TABLE broadcast_deliveries IS 'Доставка рассылки конкретному получателю';
