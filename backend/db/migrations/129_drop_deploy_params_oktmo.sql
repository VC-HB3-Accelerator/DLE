-- Migration: 129_drop_deploy_params_oktmo
-- Description: Полное удаление ОКТМО из параметров деплоя (поля нет в DLE.sol)
-- Date: 2026-08-03

ALTER TABLE IF EXISTS deploy_params
  DROP COLUMN IF EXISTS oktmo;

-- DOWN (не восстанавливаем данные)
-- ALTER TABLE deploy_params ADD COLUMN IF NOT EXISTS oktmo TEXT;
