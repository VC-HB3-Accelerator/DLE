-- UP Migration
-- Лимит статей ленты для гостей (TZ_AUTH §7 guest_limit)

CREATE TABLE IF NOT EXISTS blog_feed_meta (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  guest_limit INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO blog_feed_meta (id, guest_limit) VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

-- DOWN Migration
-- DROP TABLE IF EXISTS blog_feed_meta;
