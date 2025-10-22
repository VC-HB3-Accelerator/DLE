CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type_encrypted TEXT NOT NULL,
  sender_id INTEGER,
  content_encrypted TEXT,
  channel_encrypted TEXT NOT NULL,
  role_encrypted TEXT NOT NULL DEFAULT 'user',
  direction_encrypted TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tokens_used INTEGER DEFAULT 0,
  is_processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
-- CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type); -- пропускаем, колонка зашифрована
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
-- CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel); -- пропускаем, колонка зашифрована
-- CREATE INDEX IF NOT EXISTS idx_messages_metadata ON messages USING gin(metadata); -- пропускаем, колонки нет
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);