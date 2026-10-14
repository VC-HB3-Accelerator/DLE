-- Миграция 074: Добавление user_id для связи гостевых сообщений с пользователями
-- После подключения кошелька, гостевые сообщения связываются с user_id

DO $$ 
BEGIN
    -- Добавляем колонку user_id для связи с таблицей users
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_guest_messages' 
                   AND column_name = 'user_id') THEN
        ALTER TABLE unified_guest_messages 
        ADD COLUMN user_id INTEGER;
        
        RAISE NOTICE 'Добавлена колонка user_id в unified_guest_messages';
    END IF;

    -- Добавляем индекс для быстрого поиска по user_id
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'unified_guest_messages' 
                   AND indexname = 'idx_unified_guest_messages_user_id') THEN
        CREATE INDEX idx_unified_guest_messages_user_id 
        ON unified_guest_messages(user_id);
        
        RAISE NOTICE 'Создан индекс idx_unified_guest_messages_user_id';
    END IF;

    -- Добавляем внешний ключ для целостности данных
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_unified_guest_messages_user') THEN
        ALTER TABLE unified_guest_messages 
        ADD CONSTRAINT fk_unified_guest_messages_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Добавлен внешний ключ fk_unified_guest_messages_user';
    END IF;

    -- Добавляем комментарии
    COMMENT ON COLUMN unified_guest_messages.user_id IS 'ID зарегистрированного пользователя (NULL для гостей)';
    
    RAISE NOTICE 'Миграция 074 завершена: добавлено поле user_id для связи гостей с пользователями';
END $$;

