-- Создаем расширение для векторов
CREATE EXTENSION IF NOT EXISTS vector;

-- Создаем таблицу пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Создаем таблицу документов
DROP TABLE IF EXISTS documents;
CREATE TABLE documents (
    id bigserial PRIMARY KEY,
    content text,
    metadata jsonb,
    embedding vector(4096)
);

-- Создаем таблицу истории чата
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    context_docs INTEGER[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Даем права пользователю
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Обновляем существующие адреса
UPDATE users SET address = LOWER(address);

-- Удаляем дубликаты
DELETE FROM users a USING users b
WHERE a.id > b.id 
AND LOWER(a.address) = LOWER(b.address); 