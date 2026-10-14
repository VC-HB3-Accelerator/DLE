-- Privacy hub docs stay on /content/published, not in /blog feed.
-- Category «политика и согласия»: force show_in_blog = FALSE for public published copies.
-- Idempotent. Blog filter politika-i-soglasiya removed if present.

UPDATE admin_pages_simple
SET show_in_blog = FALSE,
    updated_at = NOW()
WHERE LOWER(TRIM(COALESCE(category, ''))) = LOWER(TRIM('политика и согласия'))
  AND status = 'published'
  AND visibility = 'public'
  AND COALESCE(is_system_template, FALSE) = FALSE
  AND COALESCE(show_in_blog, FALSE) = TRUE;

DO $$
DECLARE
  fid INTEGER;
BEGIN
  IF to_regclass('public.blog_feed_filters') IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO fid FROM blog_feed_filters WHERE slug = 'politika-i-soglasiya' LIMIT 1;
  IF fid IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.blog_feed_filter_pages') IS NOT NULL THEN
    DELETE FROM blog_feed_filter_pages WHERE filter_id = fid;
  END IF;

  DELETE FROM blog_feed_filters WHERE id = fid;
END $$;
