-- UP Migration
-- Модерация карточек магазина: draft → pending → published | rejected

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS moderation_note TEXT;

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

UPDATE store_products
SET moderation_status = CASE
  WHEN published = TRUE THEN 'published'
  ELSE 'draft'
END
WHERE moderation_status IS NULL
   OR moderation_status = ''
   OR moderation_status NOT IN ('draft', 'pending', 'published', 'rejected');

CREATE INDEX IF NOT EXISTS store_products_moderation_status_idx
  ON store_products (moderation_status, updated_at DESC);

COMMENT ON COLUMN store_products.moderation_status IS
  'draft|pending|published|rejected — очередь модерации редактора';

-- DOWN Migration
-- DROP INDEX IF EXISTS store_products_moderation_status_idx;
-- ALTER TABLE store_products DROP COLUMN IF EXISTS reviewed_by;
-- ALTER TABLE store_products DROP COLUMN IF EXISTS reviewed_at;
-- ALTER TABLE store_products DROP COLUMN IF EXISTS submitted_at;
-- ALTER TABLE store_products DROP COLUMN IF EXISTS moderation_note;
-- ALTER TABLE store_products DROP COLUMN IF EXISTS moderation_status;
