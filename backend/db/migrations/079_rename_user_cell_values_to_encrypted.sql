-- Миграция 079: Переименование колонки value в value_encrypted для user_cell_values
-- Для соответствия архитектуре шифрования
-- Проверяем, существует ли колонка value перед переименованием

DO $$
BEGIN
    -- Проверяем, существует ли колонка value
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_cell_values' 
        AND column_name = 'value'
        AND table_schema = 'public'
    ) THEN
        -- Переименовываем колонку value в value_encrypted
        ALTER TABLE user_cell_values RENAME COLUMN value TO value_encrypted;
        RAISE NOTICE 'Колонка value переименована в value_encrypted';
    ELSE
        -- Проверяем, существует ли уже колонка value_encrypted
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'user_cell_values' 
            AND column_name = 'value_encrypted'
            AND table_schema = 'public'
        ) THEN
            RAISE NOTICE 'Колонка value_encrypted уже существует, переименование не требуется';
        ELSE
            RAISE WARNING 'Колонка value не найдена, и value_encrypted также не существует';
        END IF;
    END IF;
END $$;

