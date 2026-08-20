/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const logger = require('../utils/logger');

let schemaReady = false;

async function ensureVoiceCallSchema() {
  if (schemaReady) return;
  const db = require('../db');
  const query = db.getQuery();
  await query(`
    CREATE TABLE IF NOT EXISTS voice_call_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      paid_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      model_call TEXT,
      booking_editor_user_id INTEGER,
      pay_mode TEXT NOT NULL DEFAULT 'wallet',
      pay_to_address TEXT,
      chain_id INTEGER,
      token_symbol TEXT NOT NULL DEFAULT 'USDT',
      token_address TEXT,
      token_decimals INTEGER NOT NULL DEFAULT 6,
      packages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      hard_stop BOOLEAN NOT NULL DEFAULT TRUE,
      write_call_stub_to_chat BOOLEAN NOT NULL DEFAULT FALSE,
      confirmations INTEGER NOT NULL DEFAULT 3,
      invoice_ttl_minutes INTEGER NOT NULL DEFAULT 20,
      booking_slot_minutes INTEGER NOT NULL DEFAULT 30,
      booking_hours_json JSONB NOT NULL DEFAULT '{"startUtc":9,"endUtc":18}'::jsonb,
      system_prompt TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by INTEGER
    )
  `);
  await query(`
    INSERT INTO voice_call_settings (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS system_prompt TEXT`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS tone TEXT NOT NULL DEFAULT 'business'`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS response_length TEXT NOT NULL DEFAULT 'balanced'`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS formality TEXT NOT NULL DEFAULT 'normal'`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS adapt_to_caller BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS explanation_level_default TEXT NOT NULL DEFAULT 'auto'`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS allow_gentle_rephrase_offer BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS avoid_jargon_by_default BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS forbid_abbreviations_in_voice BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS allow_professional_terms TEXT NOT NULL DEFAULT 'minimal'`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS explain_terms_if_needed BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS quality_over_speed BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS allow_check_kb_phrase BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS fallback_if_not_confident TEXT NOT NULL DEFAULT 'chat_or_staff'`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS forbid_flirty_tone BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS forbid_vulgar_tone BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS forbid_patronizing_tone BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS forbid_slang_mirroring BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE voice_call_settings ADD COLUMN IF NOT EXISTS save_call_recording BOOLEAN NOT NULL DEFAULT TRUE`);
  await query(`ALTER TABLE ai_call_sessions ADD COLUMN IF NOT EXISTS recording_media_id INTEGER`);
  await query(`ALTER TABLE ai_call_sessions ADD COLUMN IF NOT EXISTS transcript_text TEXT`);
  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'content_media_media_type_check'
      ) THEN
        ALTER TABLE content_media DROP CONSTRAINT content_media_media_type_check;
      END IF;
      ALTER TABLE content_media
        ADD CONSTRAINT content_media_media_type_check
        CHECK (media_type IN ('image', 'video', 'audio'));
    EXCEPTION
      WHEN undefined_table THEN
        NULL;
    END $$
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_call_invoices (
      id UUID PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_user_id INTEGER,
      owner_guest_id TEXT,
      package_id TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      sticker_units NUMERIC(78, 0) NOT NULL,
      amount_unique_units NUMERIC(78, 0) NOT NULL,
      tail_units NUMERIC(78, 0) NOT NULL,
      token_symbol TEXT NOT NULL,
      token_address TEXT NOT NULL,
      token_decimals INTEGER NOT NULL,
      chain_id INTEGER NOT NULL,
      pay_to_address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      tx_hash TEXT,
      paid_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS ai_call_invoices_tx_hash_uidx ON ai_call_invoices (tx_hash) WHERE tx_hash IS NOT NULL`);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ai_call_invoices_amount_window_uidx
    ON ai_call_invoices (chain_id, token_address, pay_to_address, amount_unique_units)
    WHERE status IN ('pending', 'confirming')
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_call_credits (
      owner_key TEXT PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_user_id INTEGER,
      owner_guest_id TEXT,
      seconds_remaining INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_call_sessions (
      id UUID PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_user_id INTEGER,
      owner_guest_id TEXT,
      invoice_id UUID,
      package_id TEXT,
      minutes INTEGER NOT NULL,
      model_call TEXT,
      status TEXT NOT NULL DEFAULT 'ready',
      ended_reason TEXT,
      ticket TEXT,
      started_at TIMESTAMPTZ,
      deadline_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      seconds_used INTEGER NOT NULL DEFAULT 0,
      credit_debited BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS ai_call_sessions_owner_idx ON ai_call_sessions (owner_type, owner_user_id, owner_guest_id, status)`);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_call_bookings (
      id UUID PRIMARY KEY,
      editor_user_id INTEGER NOT NULL,
      guest_user_id INTEGER,
      starts_at TIMESTAMPTZ NOT NULL,
      minutes INTEGER NOT NULL,
      conference_id INTEGER,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS ai_call_bookings_slot_uidx ON ai_call_bookings (editor_user_id, starts_at) WHERE status <> 'cancelled'`);
  schemaReady = true;
}

async function ensureVoiceCallSchemaSafe() {
  try {
    await ensureVoiceCallSchema();
  } catch (error) {
    logger.warn('[voiceCall] schema:', error.message);
  }
}

module.exports = {
  ensureVoiceCallSchema,
  ensureVoiceCallSchemaSafe
};
