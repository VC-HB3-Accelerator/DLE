CREATE TABLE IF NOT EXISTS db_settings (
    id SERIAL PRIMARY KEY,
    db_host VARCHAR(255) NOT NULL,
    db_port INTEGER NOT NULL,
    db_name VARCHAR(255) NOT NULL,
    db_user VARCHAR(255) NOT NULL,
    db_password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Для простоты предполагаем, что настройки всегда одни (id=1)
INSERT INTO db_settings (db_host, db_port, db_name, db_user, db_password)
VALUES ('postgres', 5432, 'dapp_db', 'dapp_user', 'dapp_password')
ON CONFLICT DO NOTHING; 