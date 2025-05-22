CREATE TABLE IF NOT EXISTS ai_providers_settings (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(32) NOT NULL UNIQUE, -- openai, anthropic, google, ollama
    api_key VARCHAR(255),
    base_url VARCHAR(255),
    selected_model VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Пример заполнения для Ollama (без ключа)
INSERT INTO ai_providers_settings (provider, base_url, selected_model)
VALUES ('ollama', 'http://localhost:11434', 'qwen2.5')
ON CONFLICT (provider) DO NOTHING; 