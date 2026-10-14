-- UP Migration
-- Shared catalog taxonomy for store + blog linked filters

CREATE TABLE IF NOT EXISTS catalog_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL
    CHECK (kind IN ('category', 'condition', 'country', 'region', 'city')),
  slug TEXT NOT NULL,
  label_ru TEXT NOT NULL,
  label_en TEXT NOT NULL DEFAULT '',
  parent_id UUID REFERENCES catalog_terms(id) ON DELETE CASCADE,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, slug)
);

CREATE INDEX IF NOT EXISTS catalog_terms_kind_active_idx
  ON catalog_terms (kind, active, sort_order, label_ru);

CREATE INDEX IF NOT EXISTS catalog_terms_parent_idx
  ON catalog_terms (parent_id, sort_order, label_ru);

CREATE TABLE IF NOT EXISTS store_product_terms (
  product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES catalog_terms(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, term_id)
);

CREATE INDEX IF NOT EXISTS store_product_terms_term_idx
  ON store_product_terms (term_id);

CREATE TABLE IF NOT EXISTS page_catalog_terms (
  page_id INTEGER NOT NULL REFERENCES admin_pages_simple(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES catalog_terms(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, term_id)
);

CREATE INDEX IF NOT EXISTS page_catalog_terms_term_idx
  ON page_catalog_terms (term_id);

-- DOWN Migration
DROP TABLE IF EXISTS page_catalog_terms;
DROP TABLE IF EXISTS store_product_terms;
DROP TABLE IF EXISTS catalog_terms;
