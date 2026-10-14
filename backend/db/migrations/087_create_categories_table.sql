-- UP Migration
-- Миграция: Создание таблицы для хранения категорий документов
-- Хранит список всех категорий, включая пустые

-- Создаем таблицу для категорий
CREATE TABLE IF NOT EXISTS document_categories (
  id SERIAL PRIMARY KEY,
  
  -- Название категории (нормализованное к нижнему регистру)
  name VARCHAR(255) NOT NULL UNIQUE,
  
  -- Отображаемое название (с сохранением регистра)
  display_name VARCHAR(255) NOT NULL,
  
  -- Описание категории
  description TEXT,
  
  -- Порядок сортировки
  order_index INTEGER DEFAULT 0,
  
  -- Автор создания
  author_address VARCHAR(255) NOT NULL,
  
  -- Временные метки
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создаем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_categories_name ON document_categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_order ON document_categories(order_index, created_at);

-- Комментарии к таблице и полям
COMMENT ON TABLE document_categories IS 'Таблица для хранения списка категорий документов';
COMMENT ON COLUMN document_categories.name IS 'Нормализованное название категории (нижний регистр)';
COMMENT ON COLUMN document_categories.display_name IS 'Отображаемое название категории (с сохранением регистра)';
COMMENT ON COLUMN document_categories.order_index IS 'Порядок сортировки категорий';
COMMENT ON COLUMN document_categories.author_address IS 'Адрес кошелька пользователя, создавшего категорию';

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_document_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_update_document_categories_updated_at ON document_categories;
CREATE TRIGGER trigger_update_document_categories_updated_at
  BEFORE UPDATE ON document_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_document_categories_updated_at();

-- DOWN Migration
-- Откат миграции: удаление таблицы категорий

DROP TRIGGER IF EXISTS trigger_update_document_categories_updated_at ON document_categories;
DROP FUNCTION IF EXISTS update_document_categories_updated_at();
DROP TABLE IF EXISTS document_categories CASCADE;

