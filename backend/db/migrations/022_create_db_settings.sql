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

-- Пропускаем INSERT, так как данные должны быть зашифрованы
-- INSERT INTO db_settings (db_host, db_port, db_name, db_user, db_password)
-- VALUES ('postgres', 5432, 'dapp_db', 'dapp_user', 'dapp_password')
-- ON CONFLICT DO NOTHING; 