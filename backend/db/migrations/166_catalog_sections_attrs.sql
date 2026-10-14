-- UP Migration
-- Разделы каталога + динамические поля (ключ/значение) на страницах и товарах.
-- Старый сид Авто/состояние/гео (catalog_terms kinds) для продукта не используем.

CREATE TABLE IF NOT EXISTS catalog_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label_ru TEXT NOT NULL,
  label_en TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  filter_keys TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS catalog_sections_active_sort_idx
  ON catalog_sections (active, sort_order, label_ru);

CREATE TABLE IF NOT EXISTS page_catalog_attrs (
  page_id INTEGER NOT NULL REFERENCES admin_pages_simple(id) ON DELETE CASCADE,
  attr_key TEXT NOT NULL,
  attr_value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (page_id, attr_key, attr_value)
);

CREATE INDEX IF NOT EXISTS page_catalog_attrs_key_idx
  ON page_catalog_attrs (attr_key, attr_value);

CREATE TABLE IF NOT EXISTS store_product_attrs (
  product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  attr_key TEXT NOT NULL,
  attr_value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, attr_key, attr_value)
);

CREATE INDEX IF NOT EXISTS store_product_attrs_key_idx
  ON store_product_attrs (attr_key, attr_value);

ALTER TABLE admin_pages_simple
  ADD COLUMN IF NOT EXISTS catalog_section_id UUID REFERENCES catalog_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS admin_pages_simple_catalog_section_idx
  ON admin_pages_simple (catalog_section_id)
  WHERE catalog_section_id IS NOT NULL;

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS catalog_section_id UUID REFERENCES catalog_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS store_products_catalog_section_idx
  ON store_products (catalog_section_id)
  WHERE catalog_section_id IS NOT NULL;

-- DOWN Migration
-- ALTER TABLE store_products DROP COLUMN IF EXISTS catalog_section_id;
-- ALTER TABLE admin_pages_simple DROP COLUMN IF EXISTS catalog_section_id;
-- DROP TABLE IF EXISTS store_product_attrs;
-- DROP TABLE IF EXISTS page_catalog_attrs;
-- DROP TABLE IF EXISTS catalog_sections;
