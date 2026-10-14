-- Store products: summary, features, attributes, benefit_note (full product page)

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS features TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS benefit_note TEXT NOT NULL DEFAULT '';
