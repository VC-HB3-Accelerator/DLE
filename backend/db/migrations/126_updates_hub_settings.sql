-- Migration: 126_updates_hub_settings
-- Description: Настройки раздачи обновлений и Gitea-storage в БД (не .env)
-- Date: 2026-07-24

CREATE TABLE IF NOT EXISTS updates_hub_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- По умолчанию клиентский режим; на HB3 в UI → self. Секреты только через UI.
  hub_url TEXT NOT NULL DEFAULT 'https://hb3-accelerator.com',
  stub_mode BOOLEAN NOT NULL DEFAULT true,
  gitea_url TEXT NOT NULL DEFAULT '',
  gitea_token_encrypted TEXT,
  -- общий секрет клиентский инстанс ↔ hub для POST /authorize
  hub_service_token_encrypted TEXT,
  gitea_asset_template TEXT NOT NULL DEFAULT '',
  gitea_org TEXT NOT NULL DEFAULT '',
  gitea_repo TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO updates_hub_settings (
  id, hub_url, stub_mode, gitea_url, gitea_asset_template, gitea_org, gitea_repo
) VALUES (
  1,
  -- Клиентский дефолт: только URL hub. Gitea заполняют только на раздающем HB3 (hub_url=self).
  'https://hb3-accelerator.com',
  true,
  '',
  '',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE updates_hub_settings IS
  'Конфиг закрытой раздачи updates + приватный Gitea (токен шифруется)';

-- DOWN
-- DROP TABLE IF EXISTS updates_hub_settings;
