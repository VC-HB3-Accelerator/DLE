-- UP Migration
-- Миграция: category_id в admin_pages_simple (связь со структурой категорий docs)
-- Идемпотентно: колонка могла уже появиться вручную — ADD только если нет

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'admin_pages_simple'
  ) THEN
    RAISE NOTICE 'Таблица admin_pages_simple не существует, пропускаем 130_add_category_id_to_admin_pages_simple.sql';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_pages_simple'
      AND column_name = 'category_id'
  ) THEN
    ALTER TABLE admin_pages_simple
      ADD COLUMN category_id INTEGER;
  END IF;
END $$;

COMMENT ON COLUMN admin_pages_simple.category_id IS 'ID категории документации (docs structure)';

CREATE INDEX IF NOT EXISTS idx_admin_pages_simple_category_id
  ON admin_pages_simple (category_id)
  WHERE category_id IS NOT NULL;

-- DOWN Migration
-- ALTER TABLE admin_pages_simple DROP COLUMN IF EXISTS category_id;
-- DROP INDEX IF EXISTS idx_admin_pages_simple_category_id;
