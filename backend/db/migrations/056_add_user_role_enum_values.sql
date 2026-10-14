-- Добавление новых значений в enum user_role для системы уровней доступа
-- Copyright (c) 2024-2025 Тарабанов Александр Викторович

-- Проверяем и добавляем новые значения в enum user_role только если их еще нет
DO $$ 
BEGIN
    -- Добавляем 'readonly' только если его еще нет
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'readonly' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
        ALTER TYPE user_role ADD VALUE 'readonly';
    END IF;
    
    -- Добавляем 'editor' только если его еще нет
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'editor' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
        ALTER TYPE user_role ADD VALUE 'editor';
    END IF;
END $$;

-- Добавляем комментарии для документации
COMMENT ON TYPE user_role IS 'Роли пользователей: user - обычный пользователь, admin - администратор, readonly - только чтение, editor - редактор';
