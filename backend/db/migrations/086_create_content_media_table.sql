-- UP Migration
-- Миграция: Создание таблицы для хранения медиа-файлов контента
-- Хранит метаданные о загруженных изображениях и видео для документов

-- Создаем таблицу для медиа-файлов
-- Сначала создаем без внешнего ключа, потом добавим его условно
CREATE TABLE IF NOT EXISTS content_media (
  id SERIAL PRIMARY KEY,
  
  -- Связь с документом (может быть NULL для неиспользуемых медиа)
  -- Внешний ключ будет добавлен ниже, если таблица admin_pages_simple существует
  page_id INTEGER,
  
  -- Информация о файле
  file_data BYTEA NOT NULL,        -- Бинарные данные файла (хранится в БД)
  file_name VARCHAR(255) NOT NULL, -- Оригинальное имя файла
  mime_type VARCHAR(100) NOT NULL, -- MIME тип файла
  file_size BIGINT NOT NULL,       -- Размер файла в байтах
  file_hash VARCHAR(64),           -- SHA-256 хеш файла для дедупликации
  
  -- Тип медиа
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video')),
  
  -- Метаданные
  alt_text TEXT,                   -- Альтернативный текст для изображений
  title VARCHAR(255),              -- Заголовок медиа
  description TEXT,                -- Описание медиа
  
  -- Автор загрузки
  author_address VARCHAR(255) NOT NULL, -- Адрес кошелька автора
  
  -- Временные метки
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Добавляем внешний ключ только если таблица admin_pages_simple существует
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'admin_pages_simple'
  ) THEN
    -- Проверяем, не существует ли уже внешний ключ
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'content_media' 
      AND constraint_name = 'content_media_page_id_fkey'
    ) THEN
      ALTER TABLE content_media 
        ADD CONSTRAINT content_media_page_id_fkey
        FOREIGN KEY (page_id) 
        REFERENCES admin_pages_simple(id) 
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Создаем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_content_media_page_id ON content_media(page_id) WHERE page_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_media_type ON content_media(media_type);
CREATE INDEX IF NOT EXISTS idx_content_media_author ON content_media(author_address);
CREATE INDEX IF NOT EXISTS idx_content_media_created ON content_media(created_at DESC);

-- Частичный уникальный индекс для дедупликации файлов по хешу
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_media_file_hash_unique 
  ON content_media(file_hash) 
  WHERE file_hash IS NOT NULL;

-- Комментарии к таблице и полям
COMMENT ON TABLE content_media IS 'Таблица для хранения метаданных медиа-файлов (изображений и видео) контента';
COMMENT ON COLUMN content_media.page_id IS 'ID документа, к которому относится медиа (NULL для неиспользуемых)';
COMMENT ON COLUMN content_media.file_data IS 'Бинарные данные файла (хранится в БД как BYTEA)';
COMMENT ON COLUMN content_media.file_name IS 'Оригинальное имя файла при загрузке';
COMMENT ON COLUMN content_media.file_hash IS 'SHA-256 хеш файла для дедупликации и проверки целостности';
COMMENT ON COLUMN content_media.media_type IS 'Тип медиа: image или video';
COMMENT ON COLUMN content_media.alt_text IS 'Альтернативный текст для изображений (для доступности)';
COMMENT ON COLUMN content_media.author_address IS 'Адрес кошелька пользователя, загрузившего файл';

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_content_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_update_content_media_updated_at ON content_media;
CREATE TRIGGER trigger_update_content_media_updated_at
  BEFORE UPDATE ON content_media
  FOR EACH ROW
  EXECUTE FUNCTION update_content_media_updated_at();

-- DOWN Migration
-- Откат миграции: удаление таблицы медиа-файлов

DROP TRIGGER IF EXISTS trigger_update_content_media_updated_at ON content_media;
DROP FUNCTION IF EXISTS update_content_media_updated_at();
DROP TABLE IF EXISTS content_media CASCADE;

