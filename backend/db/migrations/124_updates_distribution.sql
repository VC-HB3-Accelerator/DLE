-- Migration: 124_updates_distribution
-- Description: Закрытая раздача update-pack (метаданные версий + one-time download tokens)
-- Date: 2026-07-24

CREATE TABLE IF NOT EXISTS update_releases (
  id SERIAL PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  min_from TEXT,
  changelog TEXT,
  pack_filename TEXT NOT NULL,
  pack_sha256 TEXT,
  pack_size_bytes BIGINT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS update_download_tokens (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  release_id INTEGER NOT NULL REFERENCES update_releases(id) ON DELETE CASCADE,
  dle_contract TEXT NOT NULL,
  user_id INTEGER,
  wallet_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_update_download_tokens_token
  ON update_download_tokens (token);

CREATE INDEX IF NOT EXISTS idx_update_download_tokens_expires
  ON update_download_tokens (expires_at);

COMMENT ON TABLE update_releases IS 'Зарегистрированные update-pack версии для закрытой раздачи';
COMMENT ON TABLE update_download_tokens IS 'Одноразовые URL-токены скачивания (TTL)';

-- DOWN
-- DROP TABLE IF EXISTS update_download_tokens;
-- DROP TABLE IF EXISTS update_releases;
