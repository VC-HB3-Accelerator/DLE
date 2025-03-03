-- Создание таблицы для связи идентификаторов пользователей
CREATE TABLE IF NOT EXISTS user_identities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  identity_type VARCHAR(20) NOT NULL, -- 'ethereum', 'telegram', 'email'
  identity_value VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(identity_type, identity_value)
);

-- Создание таблицы для предпочтений пользователей
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  preference_key VARCHAR(50) NOT NULL,
  preference_value TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, preference_key)
);

-- Создание таблицы для взаимодействий пользователей
CREATE TABLE IF NOT EXISTS user_interactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  interaction_type VARCHAR(50) NOT NULL,
  interaction_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Создание таблицы для тем пользователей
CREATE TABLE IF NOT EXISTS user_topics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  topic VARCHAR(100) NOT NULL,
  relevance_score FLOAT DEFAULT 1.0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, topic)
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_user_identities_user_id ON user_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_topics_user_id ON user_topics(user_id); 