-- Migration: 097_create_broadcast_templates
-- Description: Шаблоны темы и тела письма для массовых рассылок
-- Date: 2026-07-07

CREATE TABLE IF NOT EXISTS broadcast_templates (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_templates_updated_at ON broadcast_templates(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_templates_created_by ON broadcast_templates(created_by);

COMMENT ON TABLE broadcast_templates IS 'Шаблоны темы и текста для массовых рассылок';
