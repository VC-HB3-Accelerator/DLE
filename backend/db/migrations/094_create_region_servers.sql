-- Migration: 094_create_region_servers
-- Description: Таблица региональных серверов для переключателя в шапке
-- Date: 2026-07-02

CREATE TABLE IF NOT EXISTS region_servers (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  url         TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_region_servers_sort_order ON region_servers(sort_order ASC, id ASC);

COMMENT ON TABLE region_servers IS 'Региональные серверы (кнопки переключения в шапке)';
COMMENT ON COLUMN region_servers.slug IS 'Уникальный идентификатор региона (ru, en, 643 и т.д.)';
COMMENT ON COLUMN region_servers.label IS 'Текст кнопки в интерфейсе';
COMMENT ON COLUMN region_servers.url IS 'Базовый URL сервера (https://...)';
COMMENT ON COLUMN region_servers.sort_order IS 'Порядок отображения кнопок';
