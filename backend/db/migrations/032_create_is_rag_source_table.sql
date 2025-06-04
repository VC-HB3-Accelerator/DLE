-- Создание справочной таблицы is_rag_source
CREATE TABLE IF NOT EXISTS is_rag_source (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE
);

-- Заполнение начальными значениями
INSERT INTO is_rag_source (name) VALUES
    ('Да'),
    ('Нет')
ON CONFLICT (name) DO NOTHING; 