-- Миграция: добавление ON DELETE CASCADE для user_preferences
-- Автор: Тарабанов Александр Викторович
-- Дата: 2025-10-08
-- Описание: Изменяет FK на users с добавлением каскадного удаления

BEGIN;

-- Удаляем старый FK без CASCADE
ALTER TABLE user_preferences
DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;

-- Добавляем новый FK с CASCADE
ALTER TABLE user_preferences
ADD CONSTRAINT user_preferences_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Комментарий для документации
COMMENT ON CONSTRAINT user_preferences_user_id_fkey ON user_preferences IS 'FK на users с каскадным удалением настроек при удалении пользователя';

COMMIT;

