-- Migration: 095_add_region_label_to_vds_settings
-- Description: Название кнопки текущего (основного) сервера в переключателе регионов
-- Date: 2026-07-02

ALTER TABLE vds_settings
ADD COLUMN IF NOT EXISTS region_label TEXT;

COMMENT ON COLUMN vds_settings.region_label IS 'Название кнопки текущего сервера в шапке (URL берётся из domain)';
