-- Миграция 076: Исправление функций encrypt_text и decrypt_text
-- Проблема: data::bytea не работает для произвольных текстов
-- Решение: использовать convert_to(data, 'UTF8') для корректного преобразования

BEGIN;

-- Удаляем старые функции
DROP FUNCTION IF EXISTS public.encrypt_text(text, text);
DROP FUNCTION IF EXISTS public.decrypt_text(text, text);

-- Пересоздаем функцию encrypt_text с правильным преобразованием
CREATE OR REPLACE FUNCTION public.encrypt_text(data text, key text)
RETURNS text
LANGUAGE plpgsql
AS $function$
BEGIN
    IF data IS NULL THEN
        RETURN NULL;
    END IF;
    -- Используем convert_to() вместо ::bytea для корректного преобразования UTF-8 текста в bytea
    RETURN encode(
        encrypt_iv(
            convert_to(data, 'UTF8'),  -- Правильное преобразование text -> bytea
            decode(key, 'base64'), 
            decode('000102030405060708090A0B0C0D0E0F', 'hex'), 
            'aes-cbc'
        ), 
        'base64'
    );
END;
$function$;

-- Пересоздаем функцию decrypt_text с правильным преобразованием
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
            'aes-cbc'
        ),
        'UTF8'  -- Правильное преобразование bytea -> text
    );
END;
$function$;

COMMIT;

