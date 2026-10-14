-- Добавляем поддержку приватных бесед между пользователями
-- Создаем таблицу участников бесед

CREATE TABLE IF NOT EXISTS conversation_participants (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(conversation_id, user_id)
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);

-- Добавляем поле conversation_type в conversations для различения типов бесед
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS conversation_type VARCHAR(50) DEFAULT 'user_chat';

-- Обновляем существующие беседы
UPDATE conversations SET conversation_type = 'user_chat' WHERE conversation_type IS NULL;

-- Добавляем индексы
CREATE INDEX IF NOT EXISTS idx_conversations_conversation_type ON conversations(conversation_type);
