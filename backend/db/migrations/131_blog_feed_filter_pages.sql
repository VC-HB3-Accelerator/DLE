-- UP Migration
-- Подборка статей в фильтрах ленты блога (curated membership)
-- Если у фильтра нет строк в blog_feed_filter_pages — лента показывает все статьи (как раньше).
-- Если есть — только выбранненные page_id, затем по sort_by фильтра.

CREATE TABLE IF NOT EXISTS blog_feed_filter_pages (
  id SERIAL PRIMARY KEY,
  filter_id INTEGER NOT NULL REFERENCES blog_feed_filters(id) ON DELETE CASCADE,
  page_id INTEGER NOT NULL REFERENCES admin_pages_simple(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_feed_filter_pages_unique UNIQUE (filter_id, page_id)
);

CREATE INDEX IF NOT EXISTS idx_blog_feed_filter_pages_filter_pos
  ON blog_feed_filter_pages (filter_id, position, id);

CREATE INDEX IF NOT EXISTS idx_blog_feed_filter_pages_page
  ON blog_feed_filter_pages (page_id);

COMMENT ON TABLE blog_feed_filter_pages IS 'Статьи в подборке фильтра ленты блога';

-- DOWN Migration
-- DROP TABLE IF EXISTS blog_feed_filter_pages;
