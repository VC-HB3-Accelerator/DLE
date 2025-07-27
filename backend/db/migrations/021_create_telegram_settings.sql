-- Создаем таблицу telegram_settings если она не существует
CREATE TABLE IF NOT EXISTS telegram_settings (
    id SERIAL PRIMARY KEY,
    bot_token_encrypted TEXT,
    bot_username_encrypted TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Пропускаем INSERT, так как данные должны быть зашифрованы
-- INSERT INTO telegram_settings (bot_token, bot_username)
-- VALUES ('your-telegram-bot-token', 'your_bot_username')
-- ON CONFLICT DO NOTHING; 