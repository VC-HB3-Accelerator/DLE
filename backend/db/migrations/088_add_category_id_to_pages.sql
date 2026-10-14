-- UP Migration
-- Миграция: Добавление связи документов с категориями через внешний ключ
-- Добавляет поле category_id для реляционной связи с document_categories

-- Добавляем поле category_id в таблицу admin_pages_simple
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

  -- Добавляем поле category_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_pages_simple' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE admin_pages_simple ADD COLUMN category_id INTEGER DEFAULT NULL;
    
    -- Заполняем category_id на основе существующего поля category
    -- Связываем документы с категориями по названию
    -- Проверяем существование таблицы document_categories перед UPDATE
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'document_categories'
    ) THEN
      UPDATE admin_pages_simple p
      SET category_id = (
        SELECT id FROM document_categories dc 
        WHERE LOWER(TRIM(dc.name)) = LOWER(TRIM(p.category))
        LIMIT 1
      )
      WHERE p.category IS NOT NULL AND p.category != '';
    END IF;
    
    -- Добавляем внешний ключ только если таблица document_categories существует
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'document_categories'
    ) THEN
      -- Проверяем, не существует ли уже внешний ключ
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'admin_pages_simple' 
        AND constraint_name = 'fk_page_category'
      ) THEN
        ALTER TABLE admin_pages_simple
          ADD CONSTRAINT fk_page_category
          FOREIGN KEY (category_id)
          REFERENCES document_categories(id)
          ON DELETE SET NULL;
      END IF;
    END IF;
    
    -- Создаем индекс для оптимизации
    CREATE INDEX IF NOT EXISTS idx_pages_category_id ON admin_pages_simple(category_id) WHERE category_id IS NOT NULL;
  END IF;
END $$;

-- Комментарии (только если таблица и колонки существуют)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'admin_pages_simple'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'admin_pages_simple' AND column_name = 'category_id'
    ) THEN
      EXECUTE 'COMMENT ON COLUMN admin_pages_simple.category_id IS ''ID категории из таблицы document_categories (реляционная связь)''';
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'admin_pages_simple' AND column_name = 'category'
    ) THEN
      EXECUTE 'COMMENT ON COLUMN admin_pages_simple.category IS ''Название категории (оставляем для обратной совместимости, но используем category_id)''';
    END IF;
  END IF;
END $$;

-- DOWN Migration
-- Откат миграции: удаление связи через category_id

ALTER TABLE admin_pages_simple DROP CONSTRAINT IF EXISTS fk_page_category;
DROP INDEX IF EXISTS idx_pages_category_id;
ALTER TABLE admin_pages_simple DROP COLUMN IF EXISTS category_id;

