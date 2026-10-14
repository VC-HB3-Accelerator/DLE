-- UP Migration
-- Заполняем все поля db_settings дефолтными значениями

-- Обновляем существующую запись дефолтными значениями
UPDATE db_settings 
SET 
    db_host_encrypted = encrypt_text('postgres', get_encryption_key()),
    db_name_encrypted = encrypt_text('dapp_db', get_encryption_key()),
    db_user_encrypted = encrypt_text('dapp_user', get_encryption_key()),
    db_password_encrypted = encrypt_text('dapp_password', get_encryption_key()),
    updated_at = NOW()
WHERE id = 1;

-- DOWN Migration
-- Очищаем все зашифрованные поля
-- UPDATE db_settings 
-- SET 
--     db_host_encrypted = NULL,
--     db_name_encrypted = NULL,
--     db_user_encrypted = NULL,
--     db_password_encrypted = NULL,
--     updated_at = NOW()
-- WHERE id = 1;
