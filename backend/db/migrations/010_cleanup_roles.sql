-- Проверяем существование типа user_role
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'admin');
  END IF;
END $$;

-- Удаляем лишние колонки и связи
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_id_fkey;
ALTER TABLE users DROP COLUMN IF EXISTS role_id;

-- Добавляем колонку role если её нет
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role user_role DEFAULT 'user'::user_role;
  END IF;
END $$;

-- Удаляем лишние триггеры и функции
DROP TRIGGER IF EXISTS sync_identity_type_trigger ON user_identities;
DROP TRIGGER IF EXISTS user_identity_role_check ON user_identities;
DROP TRIGGER IF EXISTS check_admin_role_trigger ON user_identities;
DROP FUNCTION IF EXISTS sync_identity_type() CASCADE;
DROP FUNCTION IF EXISTS update_user_role() CASCADE;
DROP FUNCTION IF EXISTS check_admin_role(INTEGER) CASCADE;

-- Создаем функцию проверки роли
CREATE FUNCTION check_admin_role() 
RETURNS TRIGGER AS $$
DECLARE
  v_wallet_address VARCHAR;
BEGIN
  SELECT provider_id INTO v_wallet_address
  FROM user_identities
  WHERE user_id = NEW.user_id 
  AND provider = 'wallet'
  LIMIT 1;

  IF v_wallet_address IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE users 
  SET role = 'admin'::user_role
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер
CREATE TRIGGER check_admin_role_trigger
AFTER INSERT OR UPDATE ON user_identities
FOR EACH ROW
EXECUTE FUNCTION check_admin_role();

-- Обновляем существующие записи
UPDATE users u
SET role = CASE 
  WHEN EXISTS (
    SELECT 1 FROM user_identities ui 
    WHERE ui.user_id = u.id 
    AND ui.provider = 'wallet'
  ) THEN 'admin'::user_role
  ELSE 'user'::user_role
END;