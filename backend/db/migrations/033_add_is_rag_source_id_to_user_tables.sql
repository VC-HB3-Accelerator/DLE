-- Добавляем колонку is_rag_source_id если она не существует
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_tables' AND column_name = 'is_rag_source_id'
  ) THEN
    ALTER TABLE user_tables
    ADD COLUMN is_rag_source_id INTEGER REFERENCES is_rag_source(id) DEFAULT 2; -- 2 = 'Нет'
  END IF;
END $$;