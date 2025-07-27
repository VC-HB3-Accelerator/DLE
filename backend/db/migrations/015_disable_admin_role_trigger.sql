-- Отключаем триггер check_admin_role_trigger, который вызывает ошибку с зашифрованными полями
-- Проверка роли админа теперь происходит в JavaScript коде

-- Удаляем триггер
DROP TRIGGER IF EXISTS check_admin_role_trigger ON user_identities;

-- Удаляем функцию, так как она больше не нужна
DROP FUNCTION IF EXISTS check_admin_role() CASCADE;

-- Комментарий: Проверка роли админа теперь происходит в JavaScript коде
-- в файлах auth-service.js, admin-role.js и других сервисах 