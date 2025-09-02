-- Создаем таблицу db_settings если она не существует
CREATE TABLE IF NOT EXISTS db_settings (
    id SERIAL PRIMARY KEY,
    db_host_encrypted TEXT,
    db_port INTEGER NOT NULL,
    db_name_encrypted TEXT,
    db_user_encrypted TEXT,
    db_password_encrypted TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Добавляем дефолтные настройки базы данных
INSERT INTO db_settings (id, db_port, created_at, updated_at)
VALUES (1, 5432, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    db_port = EXCLUDED.db_port,
    updated_at = NOW(); 