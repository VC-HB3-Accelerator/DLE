-- UP Migration
-- 134_ai_providers_proxy_targets.sql
-- Раздельные цели исходящего SOCKS (VPN-страница): OpenAI / Telegram

ALTER TABLE ai_providers_settings
  ADD COLUMN IF NOT EXISTS proxy_openai BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE ai_providers_settings
  ADD COLUMN IF NOT EXISTS proxy_telegram BOOLEAN NOT NULL DEFAULT false;

-- Сохранить прежнее поведение OpenAI, если Blanc уже был включён
UPDATE ai_providers_settings
SET proxy_openai = true
WHERE COALESCE(proxy_enabled, false) = true
  AND proxy_openai = false;

COMMENT ON COLUMN ai_providers_settings.proxy_openai IS
  'Если true и proxy_enabled — OpenAI ходит через Blanc/SOCKS';
COMMENT ON COLUMN ai_providers_settings.proxy_telegram IS
  'Если true и proxy_enabled — Telegram Bot (Telegraf) ходит через Blanc/SOCKS';

-- DOWN Migration
-- ALTER TABLE ai_providers_settings DROP COLUMN IF EXISTS proxy_openai;
-- ALTER TABLE ai_providers_settings DROP COLUMN IF EXISTS proxy_telegram;
