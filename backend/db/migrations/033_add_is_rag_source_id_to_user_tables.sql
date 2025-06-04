ALTER TABLE user_tables
ADD COLUMN is_rag_source_id INTEGER REFERENCES is_rag_source(id) DEFAULT 2; -- 2 = 'Нет'