-- Миграция: добавление внешних ключей для admin_read_messages и admin_read_contacts
-- Автор: Тарабанов Александр Викторович
-- Дата: 2025-10-08
-- Описание: Очищает невалидные данные и добавляет FK на users

BEGIN;

-- Очистка невалидных данных из admin_read_messages
DELETE FROM admin_read_messages 
WHERE admin_id NOT IN (SELECT id FROM users)
   OR user_id NOT IN (SELECT id FROM users);

-- Очистка невалидных данных из admin_read_contacts
DELETE FROM admin_read_contacts 
WHERE admin_id NOT IN (SELECT id FROM users)
   OR contact_id NOT IN (SELECT id FROM users);

-- Добавляем FK для admin_read_messages
ALTER TABLE admin_read_messages
ADD CONSTRAINT fk_admin_read_messages_admin_id 
FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE admin_read_messages
ADD CONSTRAINT fk_admin_read_messages_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Добавляем FK для admin_read_contacts
ALTER TABLE admin_read_contacts
ADD CONSTRAINT fk_admin_read_contacts_admin_id 
FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE admin_read_contacts
ADD CONSTRAINT fk_admin_read_contacts_contact_id 
FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE;

-- Комментарии для документации
COMMENT ON CONSTRAINT fk_admin_read_messages_admin_id ON admin_read_messages IS 'FK на администратора';
COMMENT ON CONSTRAINT fk_admin_read_messages_user_id ON admin_read_messages IS 'FK на пользователя';
COMMENT ON CONSTRAINT fk_admin_read_contacts_admin_id ON admin_read_contacts IS 'FK на администратора';
COMMENT ON CONSTRAINT fk_admin_read_contacts_contact_id ON admin_read_contacts IS 'FK на контакт (пользователя)';

COMMIT;

