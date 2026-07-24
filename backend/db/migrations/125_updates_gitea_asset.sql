-- Migration: 125_updates_gitea_asset
-- Description: URL asset в приватном Gitea (хранилище за API HB3)
-- Date: 2026-07-24

ALTER TABLE update_releases
  ADD COLUMN IF NOT EXISTS gitea_asset_url TEXT;

COMMENT ON COLUMN update_releases.gitea_asset_url IS
  'Приватный URL asset в Gitea; клиент не ходит напрямую — только API hub';

-- DOWN
-- ALTER TABLE update_releases DROP COLUMN IF EXISTS gitea_asset_url;
