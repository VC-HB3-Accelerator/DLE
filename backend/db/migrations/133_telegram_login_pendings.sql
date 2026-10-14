-- UP Migration
-- 133_telegram_login_pendings.sql
-- Pending tokens for Telegram deep-link login (/start=TOKEN ↔ browser session)

CREATE TABLE IF NOT EXISTS telegram_login_pendings (
  token VARCHAR(64) PRIMARY KEY,
  session_sid VARCHAR(255) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guest_id TEXT,
  privacy_accepted BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tg_login_pendings_expires
  ON telegram_login_pendings (expires_at);

COMMENT ON TABLE telegram_login_pendings IS
  'Одноразовые токены deep-link входа/привязки Telegram (TTL ~10 мин).';

-- DOWN Migration
-- DROP TABLE IF EXISTS telegram_login_pendings;
