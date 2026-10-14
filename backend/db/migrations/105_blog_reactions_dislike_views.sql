-- Migration: 105_blog_reactions_dislike_views
-- Description: Одна реакция на пользователя (лайк/дизлайк) + счётчик просмотров статей блога
-- Date: 2026-07-15

-- Если у пользователя уже есть и like и dislike — оставляем like
DELETE FROM blog_reactions AS d
USING blog_reactions AS l
WHERE d.page_id = l.page_id
  AND d.user_id = l.user_id
  AND d.type = 'dislike'
  AND l.type = 'like';

-- На всякий случай убираем любые другие дубли по (page_id, user_id)
DELETE FROM blog_reactions a
  USING blog_reactions b
WHERE a.page_id = b.page_id
  AND a.user_id = b.user_id
  AND a.id > b.id;

ALTER TABLE blog_reactions
  DROP CONSTRAINT IF EXISTS blog_reactions_page_id_user_id_type_key;

DROP INDEX IF EXISTS blog_reactions_page_id_user_id_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS blog_reactions_page_user_uidx
  ON blog_reactions (page_id, user_id);

ALTER TABLE admin_pages_simple
  ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN admin_pages_simple.views_count IS 'Счётчик просмотров статьи блога';
