-- UP Migration
-- Роль user: экраны создания своего поста и карточки магазина
-- (матрица в БД могла остаться с false после добавления путей в defaultUserScreens)

UPDATE role_screen_capabilities
SET screens = screens
  || jsonb_build_object(
    '/content/create', true,
    '/content/store/product/new', true,
    '/content/store/product/:id', true
  ),
  updated_at = NOW()
WHERE role_key = 'user';

-- DOWN Migration
-- UPDATE role_screen_capabilities
-- SET screens = screens
--   || jsonb_build_object(
--     '/content/create', false,
--     '/content/store/product/new', false,
--     '/content/store/product/:id', false
--   )
-- WHERE role_key = 'user';
