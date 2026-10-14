-- UP Migration
-- Владелец пользовательских таблиц + владелец страниц блога/контента

-- 1) user_tables.created_by — кто создал таблицу (личный /tables)
ALTER TABLE user_tables
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_tables_created_by
  ON user_tables (created_by)
  WHERE created_by IS NOT NULL;

COMMENT ON COLUMN user_tables.created_by IS
  'Пользователь, создавший таблицу (own-scope для /tables)';

-- Системные таблицы (теги/правила ассистента) остаются без владельца (created_by IS NULL).
-- Прочие старые таблицы без истории создателя: не угадываем owner — остаются NULL,
-- пока пользователь не создаст новые (новые INSERT пишут created_by).

-- 2) admin_pages_simple — owner для ленты ?owner=
ALTER TABLE admin_pages_simple
  ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE admin_pages_simple
  ADD COLUMN IF NOT EXISTS owner_domain TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_pages_simple_owner_user_id
  ON admin_pages_simple (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_pages_simple_owner_domain
  ON admin_pages_simple (owner_domain)
  WHERE owner_domain IS NOT NULL;

COMMENT ON COLUMN admin_pages_simple.owner_user_id IS
  'Владелец объявления/поста (фильтр /blog?owner= и dataScope own)';
COMMENT ON COLUMN admin_pages_simple.owner_domain IS
  'Домен владельца (dataScope domain)';

-- Backfill: author_address вида user:<id>
UPDATE admin_pages_simple
SET owner_user_id = CAST(substring(author_address FROM 6) AS INTEGER)
WHERE owner_user_id IS NULL
  AND author_address ~ '^user:[0-9]+$'
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = CAST(substring(admin_pages_simple.author_address FROM 6) AS INTEGER)
  );

-- Backfill: author_address = wallet → user_identities(provider=wallet)
UPDATE admin_pages_simple AS p
SET owner_user_id = matched.user_id
FROM (
  SELECT
    ui.user_id,
    lower(decrypt_text(ui.provider_id_encrypted, get_encryption_key())) AS wallet_addr
  FROM user_identities ui
  WHERE ui.provider_encrypted = encrypt_text('wallet', get_encryption_key())
) AS matched
WHERE p.owner_user_id IS NULL
  AND p.author_address IS NOT NULL
  AND length(trim(p.author_address)) > 0
  AND lower(trim(p.author_address)) = matched.wallet_addr;

-- DOWN Migration
-- DROP INDEX IF EXISTS idx_admin_pages_simple_owner_domain;
-- DROP INDEX IF EXISTS idx_admin_pages_simple_owner_user_id;
-- ALTER TABLE admin_pages_simple DROP COLUMN IF EXISTS owner_domain;
-- ALTER TABLE admin_pages_simple DROP COLUMN IF EXISTS owner_user_id;
-- DROP INDEX IF EXISTS idx_user_tables_created_by;
-- ALTER TABLE user_tables DROP COLUMN IF EXISTS created_by;
