-- UP Migration
-- Миграция: Добавление полей структуры VitePress для страниц
-- Добавляет поддержку категорий, иерархии и навигации

-- Добавляем новые поля в таблицу admin_pages_simple
DO $$ 
BEGIN
  -- Проверяем существование таблицы
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'admin_pages_simple'
  ) THEN
    RAISE NOTICE 'Таблица admin_pages_simple не существует, пропускаем миграцию';
    RETURN;
  END IF;

  -- Категория документа
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
    -- Добавляем внешний ключ (self-reference)
    ALTER TABLE admin_pages_simple 
      ADD CONSTRAINT fk_parent_page 
      FOREIGN KEY (parent_id) 
      REFERENCES admin_pages_simple(id) 
      ON DELETE SET NULL;
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

-- Создаем индексы для оптимизации запросов (только если таблица существует)
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

-- Комментарии к полям (выполняются только если таблица и колонки существуют)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'admin_pages_simple'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'admin_pages_simple' AND column_name = 'category'
    ) THEN
      EXECUTE 'COMMENT ON COLUMN admin_pages_simple.category IS ''Категория документа (например: docs, guides, api)''';
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'admin_pages_simple' AND column_name = 'parent_id'
    ) THEN
      EXECUTE 'COMMENT ON COLUMN admin_pages_simple.parent_id IS ''ID родительского документа для создания иерархии''';
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'admin_pages_simple' AND column_name = 'order_index'
    ) THEN
      EXECUTE 'COMMENT ON COLUMN admin_pages_simple.order_index IS ''Порядок сортировки в категории''';
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'admin_pages_simple' AND column_name = 'nav_path'
    ) THEN
      EXECUTE 'COMMENT ON COLUMN admin_pages_simple.nav_path IS ''Путь в навигации (например: docs/setup/installation)''';
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'admin_pages_simple' AND column_name = 'is_index_page'
    ) THEN
      EXECUTE 'COMMENT ON COLUMN admin_pages_simple.is_index_page IS ''Флаг индексной страницы категории''';
    END IF;
  END IF;
END $$;

