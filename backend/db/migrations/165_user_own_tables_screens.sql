-- UP Migration
-- Роль user: экраны своих таблиц (как в defaultUserScreens)

UPDATE role_screen_capabilities
SET screens = screens
  || jsonb_build_object(
    '/tables', true,
    '/tables/create', true,
    '/tables/:id', true,
    '/tables/:id/edit', true,
    '/tables/:id/delete', true
  ),
  updated_at = NOW()
WHERE role_key = 'user';

-- DOWN Migration
-- UPDATE role_screen_capabilities
-- SET screens = screens
--   || jsonb_build_object(
--     '/tables', false,
--     '/tables/create', false,
--     '/tables/:id', false,
--     '/tables/:id/edit', false,
--     '/tables/:id/delete', false
--   )
-- WHERE role_key = 'user';
