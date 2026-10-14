-- Migration: 107_blog_feed_filters
-- Description: Фильтры ленты блога и закреплённые статьи (настройки редактора)
-- Date: 2026-07-18

CREATE TABLE IF NOT EXISTS blog_feed_filters (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  label_ru VARCHAR(120) NOT NULL,
  label_en VARCHAR(120) NOT NULL,
  sort_by VARCHAR(32) NOT NULL DEFAULT 'new',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_feed_filters_sort_by_check
    CHECK (sort_by IN ('new', 'views', 'likes', 'comments', 'popular'))
);

CREATE TABLE IF NOT EXISTS blog_pinned_pages (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL UNIQUE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_feed_filters_active_position
  ON blog_feed_filters (is_active, position);

CREATE INDEX IF NOT EXISTS idx_blog_pinned_pages_position
  ON blog_pinned_pages (position);

INSERT INTO blog_feed_filters (slug, label_ru, label_en, sort_by, is_default, is_active, position)
VALUES
  ('new', 'Новые', 'New', 'new', TRUE, TRUE, 0),
  ('popular', 'Популярные', 'Popular', 'popular', FALSE, TRUE, 1),
  ('views', 'По просмотрам', 'By views', 'views', FALSE, TRUE, 2),
  ('likes', 'По лайкам', 'By likes', 'likes', FALSE, TRUE, 3),
  ('comments', 'По комментариям', 'By comments', 'comments', FALSE, TRUE, 4)
ON CONFLICT (slug) DO NOTHING;
