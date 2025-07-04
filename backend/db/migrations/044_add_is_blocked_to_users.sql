-- Добавление поля is_blocked и blocked_at для блокировки пользователя
ALTER TABLE users ADD COLUMN is_blocked boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN blocked_at timestamp; 