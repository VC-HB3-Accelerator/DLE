-- Migration: 135_siwe_login_audit
-- Description: Аудит SIWE-входа: fact-log + шифрованный hex подписи, TTL 2 года
-- Date: 2026-08-05
-- См. docs.ru/back-docs/TZ_SIWE_LOGIN_AUDIT.ru.md

CREATE TABLE IF NOT EXISTS siwe_login_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  chain_id INTEGER NULL,
  issued_at TIMESTAMPTZ NULL,
  statement_hash TEXT NOT NULL,
  resources_hash TEXT NOT NULL,
  message_hash TEXT NOT NULL,
  signature_encrypted TEXT NOT NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_siwe_login_audit_expires
  ON siwe_login_audit (expires_at);

CREATE INDEX IF NOT EXISTS idx_siwe_login_audit_address_created
  ON siwe_login_audit (address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_siwe_login_audit_created
  ON siwe_login_audit (created_at DESC);

COMMENT ON TABLE siwe_login_audit IS
  'Аудит SIWE wallet-login: хэши statement/resources/message + encrypt_text(signature); TTL 2 года; чтение только editor';

-- DOWN
-- DROP TABLE IF EXISTS siwe_login_audit;
