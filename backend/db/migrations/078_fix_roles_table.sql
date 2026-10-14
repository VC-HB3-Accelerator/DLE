-- Миграция для инициализации таблицы roles
-- Создаем базовые роли при первичной миграции

-- Добавляем базовые роли
INSERT INTO roles (name_encrypted) VALUES 
  (encrypt_text('user', get_encryption_key())),
  (encrypt_text('readonly', get_encryption_key())),
  (encrypt_text('editor', get_encryption_key()))
ON CONFLICT DO NOTHING;

-- Добавляем уникальный индекс для предотвращения дубликатов
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_name_encrypted_unique ON roles(name_encrypted);

-- 3. Проверяем результат
SELECT 
  id, 
  created_at, 
  decrypt_text(name_encrypted, get_encryption_key()) as name 
FROM roles 
ORDER BY id;

-- 4. Комментарий к миграции
COMMENT ON TABLE roles IS 'Таблица ролей пользователей: user, admin, readonly, editor';
