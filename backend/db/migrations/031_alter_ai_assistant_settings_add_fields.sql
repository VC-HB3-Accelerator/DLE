-- Добавление недостающих полей для интеграции с Telegram и Email, а также для системного сообщения
ALTER TABLE ai_assistant_settings
  ADD COLUMN IF NOT EXISTS telegram_settings_id INTEGER REFERENCES telegram_settings(id),
  ADD COLUMN IF NOT EXISTS email_settings_id INTEGER REFERENCES email_settings(id),
  ADD COLUMN IF NOT EXISTS system_message TEXT; 