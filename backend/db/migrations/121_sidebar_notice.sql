-- Migration: 121_sidebar_notice
-- Description: Редактируемый текст в сайдбаре (плюс жёсткая ссылка на Политику в UI)
-- Date: 2026-07-23

CREATE TABLE IF NOT EXISTS sidebar_notice (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  body TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INTEGER
);

INSERT INTO sidebar_notice (id, body)
VALUES (1, '')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE sidebar_notice IS 'Текст уведомления в правом сайдбаре после навигации';
COMMENT ON COLUMN sidebar_notice.body IS 'Произвольный текст редактора (plain text)';
COMMENT ON COLUMN sidebar_notice.updated_by IS 'users.id редактора, сохранившего текст';

-- DOWN
-- DROP TABLE IF EXISTS sidebar_notice;
