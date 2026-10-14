-- Миграция 073: Добавление поддержки медиа-контента в unified_guest_messages
-- Добавляем колонки для хранения информации о медиа-файлах и их типах

DO $$ 
BEGIN
    -- Добавляем колонку для типа контента
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_guest_messages' 
                   AND column_name = 'content_type') THEN
        ALTER TABLE unified_guest_messages 
        ADD COLUMN content_type VARCHAR(20) DEFAULT 'text' NOT NULL;
        
        RAISE NOTICE 'Добавлена колонка content_type в unified_guest_messages';
    END IF;

    -- Добавляем колонку для вложений (JSON)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_guest_messages' 
                   AND column_name = 'attachments') THEN
        ALTER TABLE unified_guest_messages 
        ADD COLUMN attachments JSONB;
        
        RAISE NOTICE 'Добавлена колонка attachments в unified_guest_messages';
    END IF;

    -- Добавляем колонку для метаданных медиа
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unified_guest_messages' 
                   AND column_name = 'media_metadata') THEN
        ALTER TABLE unified_guest_messages 
        ADD COLUMN media_metadata JSONB;
        
        RAISE NOTICE 'Добавлена колонка media_metadata в unified_guest_messages';
    END IF;

    -- Добавляем индексы для оптимизации поиска по типу контента
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'unified_guest_messages' 
                   AND indexname = 'idx_unified_guest_messages_content_type') THEN
        CREATE INDEX idx_unified_guest_messages_content_type 
        ON unified_guest_messages(content_type);
        
        RAISE NOTICE 'Создан индекс idx_unified_guest_messages_content_type';
    END IF;

    -- Добавляем индекс для поиска по наличию вложений
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'unified_guest_messages' 
                   AND indexname = 'idx_unified_guest_messages_has_attachments') THEN
        CREATE INDEX idx_unified_guest_messages_has_attachments 
        ON unified_guest_messages((attachments IS NOT NULL));
        
        RAISE NOTICE 'Создан индекс idx_unified_guest_messages_has_attachments';
    END IF;

    -- Обновляем существующие записи, устанавливая content_type = 'text'
    UPDATE unified_guest_messages 
    SET content_type = 'text' 
    WHERE content_type IS NULL OR content_type = '';
    
    RAISE NOTICE 'Обновлены существующие записи с content_type = text';

    -- Добавляем ограничения для content_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'chk_unified_guest_messages_content_type') THEN
        ALTER TABLE unified_guest_messages 
        ADD CONSTRAINT chk_unified_guest_messages_content_type 
        CHECK (content_type IN ('text', 'audio', 'video', 'image', 'document', 'combined'));
        
        RAISE NOTICE 'Добавлено ограничение chk_unified_guest_messages_content_type';
    END IF;

END $$;

-- Создаем таблицу для хранения метаданных медиа-файлов
CREATE TABLE IF NOT EXISTS media_files (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    mime_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    download_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Связь с сообщением
    message_id INTEGER,
    identifier VARCHAR(255),
    channel VARCHAR(50),
    
    -- Метаданные
    metadata JSONB,
    
    -- Индексы
    CONSTRAINT fk_media_files_message 
        FOREIGN KEY (message_id) REFERENCES unified_guest_messages(id) ON DELETE CASCADE
);

-- Создаем индексы для таблицы media_files
CREATE INDEX IF NOT EXISTS idx_media_files_file_type ON media_files(file_type);
CREATE INDEX IF NOT EXISTS idx_media_files_identifier ON media_files(identifier);
CREATE INDEX IF NOT EXISTS idx_media_files_channel ON media_files(channel);
CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON media_files(created_at);
CREATE INDEX IF NOT EXISTS idx_media_files_is_active ON media_files(is_active);

-- Добавляем комментарии
COMMENT ON TABLE media_files IS 'Таблица для хранения метаданных медиа-файлов';
COMMENT ON COLUMN media_files.file_name IS 'Уникальное имя файла на диске';
COMMENT ON COLUMN media_files.original_name IS 'Оригинальное имя файла от пользователя';
COMMENT ON COLUMN media_files.file_path IS 'Полный путь к файлу на сервере';
COMMENT ON COLUMN media_files.file_size IS 'Размер файла в байтах';
COMMENT ON COLUMN media_files.file_type IS 'Тип файла: audio, video, image, document';
COMMENT ON COLUMN media_files.metadata IS 'Дополнительные метаданные файла (разрешение, длительность и т.д.)';

-- Финальное сообщение
DO $$ 
BEGIN
    RAISE NOTICE 'Миграция 073 завершена: добавлена поддержка медиа-контента';
END $$;
