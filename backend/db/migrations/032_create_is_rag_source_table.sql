-- Создание справочной таблицы is_rag_source
CREATE TABLE IF NOT EXISTS is_rag_source (
    id SERIAL PRIMARY KEY,
    name_encrypted TEXT
);

-- Пропускаем INSERT, так как данные должны быть зашифрованы
-- INSERT INTO is_rag_source (name) VALUES
--     ('Да'),
--     ('Нет')
-- ON CONFLICT (name) DO NOTHING; 