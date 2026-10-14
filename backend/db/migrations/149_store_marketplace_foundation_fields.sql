-- UP Migration
-- Marketplace foundation (F6–F7): anchors on store_products, no market UI

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'local'
    CHECK (origin IN ('local', 'imported_listing'));

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS export_slug TEXT;

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS chain_card_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS store_products_export_slug_uidx
  ON store_products (export_slug)
  WHERE export_slug IS NOT NULL AND length(trim(export_slug)) > 0;

COMMENT ON COLUMN store_products.origin IS 'local = CRUD этой ОС; imported_listing = задел под чужой листинг маркетплейса';
COMMENT ON COLUMN store_products.export_slug IS 'Стабильный slug для выставления во внешний каталог (маркетплейс)';
COMMENT ON COLUMN store_products.content_hash IS 'Хэш канона карточки (M1 on-chain / сверка)';
COMMENT ON COLUMN store_products.chain_card_id IS 'Id карточки в блокчейн-реестре (когда появится)';

-- DOWN Migration
-- DROP INDEX IF EXISTS store_products_export_slug_uidx;
-- ALTER TABLE store_products DROP COLUMN IF EXISTS chain_card_id;
-- ALTER TABLE store_products DROP COLUMN IF EXISTS content_hash;
-- ALTER TABLE store_products DROP COLUMN IF EXISTS export_slug;
-- ALTER TABLE store_products DROP COLUMN IF EXISTS origin;
