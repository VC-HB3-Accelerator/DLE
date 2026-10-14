-- UP Migration
-- Базовая таблица страниц/блога.
-- Раньше создавалась только runtime (seed/ensureTable) — на чистой БД
-- миграции 085–093 пропускались, а 103 падала на FK.

CREATE TABLE IF NOT EXISTS admin_pages_simple (
  id SERIAL PRIMARY KEY,
  author_address TEXT NULL,
  title TEXT,
  summary TEXT,
  content TEXT,
  seo JSONB,
  status TEXT,
  visibility TEXT,
  required_permission TEXT,
  format TEXT,
  mime_type TEXT,
  storage_type TEXT,
  file_path TEXT,
  size_bytes BIGINT,
  checksum TEXT,
  is_system_template BOOLEAN DEFAULT FALSE,
  show_in_blog BOOLEAN DEFAULT FALSE,
  slug TEXT,
  category TEXT,
  category_id INTEGER,
  parent_id INTEGER,
  order_index INTEGER DEFAULT 0,
  nav_path TEXT,
  is_index_page BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT NULL,
  owner_user_id INTEGER,
  owner_domain TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_admin_pages_simple_parent'
  ) THEN
    ALTER TABLE admin_pages_simple
      ADD CONSTRAINT fk_admin_pages_simple_parent
      FOREIGN KEY (parent_id)
      REFERENCES admin_pages_simple(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS admin_pages_simple_slug_unique
  ON admin_pages_simple (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_pages_simple_category
  ON admin_pages_simple (category)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_pages_simple_parent_id
  ON admin_pages_simple (parent_id)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_pages_simple_category_id
  ON admin_pages_simple (category_id)
  WHERE category_id IS NOT NULL;

COMMENT ON TABLE admin_pages_simple IS
  'Страницы контента / блог / правовые документы (создаётся миграцией 102 для fresh install)';

-- DOWN Migration
-- DROP INDEX IF EXISTS idx_admin_pages_simple_category_id;
-- DROP INDEX IF EXISTS idx_admin_pages_simple_parent_id;
-- DROP INDEX IF EXISTS idx_admin_pages_simple_category;
-- DROP INDEX IF EXISTS admin_pages_simple_slug_unique;
-- ALTER TABLE admin_pages_simple DROP CONSTRAINT IF EXISTS fk_admin_pages_simple_parent;
-- DROP TABLE IF EXISTS admin_pages_simple;
