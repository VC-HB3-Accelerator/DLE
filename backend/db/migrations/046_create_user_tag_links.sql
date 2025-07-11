-- Миграция: таблица связей пользователей и тегов

CREATE TABLE IF NOT EXISTS user_tag_links (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES user_rows(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, tag_id)
);

-- Индексы для ускорения поиска
CREATE INDEX IF NOT EXISTS idx_user_tag_links_user_id ON user_tag_links(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tag_links_tag_id ON user_tag_links(tag_id); 