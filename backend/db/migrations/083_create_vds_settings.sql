-- Migration: 083_create_vds_settings
-- Description: Создание таблицы для хранения настроек VDS (домен)
-- Date: 2025-11-14

CREATE TABLE IF NOT EXISTS vds_settings (
  id SERIAL PRIMARY KEY,
  domain_encrypted TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_vds_settings_updated_at ON vds_settings(updated_at DESC);

-- Комментарии
COMMENT ON TABLE vds_settings IS 'Настройки VDS сервера (домен)';
COMMENT ON COLUMN vds_settings.domain_encrypted IS 'Зашифрованный домен VDS сервера';



