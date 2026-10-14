-- Миграция: создание таблицы для дедупликации сообщений
-- Автор: Тарабанов Александр Викторович
-- Дата: 2024-01-15
-- Описание: Создает таблицу message_deduplication для предотвращения дублирования сообщений
--          во всех каналах (email, telegram, web) с использованием хеширования message_id

BEGIN;

-- Создаем таблицу для дедупликации сообщений
CREATE TABLE IF NOT EXISTS message_deduplication (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(20) NOT NULL,                    -- Канал: 'email', 'telegram', 'web'
  message_id_hash VARCHAR(64) NOT NULL,            -- SHA-256 хеш от (channel:messageId:userId:senderType)
  user_id INTEGER NOT NULL,                        -- ID пользователя
  sender_type VARCHAR(20) NOT NULL,                -- Тип отправителя: 'user', 'assistant'
  original_message_id_encrypted TEXT,              -- Зашифрованный оригинальный message_id (для отладки)
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Время обработки
  
  -- Ограничения
  CONSTRAINT fk_message_dedup_user_id 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Уникальное ограничение для предотвращения дублирования
  CONSTRAINT unique_message_deduplication 
    UNIQUE(channel, message_id_hash, user_id, sender_type)
);

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_message_dedup_lookup 
ON message_deduplication(channel, message_id_hash, user_id, sender_type);

CREATE INDEX IF NOT EXISTS idx_message_dedup_user_channel 
ON message_deduplication(user_id, channel);


-- Создаем функцию для создания хеша message_id
CREATE OR REPLACE FUNCTION create_message_hash(
  p_channel VARCHAR(20),
  p_message_id TEXT,
  p_user_id INTEGER,
  p_sender_type VARCHAR(20)
) RETURNS VARCHAR(64) AS $$
BEGIN
  -- Создаем хеш от комбинации параметров
  RETURN encode(
    digest(p_channel || ':' || p_message_id || ':' || p_user_id || ':' || p_sender_type, 'sha256'), 
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Создаем функцию для проверки дедупликации
CREATE OR REPLACE FUNCTION check_message_deduplication(
  p_channel VARCHAR(20),
  p_message_id TEXT,
  p_user_id INTEGER,
  p_sender_type VARCHAR(20)
) RETURNS BOOLEAN AS $$
DECLARE
  v_hash VARCHAR(64);
  v_exists BOOLEAN;
BEGIN
  -- Создаем хеш
  v_hash := create_message_hash(p_channel, p_message_id, p_user_id, p_sender_type);
  
  -- Проверяем существование записи
  SELECT EXISTS(
    SELECT 1 FROM message_deduplication 
    WHERE channel = p_channel 
      AND message_id_hash = v_hash 
      AND user_id = p_user_id 
      AND sender_type = p_sender_type
  ) INTO v_exists;
  
  -- Если записи нет, создаем новую
  IF NOT v_exists THEN
    INSERT INTO message_deduplication (
      channel, 
      message_id_hash, 
      user_id, 
      sender_type
    ) VALUES (
      p_channel, 
      v_hash, 
      p_user_id, 
      p_sender_type
    ) ON CONFLICT (channel, message_id_hash, user_id, sender_type) 
    DO UPDATE SET 
      processed_at = NOW();
  END IF;
  
  RETURN v_exists;
END;
$$ LANGUAGE plpgsql;


-- Удаляем старую колонку message_id_encrypted из таблицы messages
-- так как теперь используем отдельную таблицу message_deduplication
ALTER TABLE messages DROP COLUMN IF EXISTS message_id_encrypted;

-- Добавляем комментарии к таблице и колонкам
COMMENT ON TABLE message_deduplication IS 'Таблица для предотвращения дублирования сообщений во всех каналах';
COMMENT ON COLUMN message_deduplication.channel IS 'Канал сообщения: email, telegram, web';
COMMENT ON COLUMN message_deduplication.message_id_hash IS 'SHA-256 хеш от (channel:messageId:userId:senderType)';
COMMENT ON COLUMN message_deduplication.user_id IS 'ID пользователя';
COMMENT ON COLUMN message_deduplication.sender_type IS 'Тип отправителя: user, assistant';
COMMENT ON COLUMN message_deduplication.original_message_id_encrypted IS 'Зашифрованный оригинальный message_id для отладки';
COMMENT ON COLUMN message_deduplication.processed_at IS 'Время первой обработки сообщения';

COMMIT;

-- DOWN Migration (для отката)
-- BEGIN;
-- DROP FUNCTION IF EXISTS check_message_deduplication(VARCHAR(20), TEXT, INTEGER, VARCHAR(20));
-- DROP FUNCTION IF EXISTS create_message_hash(VARCHAR(20), TEXT, INTEGER, VARCHAR(20));
-- DROP TABLE IF EXISTS message_deduplication CASCADE;
-- -- Восстанавливаем старую колонку message_id_encrypted
-- ALTER TABLE messages ADD COLUMN message_id_encrypted TEXT NULL;
-- COMMENT ON COLUMN messages.message_id_encrypted IS 'Зашифрованный Message-ID email письма для дедупликации';
-- COMMIT;
