-- Добавляем колонку options в таблицу user_columns
ALTER TABLE user_columns ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '{}'::jsonb;

-- Создаем индекс для быстрого поиска по options
CREATE INDEX IF NOT EXISTS idx_user_columns_options ON user_columns USING GIN (options); 