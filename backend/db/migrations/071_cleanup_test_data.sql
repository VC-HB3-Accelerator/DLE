-- Migration: 071_cleanup_test_data
-- Description: Полная очистка тестовых данных пользователей
-- Date: 2025-10-09
-- WARNING: Это удалит ВСЕ данные пользователей!

-- 1. Удалить все сообщения
TRUNCATE TABLE messages CASCADE;

-- 2. Удалить все беседы
TRUNCATE TABLE conversations CASCADE;

-- 3. Удалить участников бесед
TRUNCATE TABLE conversation_participants CASCADE;

-- 4. Удалить статусы прочтения (если таблицы существуют)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'global_read_status') THEN
        TRUNCATE TABLE global_read_status CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_read_messages') THEN
        TRUNCATE TABLE admin_read_messages CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_read_contacts') THEN
        TRUNCATE TABLE admin_read_contacts CASCADE;
    END IF;
END $$;

-- 5. Удалить дедупликацию сообщений
TRUNCATE TABLE message_deduplication CASCADE;

-- 6. Удалить идентификаторы
TRUNCATE TABLE user_identities CASCADE;

-- 7. Удалить предпочтения пользователей (если есть)
TRUNCATE TABLE user_preferences CASCADE;

-- 8. Удалить связи пользователей с тегами (если есть)
TRUNCATE TABLE user_tag_links CASCADE;

-- 9. Удалить пользователей (с перезапуском счетчика ID)
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

-- Логирование завершения
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'ОЧИСТКА ЗАВЕРШЕНА УСПЕШНО';
  RAISE NOTICE 'База данных готова к новой системе гостей';
  RAISE NOTICE '===========================================';
END $$;
