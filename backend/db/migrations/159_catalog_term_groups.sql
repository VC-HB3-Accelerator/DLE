-- UP Migration
-- Add top-level catalog group (Авто / Спецтехника / Оборудование / Недвижимость)

ALTER TABLE catalog_terms DROP CONSTRAINT IF EXISTS catalog_terms_kind_check;
ALTER TABLE catalog_terms
  ADD CONSTRAINT catalog_terms_kind_check
  CHECK (kind IN ('group', 'category', 'condition', 'country', 'region', 'city'));

-- DOWN Migration
ALTER TABLE catalog_terms DROP CONSTRAINT IF EXISTS catalog_terms_kind_check;
ALTER TABLE catalog_terms
  ADD CONSTRAINT catalog_terms_kind_check
  CHECK (kind IN ('category', 'condition', 'country', 'region', 'city'));
