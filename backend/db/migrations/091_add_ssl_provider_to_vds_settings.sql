-- Migration: 091_add_ssl_provider_to_vds_settings
-- Description: Добавление поля для выбора провайдера SSL (Let's Encrypt или ZeroSSL)
-- Date: 2025-12-05

ALTER TABLE vds_settings
ADD COLUMN IF NOT EXISTS ssl_provider TEXT DEFAULT 'letsencrypt';

-- Комментарии
COMMENT ON COLUMN vds_settings.ssl_provider IS 'Провайдер SSL сертификата: letsencrypt или zerossl';

