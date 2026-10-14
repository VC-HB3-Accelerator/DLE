-- UP Migration
-- Миграция: добавление полей show_in_blog и slug в таблицу admin_pages_simple
-- Поля предназначены для управления отображением страниц в блоге и SEO-оптимизации URL

DO $$
BEGIN
  -- Проверяем существование таблицы
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'admin_pages_simple'
  ) THEN
    RAISE NOTICE 'Таблица admin_pages_simple не существует, пропускаем миграцию 093_add_blog_fields_to_admin_pages_simple.sql';
    RETURN;
  END IF;

  -- Добавляем колонку show_in_blog, если её ещё нет
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'admin_pages_simple'
      AND column_name = 'show_in_blog'
  ) THEN
    ALTER TABLE admin_pages_simple
      ADD COLUMN show_in_blog BOOLEAN DEFAULT FALSE;
  END IF;

  -- Добавляем колонку slug, если её ещё нет
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'admin_pages_simple'
      AND column_name = 'slug'
  ) THEN
    ALTER TABLE admin_pages_simple
      ADD COLUMN slug TEXT;
  END IF;
END $$;

-- Создаем уникальный индекс для slug (только если таблица существует)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'admin_pages_simple'
  ) THEN
    -- Проверяем, существует ли уже индекс
    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE tablename = 'admin_pages_simple'
        AND indexname = 'admin_pages_simple_slug_unique'
    ) THEN
      CREATE UNIQUE INDEX admin_pages_simple_slug_unique
        ON admin_pages_simple(slug)
        WHERE slug IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Комментарии к полям (только если таблица и колонки существуют)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'admin_pages_simple'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'admin_pages_simple'
        AND column_name = 'show_in_blog'
    ) THEN
      EXECUTE 'COMMENT ON COLUMN admin_pages_simple.show_in_blog IS ''Флаг отображения страницы в блоге (TRUE - показывать, FALSE - не показывать)''';
    END IF;
    
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'admin_pages_simple'
        AND column_name = 'slug'
    ) THEN
      EXECUTE 'COMMENT ON COLUMN admin_pages_simple.slug IS ''URL-friendly идентификатор страницы для SEO (например: "kak-sozdat-stranicu")''';
    END IF;
  END IF;
END $$;

-- DOWN Migration
-- Откат: удаляем индекс и колонки

DROP INDEX IF EXISTS admin_pages_simple_slug_unique;
ALTER TABLE admin_pages_simple DROP COLUMN IF EXISTS slug;
ALTER TABLE admin_pages_simple DROP COLUMN IF EXISTS show_in_blog;














