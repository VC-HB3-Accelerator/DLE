-- UP Migration
-- Миграция: добавление поля settings в таблицу admin_pages_simple
-- Поле предназначено для хранения JSON-настроек страницы (например, autoPublish и др.)

DO $$
BEGIN
  -- Проверяем существование таблицы
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'admin_pages_simple'
  ) THEN
    RAISE NOTICE 'Таблица admin_pages_simple не существует, пропускаем миграцию 089_add_settings_to_admin_pages_simple.sql';
    RETURN;
  END IF;

  -- Добавляем колонку settings, если её ещё нет
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'admin_pages_simple'
      AND column_name = 'settings'
  ) THEN
    ALTER TABLE admin_pages_simple
      ADD COLUMN settings JSONB DEFAULT NULL;
  END IF;
END $$;

-- DOWN Migration
-- Откат: удаляем колонку settings

ALTER TABLE admin_pages_simple
  DROP COLUMN IF EXISTS settings;













