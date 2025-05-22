CREATE TABLE IF NOT EXISTS email_settings (
    id SERIAL PRIMARY KEY,
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INTEGER NOT NULL,
    smtp_user VARCHAR(255) NOT NULL,
    smtp_password VARCHAR(255) NOT NULL,
    imap_host VARCHAR(255),
    imap_port INTEGER,
    from_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Для простоты предполагаем, что настройки всегда одни (id=1)
INSERT INTO email_settings (smtp_host, smtp_port, smtp_user, smtp_password, imap_host, imap_port, from_email)
VALUES ('smtp.example.com', 465, 'user@example.com', 'password', 'imap.example.com', 993, 'noreply@example.com')
ON CONFLICT DO NOTHING; 