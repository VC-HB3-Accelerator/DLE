-- Создание справочника тегов
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE,
  description TEXT
);

-- Создание связующей таблицы "пользователь — тег"
CREATE TABLE IF NOT EXISTS user_tags (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, tag_id)
);
