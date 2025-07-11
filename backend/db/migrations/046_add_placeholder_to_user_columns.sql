-- Миграция: добавление поля placeholder в user_columns
 
ALTER TABLE user_columns ADD COLUMN IF NOT EXISTS placeholder VARCHAR(255) UNIQUE; 