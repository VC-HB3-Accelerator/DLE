CREATE TABLE IF NOT EXISTS user_identities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider_encrypted TEXT NOT NULL,
  provider_id_encrypted TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создаем индексы после создания таблицы
DO $$ 
BEGIN 
  -- Индекс для user_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'user_identities' AND indexname = 'idx_user_identities_user_id'
  ) THEN
    CREATE INDEX idx_user_identities_user_id ON user_identities(user_id);
  END IF;

  -- Индекс для provider и provider_id (пропускаем, так как колонки зашифрованы)
  -- Индекс будет создан автоматически при необходимости
END $$;