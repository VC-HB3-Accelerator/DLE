-- Migration: 122_sidebar_nav_settings
-- Description: Видимость опциональных кнопок сайдбара (репозитории / позже магазин и т.д.)
-- Date: 2026-07-24

CREATE TABLE IF NOT EXISTS sidebar_nav_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  buttons_json JSONB NOT NULL DEFAULT '{"repositories": false}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INTEGER
);

INSERT INTO sidebar_nav_settings (id, buttons_json)
VALUES (1, '{"repositories": false}'::jsonb)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE sidebar_nav_settings IS 'Флаги отображения опциональных кнопок в правом сайдбаре';
COMMENT ON COLUMN sidebar_nav_settings.buttons_json IS 'JSON: { repositories: bool, ... }';

-- DOWN
-- DROP TABLE IF EXISTS sidebar_nav_settings;
