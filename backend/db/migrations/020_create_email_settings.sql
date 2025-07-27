-- Создаем таблицу email_settings если она не существует
CREATE TABLE IF NOT EXISTS email_settings (
    id SERIAL PRIMARY KEY,
    smtp_host_encrypted TEXT,
    smtp_port INTEGER NOT NULL,
    smtp_user_encrypted TEXT,
    smtp_password_encrypted TEXT,
    imap_host_encrypted TEXT,
    imap_port INTEGER,
    from_email_encrypted TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Пропускаем INSERT, так как данные должны быть зашифрованы
-- INSERT INTO email_settings (smtp_host, smtp_port, smtp_user, smtp_password, imap_host, imap_port, from_email)
-- VALUES ('smtp.example.com', 465, 'user@example.com', 'password', 'imap.example.com', 993, 'noreply@example.com')
-- ON CONFLICT DO NOTHING; 