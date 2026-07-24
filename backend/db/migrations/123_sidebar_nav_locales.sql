-- Migration: 123_sidebar_nav_locales
-- Description: Включённые языки UI для переключателя в сайдбаре
-- Date: 2026-07-24

ALTER TABLE sidebar_nav_settings
  ADD COLUMN IF NOT EXISTS locales_json JSONB NOT NULL DEFAULT '["ru","en"]'::jsonb;

UPDATE sidebar_nav_settings
SET locales_json = '["ru","en"]'::jsonb
WHERE locales_json IS NULL;

COMMENT ON COLUMN sidebar_nav_settings.locales_json IS 'JSON-массив кодов языков, например ["ru","en"]. Кнопка языка в сайдбаре при length >= 2.';

-- DOWN
-- ALTER TABLE sidebar_nav_settings DROP COLUMN IF EXISTS locales_json;
