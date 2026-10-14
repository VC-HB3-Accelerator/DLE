-- Migration: 100_broadcast_bounce_tracking
-- Description: Учёт отказов доставки (bounce/NDR) для массовых рассылок
-- Date: 2026-07-08

ALTER TABLE broadcast_campaigns
  ADD COLUMN IF NOT EXISTS bounce_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE broadcast_deliveries
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_status
  ON broadcast_deliveries(status);

CREATE TABLE IF NOT EXISTS broadcast_bounce_events (
  id                  SERIAL PRIMARY KEY,
  bounce_message_id   TEXT,
  recipient_email     TEXT NOT NULL,
  campaign_id         INTEGER REFERENCES broadcast_campaigns(id) ON DELETE SET NULL,
  delivery_id         INTEGER REFERENCES broadcast_deliveries(id) ON DELETE SET NULL,
  diagnostic_message  TEXT,
  processed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_bounce_events_message_recipient
  ON broadcast_bounce_events(bounce_message_id, LOWER(recipient_email))
  WHERE bounce_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_bounce_events_recipient_email
  ON broadcast_bounce_events(LOWER(recipient_email));

COMMENT ON COLUMN broadcast_campaigns.bounce_count IS 'Количество отказов доставки (bounce/NDR) после принятия SMTP';
COMMENT ON COLUMN broadcast_deliveries.bounced_at IS 'Время получения отчёта о недоставке';
