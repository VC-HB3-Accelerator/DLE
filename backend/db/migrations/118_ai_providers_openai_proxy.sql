-- Исходящий HTTP(S)/SOCKS прокси для OpenAI (обход geo-block с VDS в РФ)
ALTER TABLE ai_providers_settings
  ADD COLUMN IF NOT EXISTS proxy_url_encrypted TEXT;

ALTER TABLE ai_providers_settings
  ADD COLUMN IF NOT EXISTS proxy_enabled BOOLEAN NOT NULL DEFAULT false;
