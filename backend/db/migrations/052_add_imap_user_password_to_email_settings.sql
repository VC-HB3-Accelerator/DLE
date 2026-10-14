-- Добавляем недостающие колонки для IMAP пользователя и пароля
-- Миграция: 052_add_imap_user_password_to_email_settings.sql

-- Добавляем колонку imap_user_encrypted если её нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'email_settings' 
        AND column_name = 'imap_user_encrypted'
    ) THEN
        ALTER TABLE email_settings ADD COLUMN imap_user_encrypted TEXT;
        RAISE NOTICE 'Добавлена колонка imap_user_encrypted';
    ELSE
        RAISE NOTICE 'Колонка imap_user_encrypted уже существует';
    END IF;
END $$;

-- Добавляем колонку imap_password_encrypted если её нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'email_settings' 
        AND column_name = 'imap_password_encrypted'
    ) THEN
        ALTER TABLE email_settings ADD COLUMN imap_password_encrypted TEXT;
        RAISE NOTICE 'Добавлена колонка imap_password_encrypted';
    ELSE
        RAISE NOTICE 'Колонка imap_password_encrypted уже существует';
    END IF;
END $$;

-- Обновляем существующие записи, устанавливая пустые значения для новых колонок
UPDATE email_settings 
SET imap_user_encrypted = NULL, 
    imap_password_encrypted = NULL 
WHERE imap_user_encrypted IS NULL 
   OR imap_password_encrypted IS NULL;
