-- UP Migration
-- Создание функций encrypt_text и decrypt_text для шифрования данных
-- Эти функции необходимы для работы с зашифрованными полями в БД

-- Устанавливаем расширение pgcrypto, если оно еще не установлено
-- ВАЖНО: CREATE EXTENSION должен выполняться вне транзакции
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Создаем функцию encrypt_text для шифрования текста
CREATE OR REPLACE FUNCTION public.encrypt_text(data text, key text)
RETURNS text
LANGUAGE plpgsql
AS $function$
BEGIN
    IF data IS NULL THEN
        RETURN NULL;
    END IF;
    -- Используем convert_to() для корректного преобразования UTF-8 текста в bytea
    RETURN encode(
        encrypt_iv(
            convert_to(data, 'UTF8'),  -- Правильное преобразование text -> bytea
            decode(key, 'base64'), 
            decode('000102030405060708090A0B0C0D0E0F', 'hex'), 
            'aes-cbc'::text
        ), 
        'base64'
    );
END;
$function$;

-- Создаем функцию decrypt_text для расшифровки текста
CREATE OR REPLACE FUNCTION public.decrypt_text(encrypted_data text, key text)
RETURNS text
LANGUAGE plpgsql
AS $function$
BEGIN
    IF encrypted_data IS NULL THEN
        RETURN NULL;
    END IF;
    -- Используем convert_from() для обратного преобразования bytea -> text
    RETURN convert_from(
        decrypt_iv(
            decode(encrypted_data, 'base64'), 
            decode(key, 'base64'), 
            decode('000102030405060708090A0B0C0D0E0F', 'hex'), 
            'aes-cbc'::text
        ),
        'UTF8'  -- Правильное преобразование bytea -> text
    );
END;
$function$;

-- DOWN Migration
-- DROP FUNCTION IF EXISTS public.encrypt_text(text, text);
-- DROP FUNCTION IF EXISTS public.decrypt_text(text, text);

