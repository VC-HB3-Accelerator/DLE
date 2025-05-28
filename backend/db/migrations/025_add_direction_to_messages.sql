-- Миграция: добавление поля direction в таблицу messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS direction VARCHAR(8); 