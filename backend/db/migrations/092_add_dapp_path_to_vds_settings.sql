-- Migration: 092_add_dapp_path_to_vds_settings
-- Description: Добавление поля для пути к docker-compose файлу на VDS
-- Date: 2025-12-05

ALTER TABLE vds_settings
ADD COLUMN IF NOT EXISTS dapp_path TEXT;

-- Комментарии
COMMENT ON COLUMN vds_settings.dapp_path IS 'Путь к директории с docker-compose.prod.yml на VDS сервере';

