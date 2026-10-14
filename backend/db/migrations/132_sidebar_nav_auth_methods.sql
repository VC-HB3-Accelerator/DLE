-- UP Migration
-- 132_sidebar_nav_auth_methods.sql
-- Способы входа гостя в сайдбаре (wallet/telegram/email/password)

ALTER TABLE sidebar_nav_settings
  ADD COLUMN IF NOT EXISTS auth_methods_json JSONB NOT NULL
  DEFAULT '{"wallet": true, "telegram": false, "email": false, "password": false}'::jsonb;

UPDATE sidebar_nav_settings
SET auth_methods_json = COALESCE(
  auth_methods_json,
  '{"wallet": true, "telegram": false, "email": false, "password": false}'::jsonb
)
WHERE auth_methods_json IS NULL;

COMMENT ON COLUMN sidebar_nav_settings.auth_methods_json IS
  'JSON: wallet/telegram/email/password — какие способы входа видит гость в сайдбаре. wallet всегда true.';

-- DOWN Migration
-- ALTER TABLE sidebar_nav_settings DROP COLUMN IF EXISTS auth_methods_json;
