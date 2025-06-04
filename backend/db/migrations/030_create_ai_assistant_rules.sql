CREATE TABLE IF NOT EXISTS ai_assistant_rules (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    rules JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE ai_assistant_settings
ADD COLUMN IF NOT EXISTS rules_id INTEGER REFERENCES ai_assistant_rules(id); 