/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const encryptedDb = require('./encryptedDatabaseService');
const db = require('../db');
const TABLE = 'ai_assistant_settings';
const logger = require('../utils/logger');

const TONE_VALUES = ['neutral', 'business', 'warm'];
const RESPONSE_LENGTH_VALUES = ['short', 'balanced', 'detailed'];
const FORMALITY_VALUES = ['strict', 'normal', 'soft'];
const EXPLANATION_LEVEL_DEFAULT_VALUES = ['auto', 'plain', 'balanced', 'expert'];
const FALLBACK_IF_NOT_CONFIDENT_VALUES = ['chat', 'staff', 'chat_or_staff'];
const DEFAULT_ENABLED_CHANNELS = { web: true, telegram: true, email: true };

function defaultBehaviorSettings() {
  return {
    tone: 'business',
    response_length: 'balanced',
    formality: 'normal',
    adapt_to_user: true,
    explanation_level_default: 'auto',
    allow_gentle_rephrase_offer: true,
    avoid_jargon_by_default: true,
    quality_over_speed: true,
    fallback_if_not_confident: 'chat_or_staff',
    forbid_vulgar_tone: true,
    forbid_patronizing_tone: true,
    forbid_slang_mirroring: true
  };
}

async function ensureAssistantSettingsSchema() {
  await db.getQuery()(`ALTER TABLE ai_assistant_settings ADD COLUMN IF NOT EXISTS tone TEXT NOT NULL DEFAULT 'business'`);
  await db.getQuery()(`ALTER TABLE ai_assistant_settings ADD COLUMN IF NOT EXISTS response_length TEXT NOT NULL DEFAULT 'balanced'`);
  await db.getQuery()(`ALTER TABLE ai_assistant_settings ADD COLUMN IF NOT EXISTS formality TEXT NOT NULL DEFAULT 'normal'`);
  await db.getQuery()(`ALTER TABLE ai_assistant_settings ADD COLUMN IF NOT EXISTS adapt_to_user BOOLEAN NOT NULL DEFAULT TRUE`);
  await db.getQuery()(`ALTER TABLE ai_assistant_settings ADD COLUMN IF NOT EXISTS explanation_level_default TEXT NOT NULL DEFAULT 'auto'`);
  await db.getQuery()(`ALTER TABLE ai_assistant_settings ADD COLUMN IF NOT EXISTS allow_gentle_rephrase_offer BOOLEAN NOT NULL DEFAULT TRUE`);
  await db.getQuery()(`ALTER TABLE ai_assistant_settings ADD COLUMN IF NOT EXISTS avoid_jargon_by_default BOOLEAN NOT NULL DEFAULT TRUE`);
  await db.getQuery()(`ALTER TABLE ai_assistant_settings ADD COLUMN IF NOT EXISTS quality_over_speed BOOLEAN NOT NULL DEFAULT TRUE`);
  await db.getQuery()(`ALTER TABLE ai_assistant_settings ADD COLUMN IF NOT EXISTS fallback_if_not_confident TEXT NOT NULL DEFAULT 'chat_or_staff'`);
  await db.getQuery()(`ALTER TABLE ai_assistant_settings ADD COLUMN IF NOT EXISTS forbid_vulgar_tone BOOLEAN NOT NULL DEFAULT TRUE`);
  await db.getQuery()(`ALTER TABLE ai_assistant_settings ADD COLUMN IF NOT EXISTS forbid_patronizing_tone BOOLEAN NOT NULL DEFAULT TRUE`);
  await db.getQuery()(`ALTER TABLE ai_assistant_settings ADD COLUMN IF NOT EXISTS forbid_slang_mirroring BOOLEAN NOT NULL DEFAULT TRUE`);
}

function asBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return Boolean(value);
}

function asEnum(value, fallback, allowed) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  return allowed.includes(raw) ? raw : fallback;
}

function normalizeEnabledChannels(enabledChannels) {
  if (!enabledChannels || typeof enabledChannels !== 'object') {
    return { ...DEFAULT_ENABLED_CHANNELS };
  }
  return {
    ...DEFAULT_ENABLED_CHANNELS,
    ...Object.keys(enabledChannels).reduce((acc, key) => {
      acc[key] = Boolean(enabledChannels[key]);
      return acc;
    }, {})
  };
}

function normalizeBehaviorSettings(raw = {}) {
  const defaults = defaultBehaviorSettings();
  return {
    tone: asEnum(raw.tone, defaults.tone, TONE_VALUES),
    response_length: asEnum(raw.response_length, defaults.response_length, RESPONSE_LENGTH_VALUES),
    formality: asEnum(raw.formality, defaults.formality, FORMALITY_VALUES),
    adapt_to_user: asBool(raw.adapt_to_user, defaults.adapt_to_user),
    explanation_level_default: asEnum(
      raw.explanation_level_default,
      defaults.explanation_level_default,
      EXPLANATION_LEVEL_DEFAULT_VALUES
    ),
    allow_gentle_rephrase_offer: asBool(
      raw.allow_gentle_rephrase_offer,
      defaults.allow_gentle_rephrase_offer
    ),
    avoid_jargon_by_default: asBool(
      raw.avoid_jargon_by_default,
      defaults.avoid_jargon_by_default
    ),
    quality_over_speed: asBool(raw.quality_over_speed, defaults.quality_over_speed),
    fallback_if_not_confident: asEnum(
      raw.fallback_if_not_confident,
      defaults.fallback_if_not_confident,
      FALLBACK_IF_NOT_CONFIDENT_VALUES
    ),
    forbid_vulgar_tone: asBool(raw.forbid_vulgar_tone, defaults.forbid_vulgar_tone),
    forbid_patronizing_tone: asBool(raw.forbid_patronizing_tone, defaults.forbid_patronizing_tone),
    forbid_slang_mirroring: asBool(raw.forbid_slang_mirroring, defaults.forbid_slang_mirroring)
  };
}

function loadAcceptInput() {
  try {
    return require('/app/shared/assistantAcceptInput');
  } catch (_) {
    return require('../../shared/assistantAcceptInput');
  }
}

async function getSettings() {
  try {
    logger.info('[aiAssistantSettingsService] getSettings called');
    await ensureAssistantSettingsSchema();
    
    const settings = await encryptedDb.getData(TABLE, {}, 1, 'id');
    logger.info(`[aiAssistantSettingsService] Raw settings from DB:`, settings);
    
    const setting = settings[0] || null;
    if (!setting) {
      logger.warn('[aiAssistantSettingsService] No settings found in DB');
      return null;
    }

    // Обрабатываем selected_rag_tables
    if (setting.selected_rag_tables) {
      try {
        // Если это строка JSON, парсим её
        if (typeof setting.selected_rag_tables === 'string') {
          setting.selected_rag_tables = JSON.parse(setting.selected_rag_tables);
        }
        
        // Убеждаемся, что это массив
        if (!Array.isArray(setting.selected_rag_tables)) {
          setting.selected_rag_tables = [setting.selected_rag_tables];
        }
        
        logger.info(`[aiAssistantSettingsService] Processed selected_rag_tables:`, setting.selected_rag_tables);
      } catch (parseError) {
        logger.error('[aiAssistantSettingsService] Error parsing selected_rag_tables:', parseError);
        setting.selected_rag_tables = [];
      }
    } else {
      setting.selected_rag_tables = [];
    }

    // Обрабатываем rules_id
    if (setting.rules_id && typeof setting.rules_id === 'string') {
      try {
        setting.rules_id = parseInt(setting.rules_id);
      } catch (parseError) {
        logger.error('[aiAssistantSettingsService] Error parsing rules_id:', parseError);
        setting.rules_id = null;
      }
    }

    let enabledChannels = setting.enabled_channels;
    if (typeof enabledChannels === 'string') {
      try {
        enabledChannels = JSON.parse(enabledChannels);
      } catch (parseError) {
        logger.error('[aiAssistantSettingsService] Error parsing enabled_channels:', parseError);
        enabledChannels = null;
      }
    }
    setting.enabled_channels = normalizeEnabledChannels(enabledChannels);

    const { parseAcceptInputForGenerate } = loadAcceptInput();
    setting.accept_input = parseAcceptInputForGenerate(setting.accept_input);
    Object.assign(setting, normalizeBehaviorSettings(setting));

    logger.info(`[aiAssistantSettingsService] Final settings result:`, {
      id: setting.id,
      selected_rag_tables: setting.selected_rag_tables,
      rules_id: setting.rules_id,
      hasSupportEmail: setting.hasSupportEmail,
      hasTelegramBot: setting.hasTelegramBot,
      timestamp: setting.timestamp,
      enabled_channels: setting.enabled_channels,
      accept_input: setting.accept_input,
      tone: setting.tone,
      response_length: setting.response_length,
      formality: setting.formality
    });

    return setting;
  } catch (error) {
    logger.error('[aiAssistantSettingsService] Error in getSettings:', error);
    throw error;
  }
}

async function upsertSettings({
  system_prompt,
  selected_rag_tables,
  model,
  embedding_model,
  rules,
  rules_id,
  updated_by,
  telegram_settings_id,
  email_settings_id,
  system_message,
  enabled_channels,
  accept_input,
  tone,
  response_length,
  formality,
  adapt_to_user,
  explanation_level_default,
  allow_gentle_rephrase_offer,
  avoid_jargon_by_default,
  quality_over_speed,
  fallback_if_not_confident,
  forbid_vulgar_tone,
  forbid_patronizing_tone,
  forbid_slang_mirroring
}) {
  await ensureAssistantSettingsSchema();
  const channelsPayload = normalizeEnabledChannels(enabled_channels);

  const { normalizeAcceptInput } = loadAcceptInput();
  const acceptPayload = normalizeAcceptInput(accept_input);
  const behavior = normalizeBehaviorSettings({
    tone,
    response_length,
    formality,
    adapt_to_user,
    explanation_level_default,
    allow_gentle_rephrase_offer,
    avoid_jargon_by_default,
    quality_over_speed,
    fallback_if_not_confident,
    forbid_vulgar_tone,
    forbid_patronizing_tone,
    forbid_slang_mirroring
  });

  const data = {
    id: 1,
    system_prompt,
    selected_rag_tables,
    languages: ['ru'],
    model,
    embedding_model,
    rules_id: rules_id ?? rules ?? null,
    updated_at: new Date(),
    updated_by,
    telegram_settings_id,
    email_settings_id,
    system_message,
    enabled_channels: channelsPayload,
    accept_input: acceptPayload,
    ...behavior
  };

  const existing = await encryptedDb.getData(TABLE, { id: 1 }, 1);

  if (existing.length > 0) {
    return await encryptedDb.saveData(TABLE, data, { id: 1 });
  } else {
    return await encryptedDb.saveData(TABLE, data);
  }
}

module.exports = {
  getSettings,
  upsertSettings,
  ensureAssistantSettingsSchema,
  defaultBehaviorSettings,
  normalizeBehaviorSettings,
  TONE_VALUES,
  RESPONSE_LENGTH_VALUES,
  FORMALITY_VALUES,
  EXPLANATION_LEVEL_DEFAULT_VALUES,
  FALLBACK_IF_NOT_CONFIDENT_VALUES
};