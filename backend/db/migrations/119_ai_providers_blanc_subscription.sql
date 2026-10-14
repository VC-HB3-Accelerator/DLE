-- Подписка BlancVPN (https://…/s/… или vless://) для исходящего Xray
ALTER TABLE ai_providers_settings
  ADD COLUMN IF NOT EXISTS blanc_subscription_url_encrypted TEXT;
