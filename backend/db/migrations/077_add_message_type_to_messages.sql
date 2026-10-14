-- Добавляем поле message_type для разделения публичных и приватных сообщений
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'public';

-- Создаем индекс для быстрого поиска по типу сообщения
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);

-- Обновляем существующие сообщения как публичные (если они есть)
UPDATE messages SET message_type = 'public' WHERE message_type IS NULL;

-- Комментарий к полю
COMMENT ON COLUMN messages.message_type IS 'Тип сообщения: public, private, user_chat, admin_chat';
