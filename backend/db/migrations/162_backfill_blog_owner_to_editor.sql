-- UP Migration
-- Старые посты блога без author/owner → первому редактору (иначе /blog?owner= пустой)

UPDATE admin_pages_simple
SET owner_user_id = (
  SELECT u.id
  FROM users u
  WHERE u.role = 'editor'
  ORDER BY u.id ASC
  LIMIT 1
)
WHERE owner_user_id IS NULL
  AND show_in_blog = TRUE
  AND status = 'published'
  AND EXISTS (SELECT 1 FROM users u2 WHERE u2.role = 'editor');

-- DOWN Migration
-- UPDATE admin_pages_simple SET owner_user_id = NULL
-- WHERE show_in_blog = TRUE AND status = 'published';
