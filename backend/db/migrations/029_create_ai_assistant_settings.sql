-- Создаем таблицу ai_assistant_settings если она не существует
CREATE TABLE IF NOT EXISTS ai_assistant_settings (
    id SERIAL PRIMARY KEY,
    system_prompt_encrypted TEXT,
    selected_rag_tables INTEGER[],
    languages TEXT[],
    model_encrypted TEXT,
    rules JSONB,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INTEGER
);

-- Пропускаем INSERT, так как данные должны быть зашифрованы
-- INSERT INTO ai_assistant_settings (system_prompt, selected_rag_tables, languages, model, rules)
-- VALUES (
--   'Вы — полезный ассистент. Отвечайте на русском языке.',
--   ARRAY[]::INTEGER[],
--   ARRAY['ru'],
--   'qwen2.5',
--   '{"checkUserTags": true, "searchRagFirst": true, "generateIfNoRag": true, "requireAdminApproval": true}'
-- )
-- ON CONFLICT DO NOTHING; 