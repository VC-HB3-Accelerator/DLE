-- Миграция 075: Исправление типов данных в admin_read_contacts
-- Изменяем contact_id с INTEGER на TEXT для поддержки гостевых контактов
-- (гости имеют строковые ID типа "telegram:123", "email:user@example.com")

BEGIN;

-- Удаляем существующую таблицу и создаем заново с правильными типами
DROP TABLE IF EXISTS admin_read_contacts CASCADE;

CREATE TABLE admin_read_contacts (
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL, -- Изменено с INTEGER на TEXT для поддержки гостевых идентификаторов
  read_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (admin_id, contact_id)
);

-- Создаем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_admin_read_contacts_admin ON admin_read_contacts(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_read_contacts_contact ON admin_read_contacts(contact_id);

COMMIT;
