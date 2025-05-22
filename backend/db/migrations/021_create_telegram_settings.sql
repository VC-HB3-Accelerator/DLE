CREATE TABLE IF NOT EXISTS telegram_settings (
    id SERIAL PRIMARY KEY,
    bot_token VARCHAR(255) NOT NULL,
    bot_username VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Для простоты предполагаем, что настройки всегда одни (id=1)
INSERT INTO telegram_settings (bot_token, bot_username)
VALUES ('your-telegram-bot-token', 'your_bot_username')
ON CONFLICT DO NOTHING; 