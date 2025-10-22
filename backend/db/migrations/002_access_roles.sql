CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name_encrypted TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Добавляем базовые роли (пропускаем, так как таблица уже зашифрована)
-- Роли будут добавлены через encryptedDatabaseService

-- Добавляем связь пользователей с ролями
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'role_id'
  ) THEN
    ALTER TABLE users 
    ADD COLUMN role_id INTEGER REFERENCES roles(id);
  END IF;
END $$;

-- Создаем индекс для role_id после добавления колонки
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);