-- Migration: 072_migrate_existing_guest_data
-- Description: Миграция существующих данных из guest_messages в unified_guest_messages
-- Date: 2025-10-09

-- Проверяем существует ли таблица guest_messages
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guest_messages') THEN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'НАЧАЛО МИГРАЦИИ ГОСТЕВЫХ СООБЩЕНИЙ';
    RAISE NOTICE '===========================================';
    
    -- Миграция данных
    INSERT INTO unified_guest_messages (
      identifier_encrypted,
      channel,
      content_encrypted,
      is_ai,
      created_at,
      attachment_filename_encrypted,
      attachment_mimetype_encrypted,
      attachment_size,
      attachment_data,
      metadata
    )
    SELECT 
      guest_id,                                    -- идентификатор будет как "web:guest_..."
      'web'::VARCHAR(20),                          -- все старые сообщения из web канала
      content,
      COALESCE(is_ai, false),                      -- на случай если NULL
      created_at,
      attachment_filename,
      attachment_mimetype,
      attachment_size,
      attachment_data,
      '{}'::JSONB                                   -- пустые метаданные для старых сообщений
    FROM guest_messages
    WHERE guest_id IS NOT NULL;                    -- только валидные записи
    
    -- Логирование результата
    DECLARE
      migrated_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO migrated_count 
      FROM unified_guest_messages 
      WHERE channel = 'web';
      
      RAISE NOTICE '✓ Мигрировано гостевых сообщений: %', migrated_count;
    END;
    
    -- Удаление старых таблиц
    DROP TABLE IF EXISTS guest_messages CASCADE;
    RAISE NOTICE '✓ Удалена старая таблица guest_messages';
    
    DROP TABLE IF EXISTS guest_user_mapping CASCADE;
    RAISE NOTICE '✓ Удалена старая таблица guest_user_mapping';
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'МИГРАЦИЯ ЗАВЕРШЕНА УСПЕШНО';
    RAISE NOTICE 'Старые таблицы удалены';
    RAISE NOTICE '===========================================';
  ELSE
    RAISE NOTICE 'Таблица guest_messages не найдена, пропускаем миграцию';
  END IF;
END $$;
