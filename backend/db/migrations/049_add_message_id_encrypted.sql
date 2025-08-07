-- Миграция: добавление зашифрованной колонки message_id_encrypted в таблицу messages
-- Для хранения Message-ID email писем для дедупликации

ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_id_encrypted TEXT NULL;

-- Создаем индекс для быстрого поиска по message_id (если нужно будет в будущем)
-- CREATE INDEX IF NOT EXISTS idx_messages_message_id_encrypted ON messages(message_id_encrypted);

COMMENT ON COLUMN messages.message_id_encrypted IS 'Зашифрованный Message-ID email письма для дедупликации';
