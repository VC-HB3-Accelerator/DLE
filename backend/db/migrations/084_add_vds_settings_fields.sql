-- Migration: 084_add_vds_settings_fields
-- Description: Добавление полей для всех настроек VDS
-- Date: 2025-11-14

ALTER TABLE vds_settings
ADD COLUMN IF NOT EXISTS email_encrypted TEXT,
ADD COLUMN IF NOT EXISTS ubuntu_user_encrypted TEXT,
ADD COLUMN IF NOT EXISTS docker_user_encrypted TEXT,
ADD COLUMN IF NOT EXISTS ssh_host_encrypted TEXT,
ADD COLUMN IF NOT EXISTS ssh_port INTEGER,
ADD COLUMN IF NOT EXISTS ssh_user_encrypted TEXT,
ADD COLUMN IF NOT EXISTS ssh_password_encrypted TEXT;

-- Комментарии
COMMENT ON COLUMN vds_settings.email_encrypted IS 'Зашифрованный email для SSL сертификата';
COMMENT ON COLUMN vds_settings.ubuntu_user_encrypted IS 'Зашифрованный логин Ubuntu';
COMMENT ON COLUMN vds_settings.docker_user_encrypted IS 'Зашифрованный логин Docker';
COMMENT ON COLUMN vds_settings.ssh_host_encrypted IS 'Зашифрованный SSH хост';
COMMENT ON COLUMN vds_settings.ssh_port IS 'SSH порт (не шифруется)';
COMMENT ON COLUMN vds_settings.ssh_user_encrypted IS 'Зашифрованный SSH пользователь';
COMMENT ON COLUMN vds_settings.ssh_password_encrypted IS 'Зашифрованный SSH пароль';



