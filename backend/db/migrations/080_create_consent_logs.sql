-- Создание таблицы для логирования согласий пользователей на обработку персональных данных
CREATE TABLE IF NOT EXISTS consent_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT, -- Адрес кошелька для идентификации пользователя
  document_id INTEGER, -- ID документа из admin_pages_simple
  document_title TEXT, -- Название документа (для истории)
  document_version TEXT, -- Версия документа (если есть версионирование)
  consent_type TEXT NOT NULL, -- Тип согласия: 'privacy_policy', 'personal_data', 'cookies', 'ai_data', etc.
  status TEXT NOT NULL DEFAULT 'granted', -- 'granted' (предоставлено) или 'revoked' (отозвано)
  ip_address TEXT, -- IP адрес пользователя
  user_agent TEXT, -- User-Agent браузера
  channel TEXT DEFAULT 'web', -- Канал согласия: 'web', 'mobile', 'siwe', etc.
  signed_at TIMESTAMP NOT NULL DEFAULT NOW(), -- Время подписания
  revoked_at TIMESTAMP, -- Время отзыва согласия (если отозвано)
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_consent_logs_user_id ON consent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_wallet_address ON consent_logs(wallet_address);
CREATE INDEX IF NOT EXISTS idx_consent_logs_document_id ON consent_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_consent_type ON consent_logs(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_logs_status ON consent_logs(status);
CREATE INDEX IF NOT EXISTS idx_consent_logs_user_consent ON consent_logs(user_id, consent_type, status);

-- Комментарии к таблице
COMMENT ON TABLE consent_logs IS 'Журнал согласий пользователей на обработку персональных данных';
COMMENT ON COLUMN consent_logs.user_id IS 'ID пользователя (может быть NULL для гостей)';
COMMENT ON COLUMN consent_logs.wallet_address IS 'Адрес кошелька Ethereum для идентификации';
COMMENT ON COLUMN consent_logs.document_id IS 'ID документа из admin_pages_simple';
COMMENT ON COLUMN consent_logs.consent_type IS 'Тип согласия: privacy_policy, personal_data, cookies, ai_data';
COMMENT ON COLUMN consent_logs.status IS 'Статус: granted (предоставлено) или revoked (отозвано)';
COMMENT ON COLUMN consent_logs.channel IS 'Канал согласия: web, mobile, siwe (Sign-In with Ethereum)';

