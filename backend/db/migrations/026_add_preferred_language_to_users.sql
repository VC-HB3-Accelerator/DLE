-- Добавление поля preferred_language для хранения языков пользователя (множественный выбор)
ALTER TABLE users ADD COLUMN preferred_language jsonb; 