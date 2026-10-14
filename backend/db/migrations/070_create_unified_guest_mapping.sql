-- Migration: 070_create_unified_guest_mapping
-- Description: Создание таблицы unified_guest_mapping для маппинга гость → пользователь
-- Date: 2025-10-09

CREATE TABLE IF NOT EXISTS unified_guest_mapping (
  id SERIAL PRIMARY KEY,
  
  -- Пользователь
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Гостевой идентификатор
  identifier_encrypted TEXT NOT NULL,  -- "telegram:123456789", "web:guest_abc...", "email:user@..."
  
  -- Канал
  channel VARCHAR(20) NOT NULL,
  
  -- Статус обработки
  processed BOOLEAN DEFAULT false NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Временные метки
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Уникальность: один гостевой идентификатор может быть привязан только к одному пользователю
  UNIQUE(identifier_encrypted, channel),
  
  -- Constraint для канала
  CONSTRAINT check_channel CHECK (channel IN ('web', 'telegram', 'email'))
);

-- Индексы для быстрого поиска
CREATE INDEX idx_unified_mapping_user_id ON unified_guest_mapping(user_id);
CREATE INDEX idx_unified_mapping_identifier ON unified_guest_mapping(identifier_encrypted);
CREATE INDEX idx_unified_mapping_processed ON unified_guest_mapping(processed);
CREATE INDEX idx_unified_mapping_channel ON unified_guest_mapping(channel);

-- Комментарии
COMMENT ON TABLE unified_guest_mapping IS 'Маппинг между гостевыми идентификаторами и зарегистрированными пользователями';
COMMENT ON COLUMN unified_guest_mapping.identifier_encrypted IS 'Зашифрованный гостевой идентификатор в формате "channel:id"';
COMMENT ON COLUMN unified_guest_mapping.processed IS 'Флаг: были ли мигрированы сообщения этого гостя';
COMMENT ON COLUMN unified_guest_mapping.processed_at IS 'Время миграции сообщений';

