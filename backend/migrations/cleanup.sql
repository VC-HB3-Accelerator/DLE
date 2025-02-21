-- Создаем временную таблицу для уникальных адресов
CREATE TEMP TABLE unique_users AS
SELECT DISTINCT ON (LOWER(address)) 
  id,
  LOWER(address) as address,
  created_at
FROM users
ORDER BY LOWER(address), created_at ASC;

-- Удаляем все записи из users
TRUNCATE users CASCADE;

-- Восстанавливаем уникальные записи
INSERT INTO users (id, address, created_at)
SELECT id, address, created_at FROM unique_users;

-- Обновляем последовательность id
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- Удаляем временную таблицу
DROP TABLE unique_users; 