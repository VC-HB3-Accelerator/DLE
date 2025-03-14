// Создаем таблицу для хранения сообщений неаутентифицированных пользователей
const createGuestMessagesTable = `
CREATE TABLE IF NOT EXISTS guest_messages (
  id SERIAL PRIMARY KEY,
  guest_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  is_ai BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_messages_guest_id ON guest_messages(guest_id);
`;

module.exports = createGuestMessagesTable; 