-- UP Migration
-- Комментарий и ссылка на контакт (users), файлы — отдельная таблица

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS comment_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS link_encrypted TEXT;

CREATE TABLE IF NOT EXISTS user_contact_files (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stored_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  media_kind VARCHAR(20) NOT NULL DEFAULT 'other'
    CHECK (media_kind IN ('image', 'video', 'audio', 'pdf', 'other')),
  file_size BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_contact_files_user_id ON user_contact_files(user_id);

-- DOWN Migration
-- DROP TABLE IF EXISTS user_contact_files;
-- ALTER TABLE users DROP COLUMN IF EXISTS link_encrypted;
-- ALTER TABLE users DROP COLUMN IF EXISTS comment_encrypted;
