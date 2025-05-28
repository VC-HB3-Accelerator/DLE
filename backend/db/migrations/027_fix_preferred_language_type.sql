-- Исправление preferred_language: если строка — преобразовать в массив, если null — в []
UPDATE users SET preferred_language = jsonb_build_array(preferred_language) WHERE jsonb_typeof(preferred_language) = 'string';
UPDATE users SET preferred_language = '[]' WHERE preferred_language IS NULL; 