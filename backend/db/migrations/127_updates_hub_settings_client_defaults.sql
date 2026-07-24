-- Migration: 127_updates_hub_settings_client_defaults
-- Description: Убрать Gitea org/repo с клиентских инстансов (не hub) — это не секреты HB3, а шум в UI
-- Date: 2026-07-24

-- Клиент = нет gitea_url и нет токена → очищаем org/repo
UPDATE updates_hub_settings
SET
  gitea_org = '',
  gitea_repo = '',
  updated_at = NOW()
WHERE id = 1
  AND COALESCE(gitea_url, '') = ''
  AND (gitea_token_encrypted IS NULL OR gitea_token_encrypted = '')
  AND hub_url IS DISTINCT FROM 'self'
  AND hub_url IS DISTINCT FROM 'local';

-- DOWN
-- (no-op: значения org/repo на клиентах не восстанавливаем)
