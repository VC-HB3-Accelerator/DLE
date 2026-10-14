-- Migration: 106_blog_emoji_reactions
-- Description: Эмодзи-реакции вместо like/dislike (heart, fire, clap, idea, wow)
-- Date: 2026-07-15

UPDATE blog_reactions SET type = 'heart' WHERE type = 'like';
DELETE FROM blog_reactions WHERE type = 'dislike';

-- На случай дублей after merge like->heart under unique (page_id, user_id)
DELETE FROM blog_reactions a
  USING blog_reactions b
WHERE a.page_id = b.page_id
  AND a.user_id = b.user_id
  AND a.id > b.id;
