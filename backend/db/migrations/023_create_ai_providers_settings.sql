-- Создаем таблицу ai_providers_settings если она не существует
CREATE TABLE IF NOT EXISTS ai_providers_settings (
    id SERIAL PRIMARY KEY,
    provider_encrypted TEXT,
    api_key_encrypted TEXT,
    base_url_encrypted TEXT,
    selected_model_encrypted TEXT,
    embedding_model_encrypted TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Пропускаем INSERT, так как данные должны быть зашифрованы
-- INSERT INTO ai_providers_settings (provider, base_url, selected_model)
-- VALUES ('ollama', 'http://localhost:11434', 'qwen2.5')
-- ON CONFLICT (provider) DO NOTHING; 