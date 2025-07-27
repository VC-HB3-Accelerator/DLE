-- Миграция для добавления колонок хранения файлов и удаления старой колонки attachments

-- UP Migration
BEGIN;

-- Добавляем колонки для хранения файла и его метаданных в таблицу messages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'attachment_filename') THEN
    ALTER TABLE messages ADD COLUMN attachment_filename TEXT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'attachment_mimetype') THEN
    ALTER TABLE messages ADD COLUMN attachment_mimetype TEXT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'attachment_size') THEN
    ALTER TABLE messages ADD COLUMN attachment_size BIGINT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'attachment_data') THEN
    ALTER TABLE messages ADD COLUMN attachment_data BYTEA NULL;
  END IF;
END $$;

-- Добавляем колонки для хранения файла и его метаданных в таблицу guest_messages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guest_messages' AND column_name = 'attachment_filename') THEN
    ALTER TABLE guest_messages ADD COLUMN attachment_filename TEXT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guest_messages' AND column_name = 'attachment_mimetype') THEN
    ALTER TABLE guest_messages ADD COLUMN attachment_mimetype TEXT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guest_messages' AND column_name = 'attachment_size') THEN
    ALTER TABLE guest_messages ADD COLUMN attachment_size BIGINT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guest_messages' AND column_name = 'attachment_data') THEN
    ALTER TABLE guest_messages ADD COLUMN attachment_data BYTEA NULL;
  END IF;
END $$;

-- Удаляем старую колонку attachments из таблицы messages, если она существует
ALTER TABLE messages DROP COLUMN IF EXISTS attachments;

-- Удаляем старую колонку attachments из таблицы guest_messages, если она существует
ALTER TABLE guest_messages DROP COLUMN IF EXISTS attachments;

COMMIT;

-- DOWN Migration
-- Откат изменений: удаляем новые колонки и пытаемся вернуть старую колонку (тип TEXT или JSONB? Используем TEXT как предположение)
BEGIN;

ALTER TABLE messages
DROP COLUMN IF EXISTS attachment_filename,
DROP COLUMN IF EXISTS attachment_mimetype,
DROP COLUMN IF EXISTS attachment_size,
DROP COLUMN IF EXISTS attachment_data;
-- Пытаемся вернуть старую колонку (данные будут потеряны при откате)
-- Возможно, потребуется указать правильный тип (TEXT или JSONB), который был раньше
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments TEXT NULL;

ALTER TABLE guest_messages
DROP COLUMN IF EXISTS attachment_filename,
DROP COLUMN IF EXISTS attachment_mimetype,
DROP COLUMN IF EXISTS attachment_size,
DROP COLUMN IF EXISTS attachment_data;
-- Пытаемся вернуть старую колонку (данные будут потеряны при откате)
-- Возможно, потребуется указать правильный тип (TEXT или JSONB), который был раньше
ALTER TABLE guest_messages ADD COLUMN IF NOT EXISTS attachments TEXT NULL;

COMMIT; 