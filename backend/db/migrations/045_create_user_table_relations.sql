-- Миграция: универсальная таблица связей для relation/reference/lookup/multiselect

CREATE TABLE IF NOT EXISTS user_table_relations (
  id SERIAL PRIMARY KEY,
  from_row_id INTEGER NOT NULL REFERENCES user_rows(id) ON DELETE CASCADE, -- строка-источник
  column_id INTEGER NOT NULL REFERENCES user_columns(id) ON DELETE CASCADE, -- столбец, в котором хранится связь
  to_table_id INTEGER NOT NULL REFERENCES user_tables(id) ON DELETE CASCADE, -- таблица-назначение
  to_row_id INTEGER NOT NULL REFERENCES user_rows(id) ON DELETE CASCADE, -- строка-назначение
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для ускорения поиска и фильтрации
CREATE INDEX IF NOT EXISTS idx_user_table_relations_from_row ON user_table_relations(from_row_id);
CREATE INDEX IF NOT EXISTS idx_user_table_relations_column ON user_table_relations(column_id);
CREATE INDEX IF NOT EXISTS idx_user_table_relations_to_table ON user_table_relations(to_table_id);
CREATE INDEX IF NOT EXISTS idx_user_table_relations_to_row ON user_table_relations(to_row_id); 