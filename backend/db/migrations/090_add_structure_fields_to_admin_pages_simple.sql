-- UP Migration
-- Миграция: добавление структурных полей (category, parent_id, order_index, nav_path, is_index_page)
-- в таблицу admin_pages_simple. Аналогично 085_add_vitepress_structure_to_pages.sql,
-- но выполняется повторно после того, как таблица уже существует.

DO $$
BEGIN
  -- Проверяем существование таблицы
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'admin_pages_simple'
  ) THEN
    RAISE NOTICE 'Таблица admin_pages_simple не существует, пропускаем миграцию 090_add_structure_fields_to_admin_pages_simple.sql';
    RETURN;
  END IF;

  -- Категория документа (строковое имя категории)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_pages_simple' AND column_name = 'category'
  ) THEN
    ALTER TABLE admin_pages_simple ADD COLUMN category VARCHAR(100) DEFAULT NULL;
  END IF;

  -- ID родительского документа (для иерархии)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_pages_simple' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE admin_pages_simple ADD COLUMN parent_id INTEGER DEFAULT NULL;
  END IF;

  -- Порядок сортировки в категории
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_pages_simple' AND column_name = 'order_index'
  ) THEN
    ALTER TABLE admin_pages_simple ADD COLUMN order_index INTEGER DEFAULT 0;
  END IF;

  -- Путь в навигации (например: "docs/setup/installation")
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_pages_simple' AND column_name = 'nav_path'
  ) THEN
    ALTER TABLE admin_pages_simple ADD COLUMN nav_path VARCHAR(255) DEFAULT NULL;
  END IF;

  -- Флаг индексной страницы категории
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_pages_simple' AND column_name = 'is_index_page'
  ) THEN
    ALTER TABLE admin_pages_simple ADD COLUMN is_index_page BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Создание индексов (безопасно выполнять повторно)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'admin_pages_simple'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_pages_category ON admin_pages_simple(category) WHERE category IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON admin_pages_simple(parent_id) WHERE parent_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_pages_nav_path ON admin_pages_simple(nav_path) WHERE nav_path IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_pages_order ON admin_pages_simple(category, order_index, created_at);
  END IF;
END $$;

-- DOWN Migration
-- Откат: удаляем добавленные колонки (индексы дропнутся автоматически с колонками или можно дропнуть вручную)

ALTER TABLE admin_pages_simple DROP COLUMN IF EXISTS is_index_page;
ALTER TABLE admin_pages_simple DROP COLUMN IF EXISTS nav_path;
ALTER TABLE admin_pages_simple DROP COLUMN IF EXISTS order_index;
ALTER TABLE admin_pages_simple DROP COLUMN IF EXISTS parent_id;
ALTER TABLE admin_pages_simple DROP COLUMN IF EXISTS category;













