-- UP Migration
-- Справочник значений для ключей фильтров раздела (JSONB: { "Страна": ["Россия", ...] }).

ALTER TABLE catalog_sections
  ADD COLUMN IF NOT EXISTS filter_values JSONB NOT NULL DEFAULT '{}'::jsonb;

-- DOWN Migration
-- ALTER TABLE catalog_sections DROP COLUMN IF EXISTS filter_values;
