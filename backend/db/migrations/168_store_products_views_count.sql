-- UP Migration
-- Счётчик просмотров карточки товара (как views_count у статей ленты)

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0;

-- DOWN Migration
-- ALTER TABLE store_products DROP COLUMN IF EXISTS views_count;
