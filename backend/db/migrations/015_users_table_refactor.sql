-- Миграция для изменения структуры таблицы users
-- Добавляем поля first_name и last_name (колонки email и address уже зашифрованы)

-- Добавляем временные колонки
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);

-- Добавляем комментарии к столбцам
COMMENT ON COLUMN users.first_name IS 'Имя пользователя';
COMMENT ON COLUMN users.last_name IS 'Фамилия пользователя';

-- Обновляем статистику таблицы
ANALYZE users; 