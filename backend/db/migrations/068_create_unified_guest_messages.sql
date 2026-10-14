-- Migration: 068_create_unified_guest_messages
-- Description: Создание таблицы unified_guest_messages для централизованного хранения гостевых сообщений
-- Date: 2025-10-09

CREATE TABLE IF NOT EXISTS unified_guest_messages (
  id SERIAL PRIMARY KEY,
  
  -- Универсальный идентификатор
  identifier_encrypted TEXT NOT NULL,
  -- Примеры: 
  --   "web:guest_abc123def456..."
  --   "telegram:123456789"
  --   "email:user@example.com"
  
  -- Канал
  channel VARCHAR(20) NOT NULL,
  
  -- Контент
  content_encrypted TEXT NOT NULL,
  
  -- Роль (кто автор: гость или AI)
  is_ai BOOLEAN DEFAULT false NOT NULL,
  
  -- Метаданные канала (JSON)
  metadata JSONB DEFAULT '{}',
  -- Примеры:
  --   Telegram: {"username": "@user", "first_name": "John", "chat_id": 123}
  --   Email: {"from": "user@example.com", "subject": "Question"}
  
  -- Временные метки
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Вложения
  attachment_filename_encrypted TEXT,
  attachment_mimetype_encrypted TEXT,
  attachment_size BIGINT,
  attachment_data BYTEA,
  
  -- Constraint для канала
  CONSTRAINT check_channel CHECK (channel IN ('web', 'telegram', 'email'))
);

-- Индексы для быстрого поиска
CREATE INDEX idx_unified_guest_identifier ON unified_guest_messages(identifier_encrypted);
CREATE INDEX idx_unified_guest_channel ON unified_guest_messages(channel);
CREATE INDEX idx_unified_guest_created_at ON unified_guest_messages(created_at DESC);
CREATE INDEX idx_unified_guest_is_ai ON unified_guest_messages(is_ai);

-- Комментарии
COMMENT ON TABLE unified_guest_messages IS 'Централизованное хранилище сообщений гостей для всех каналов (web, telegram, email)';
COMMENT ON COLUMN unified_guest_messages.identifier_encrypted IS 'Зашифрованный универсальный идентификатор в формате "channel:id"';
COMMENT ON COLUMN unified_guest_messages.is_ai IS 'TRUE если это ответ AI, FALSE если сообщение от гостя';
COMMENT ON COLUMN unified_guest_messages.metadata IS 'Дополнительные метаданные канала в формате JSON';

