-- Migration: 098_broadcast_deliveries_unique
-- Description: Защита от дублирования доставок в одной рассылке
-- Date: 2026-07-07

CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_deliveries_campaign_recipient
  ON broadcast_deliveries(campaign_id, recipient_user_id);
