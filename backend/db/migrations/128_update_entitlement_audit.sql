-- Migration: 128_update_entitlement_audit
-- Description: Аудит entitlement обновлений ОС (license на казне DLE)
-- Date: 2026-08-03
-- См. docs.ru/tz-updates-license-check.ru.md §6

CREATE TABLE IF NOT EXISTS update_entitlement_audit (
  id BIGSERIAL PRIMARY KEY,
  dle_contract TEXT NOT NULL,
  result TEXT NOT NULL,
  reason TEXT,
  token_address TEXT,
  treasury_address TEXT,
  chain_id INTEGER,
  network TEXT,
  balance TEXT,
  min_balance TEXT,
  user_id INTEGER,
  wallet_address TEXT,
  request_id TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_update_entitlement_audit_dle
  ON update_entitlement_audit (dle_contract, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_update_entitlement_audit_checked
  ON update_entitlement_audit (checked_at DESC);

COMMENT ON TABLE update_entitlement_audit IS
  'Аудит проверки license-токена на казне при authorize updates (без секретов/RPC URL)';

-- DOWN
-- DROP TABLE IF EXISTS update_entitlement_audit;
