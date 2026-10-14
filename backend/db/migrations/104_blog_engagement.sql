-- Migration: 104_blog_engagement
-- Description: Лайки, комментарии и подписчики блога
-- Date: 2026-07-15

CREATE TABLE IF NOT EXISTS blog_reactions (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_blog_reactions_page_id ON blog_reactions(page_id);
CREATE INDEX IF NOT EXISTS idx_blog_reactions_user_id ON blog_reactions(user_id);

CREATE TABLE IF NOT EXISTS blog_comments (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES blog_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_blog_comments_page_id ON blog_comments(page_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_parent_id ON blog_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_user_id ON blog_comments(user_id);

CREATE TABLE IF NOT EXISTS blog_subscribers (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  confirm_token TEXT,
  confirmed_at TIMESTAMPTZ,
  source_page_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_blog_subscribers_confirmed_at ON blog_subscribers(confirmed_at);
CREATE INDEX IF NOT EXISTS idx_blog_subscribers_confirm_token ON blog_subscribers(confirm_token);

COMMENT ON TABLE blog_reactions IS 'Реакции пользователей на статьи блога';
COMMENT ON TABLE blog_comments IS 'Комментарии и ответы под статьями блога';
COMMENT ON TABLE blog_subscribers IS 'Подписчики на рассылку блога';
