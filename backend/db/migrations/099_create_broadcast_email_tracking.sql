-- Migration: 099_create_broadcast_email_tracking
-- Description: Отслеживание открытий email-рассылок (tracking pixel)
-- Date: 2026-07-07

CREATE TABLE IF NOT EXISTS broadcast_email_tracking (
  id                  SERIAL PRIMARY KEY,
  token               VARCHAR(64) NOT NULL UNIQUE,
  campaign_id         INTEGER NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  recipient_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_email     TEXT,
  open_count          INTEGER NOT NULL DEFAULT 0,
  first_opened_at     TIMESTAMPTZ,
  last_opened_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_email_tracking_campaign_recipient
  ON broadcast_email_tracking(campaign_id, recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_email_tracking_token ON broadcast_email_tracking(token);
CREATE INDEX IF NOT EXISTS idx_broadcast_email_tracking_campaign_id ON broadcast_email_tracking(campaign_id);

COMMENT ON TABLE broadcast_email_tracking IS 'Трекинг открытий писем массовых рассылок';
