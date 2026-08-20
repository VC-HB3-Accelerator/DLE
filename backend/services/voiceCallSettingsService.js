/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Настройки звонков. По умолчанию звонки бесплатные.
 * Платёжная форма живёт только при paid_enabled=true.
 */

const { ethers } = require('ethers');
const db = require('../db');
const { ensureVoiceCallSchema } = require('./voiceCallSchema');
const { normalizeBookingHours } = require('./voiceCallSlotTime');

const DEFAULT_PACKAGES = [
  { id: 'p5', minutes: 5, price: '0' },
  { id: 'p15', minutes: 15, price: '0' },
  { id: 'p30', minutes: 30, price: '0' }
];

const DEFAULT_CALL_SYSTEM_PROMPT = [
  'Скажи один раз целиком, без дроблений и без повторов:',
  '«Здравствуйте! Я секретарь с искусственным интеллектом VC HB3 Accelerator. Продолжая разговор, вы принимаете условия политики и соглашений, опубликованных на странице операционной системы. Чем могу помочь?»',
  'После приветствия веди диалог: слушай абонента, отвечай по существу и задавай уточняющие вопросы, чтобы квалифицировать клиента и помочь решить его вопрос.',
  'Ответы ищи только в корпусе базы знаний, который тебе передан. Не выдумывай факты вне справки.',
  'Если тема или ответ несут потенциальные риски (юридические, финансовые, инвестиционные условия, обязательства) — явно скажи, что в ответах возможны ошибки, и порекомендуй забронировать слот с представителями фонда.',
  'Не повторяй приветствие, согласие и вопрос «чем могу помочь». Не говори «венчурный фонд» рядом с названием VC HB3 Accelerator. Не упоминай «проверку сервиса» и «предварительные ответы». Не говори «ИИ-секретарь» — только «секретарь с искусственным интеллектом».'
].join('\n');

const DEFAULT_CALL_SYSTEM_PROMPT_EN = [
  'Say once as a single block, do not split or repeat:',
  '"Hello! I am a secretary with artificial intelligence at VC HB3 Accelerator. By continuing, you accept the policy and agreements published on the operating system page. How can I help?"',
  'After the greeting, run the conversation: listen to the caller, answer substantively, and ask clarifying questions to qualify the client and help resolve their issue.',
  'Find answers only in the knowledge-base corpus provided to you. Do not invent facts outside that pack.',
  'If the topic or answer carries potential risks (legal, financial, investment terms, obligations) — clearly say that answers may contain errors, and recommend booking a slot with fund representatives.',
  'Do not repeat the greeting, consent, or "how can I help". Do not say "venture fund" next to the name VC HB3 Accelerator. Do not mention a "service check" or "provisional answers". Do not say "AI secretary" — only "secretary with artificial intelligence".'
].join('\n');

const TONE_VALUES = ['neutral', 'business', 'warm'];
const RESPONSE_LENGTH_VALUES = ['short', 'balanced', 'detailed'];
const FORMALITY_VALUES = ['strict', 'normal', 'soft'];
const EXPLANATION_LEVEL_DEFAULT_VALUES = ['auto', 'plain', 'balanced', 'expert'];
const ALLOW_PROFESSIONAL_TERMS_VALUES = ['minimal', 'balanced', 'free'];
const FALLBACK_IF_NOT_CONFIDENT_VALUES = ['chat', 'staff', 'chat_or_staff'];

function normalizeCallLocale(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'en' || s.startsWith('en-') || s.startsWith('en_')) return 'en';
  return 'ru';
}

/** Operator prompt from DB; if still RU default and UI is EN → EN default. */
function resolveCallSystemPrompt(storedPrompt, locale) {
  const stored = String(storedPrompt || '').trim();
  const loc = normalizeCallLocale(locale);
  if (loc === 'en') {
    if (!stored || stored === DEFAULT_CALL_SYSTEM_PROMPT) return DEFAULT_CALL_SYSTEM_PROMPT_EN;
    return stored;
  }
  if (!stored) return DEFAULT_CALL_SYSTEM_PROMPT;
  return stored;
}

function defaultSettings() {
  return {
    enabled: true,
    paid_enabled: false,
    model_call: '',
    system_prompt: DEFAULT_CALL_SYSTEM_PROMPT,
    booking_editor_user_id: null,
    pay_mode: 'wallet',
    pay_to_address: '',
    chain_id: null,
    token_symbol: 'USDT',
    token_address: '',
    token_decimals: 6,
    packages: DEFAULT_PACKAGES.map((p) => ({ ...p })),
    hard_stop: true,
    write_call_stub_to_chat: false,
    save_call_recording: true,
    tone: 'business',
    response_length: 'balanced',
    formality: 'normal',
    adapt_to_caller: true,
    explanation_level_default: 'auto',
    allow_gentle_rephrase_offer: true,
    avoid_jargon_by_default: true,
    forbid_abbreviations_in_voice: true,
    allow_professional_terms: 'minimal',
    explain_terms_if_needed: true,
    quality_over_speed: true,
    allow_check_kb_phrase: true,
    fallback_if_not_confident: 'chat_or_staff',
    forbid_flirty_tone: true,
    forbid_vulgar_tone: true,
    forbid_patronizing_tone: true,
    forbid_slang_mirroring: true,
    confirmations: 3,
    invoice_ttl_minutes: 20,
    booking_slot_minutes: 30,
    booking_hours: {
      startHour: 9,
      endHour: 18,
      startUtc: 9,
      endUtc: 18,
      timeZone: 'Europe/Moscow',
      weekdays: [1, 2, 3, 4, 5]
    }
  };
}

function asBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return Boolean(value);
}

function asInt(value, fallback, { min = 0, max = 1e9 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min || i > max) return fallback;
  return i;
}

function asEnum(value, fallback, allowed) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  return allowed.includes(raw) ? raw : fallback;
}

function normalizePackages(raw) {
  const list = Array.isArray(raw) ? raw : DEFAULT_PACKAGES;
  const out = [];
  for (const item of list) {
    const minutes = asInt(item?.minutes, 0, { min: 1, max: 24 * 60 });
    if (!minutes) continue;
    const price = String(item?.price ?? '0').trim() || '0';
    if (!/^\d+(\.\d{1,18})?$/.test(price)) {
      const err = new Error('Некорректная цена пакета');
      err.code = 'INVALID_PACKAGE_PRICE';
      err.status = 400;
      throw err;
    }
    out.push({
      id: String(item?.id || `p${minutes}`).slice(0, 32),
      minutes,
      price
    });
  }
  if (!out.length) {
    const err = new Error('Нужен хотя бы один пакет минут');
    err.code = 'PACKAGES_REQUIRED';
    err.status = 400;
    throw err;
  }
  return out;
}

function optionalAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!ethers.isAddress(raw)) {
    const err = new Error('Укажите корректный адрес кошелька или контракта');
    err.code = 'INVALID_ADDRESS';
    err.status = 400;
    throw err;
  }
  return ethers.getAddress(raw);
}

function mapRow(row) {
  const defaults = defaultSettings();
  if (!row) return defaults;
  let packages = row.packages_json;
  if (typeof packages === 'string') {
    try { packages = JSON.parse(packages); } catch (_) { packages = defaults.packages; }
  }
  let hours = row.booking_hours_json;
  if (typeof hours === 'string') {
    try { hours = JSON.parse(hours); } catch (_) { hours = defaults.booking_hours; }
  }
  return {
    enabled: row.enabled !== false,
    paid_enabled: Boolean(row.paid_enabled),
    model_call: row.model_call || '',
    system_prompt: String(row.system_prompt || '').trim() || defaults.system_prompt,
    booking_editor_user_id: row.booking_editor_user_id ? Number(row.booking_editor_user_id) : null,
    pay_mode: row.pay_mode === 'treasury' ? 'treasury' : 'wallet',
    pay_to_address: row.pay_to_address || '',
    chain_id: row.chain_id ? Number(row.chain_id) : null,
    token_symbol: row.token_symbol || 'USDT',
    token_address: row.token_address || '',
    token_decimals: asInt(row.token_decimals, 6, { min: 0, max: 18 }),
    packages: normalizePackages(packages && packages.length ? packages : defaults.packages),
    hard_stop: row.hard_stop !== false,
    write_call_stub_to_chat: Boolean(row.write_call_stub_to_chat),
    save_call_recording: row.save_call_recording !== false,
    tone: asEnum(row.tone, defaults.tone, TONE_VALUES),
    response_length: asEnum(row.response_length, defaults.response_length, RESPONSE_LENGTH_VALUES),
    formality: asEnum(row.formality, defaults.formality, FORMALITY_VALUES),
    adapt_to_caller: asBool(row.adapt_to_caller, defaults.adapt_to_caller),
    explanation_level_default: asEnum(
      row.explanation_level_default,
      defaults.explanation_level_default,
      EXPLANATION_LEVEL_DEFAULT_VALUES
    ),
    allow_gentle_rephrase_offer: asBool(
      row.allow_gentle_rephrase_offer,
      defaults.allow_gentle_rephrase_offer
    ),
    avoid_jargon_by_default: asBool(
      row.avoid_jargon_by_default,
      defaults.avoid_jargon_by_default
    ),
    forbid_abbreviations_in_voice: asBool(
      row.forbid_abbreviations_in_voice,
      defaults.forbid_abbreviations_in_voice
    ),
    allow_professional_terms: asEnum(
      row.allow_professional_terms,
      defaults.allow_professional_terms,
      ALLOW_PROFESSIONAL_TERMS_VALUES
    ),
    explain_terms_if_needed: asBool(row.explain_terms_if_needed, defaults.explain_terms_if_needed),
    quality_over_speed: asBool(row.quality_over_speed, defaults.quality_over_speed),
    allow_check_kb_phrase: asBool(row.allow_check_kb_phrase, defaults.allow_check_kb_phrase),
    fallback_if_not_confident: asEnum(
      row.fallback_if_not_confident,
      defaults.fallback_if_not_confident,
      FALLBACK_IF_NOT_CONFIDENT_VALUES
    ),
    forbid_flirty_tone: asBool(row.forbid_flirty_tone, defaults.forbid_flirty_tone),
    forbid_vulgar_tone: asBool(row.forbid_vulgar_tone, defaults.forbid_vulgar_tone),
    forbid_patronizing_tone: asBool(row.forbid_patronizing_tone, defaults.forbid_patronizing_tone),
    forbid_slang_mirroring: asBool(row.forbid_slang_mirroring, defaults.forbid_slang_mirroring),
    confirmations: asInt(row.confirmations, 3, { min: 1, max: 64 }),
    invoice_ttl_minutes: asInt(row.invoice_ttl_minutes, 20, { min: 15, max: 24 * 60 }),
    booking_slot_minutes: asInt(row.booking_slot_minutes, 30, { min: 10, max: 180 }),
    booking_hours: normalizeBookingHours(hours, defaultSettings().booking_hours)
  };
}

function publicConfig(settings) {
  return {
    enabled: settings.enabled,
    paid_enabled: settings.paid_enabled,
    packages: settings.packages,
    token_symbol: settings.token_symbol,
    token_decimals: settings.token_decimals,
    token_address: settings.token_address,
    chain_id: settings.chain_id,
    pay_to_address: settings.pay_to_address,
    pay_mode: settings.pay_mode,
    hard_stop: settings.hard_stop,
    save_call_recording: settings.save_call_recording !== false,
    booking_editor_user_id: settings.booking_editor_user_id,
    booking_slot_minutes: settings.booking_slot_minutes,
    booking_hours: settings.booking_hours,
    model_call: settings.model_call || '',
    tone: settings.tone,
    response_length: settings.response_length,
    formality: settings.formality,
    adapt_to_caller: settings.adapt_to_caller,
    explanation_level_default: settings.explanation_level_default,
    allow_gentle_rephrase_offer: settings.allow_gentle_rephrase_offer,
    avoid_jargon_by_default: settings.avoid_jargon_by_default,
    forbid_abbreviations_in_voice: settings.forbid_abbreviations_in_voice,
    allow_professional_terms: settings.allow_professional_terms,
    explain_terms_if_needed: settings.explain_terms_if_needed,
    quality_over_speed: settings.quality_over_speed,
    allow_check_kb_phrase: settings.allow_check_kb_phrase,
    fallback_if_not_confident: settings.fallback_if_not_confident,
    forbid_flirty_tone: settings.forbid_flirty_tone,
    forbid_vulgar_tone: settings.forbid_vulgar_tone,
    forbid_patronizing_tone: settings.forbid_patronizing_tone,
    forbid_slang_mirroring: settings.forbid_slang_mirroring,
    call_ready: Boolean(settings.enabled && settings.model_call)
  };
}

async function assertEditorUser(userId) {
  if (!userId) return null;
  const { rows } = await db.getQuery()(
    `SELECT id, role FROM users WHERE id = $1`,
    [userId]
  );
  if (!rows.length || rows[0].role !== 'editor') {
    const err = new Error('Для записи нужен пользователь с ролью editor');
    err.code = 'EDITOR_REQUIRED';
    err.status = 400;
    throw err;
  }
  return Number(rows[0].id);
}

async function getSettings() {
  await ensureVoiceCallSchema();
  const { rows } = await db.getQuery()(`SELECT * FROM voice_call_settings WHERE id = 1`);
  return mapRow(rows[0]);
}

async function saveSettings(payload = {}, updatedBy = null) {
  await ensureVoiceCallSchema();
  const current = await getSettings();
  const next = {
    enabled: asBool(payload.enabled, current.enabled),
    paid_enabled: asBool(payload.paid_enabled, current.paid_enabled),
    model_call: String(payload.model_call ?? current.model_call ?? '').trim(),
    system_prompt: String(payload.system_prompt ?? current.system_prompt ?? '')
      .replace(/\r\n/g, '\n')
      .trim()
      .slice(0, 8000) || DEFAULT_CALL_SYSTEM_PROMPT,
    booking_editor_user_id: payload.booking_editor_user_id === '' || payload.booking_editor_user_id == null
      ? null
      : asInt(payload.booking_editor_user_id, null),
    pay_mode: payload.pay_mode === 'treasury' ? 'treasury' : 'wallet',
    pay_to_address: optionalAddress(payload.pay_to_address ?? current.pay_to_address),
    chain_id: payload.chain_id === '' || payload.chain_id == null ? null : asInt(payload.chain_id, current.chain_id),
    token_symbol: String(payload.token_symbol ?? current.token_symbol ?? 'USDT').trim().slice(0, 16) || 'USDT',
    token_address: optionalAddress(payload.token_address ?? current.token_address),
    token_decimals: asInt(payload.token_decimals, current.token_decimals, { min: 0, max: 18 }),
    packages: normalizePackages(payload.packages ?? current.packages),
    hard_stop: asBool(payload.hard_stop, current.hard_stop),
    write_call_stub_to_chat: asBool(payload.write_call_stub_to_chat, current.write_call_stub_to_chat),
    save_call_recording: asBool(payload.save_call_recording, current.save_call_recording),
    tone: asEnum(payload.tone, current.tone, TONE_VALUES),
    response_length: asEnum(payload.response_length, current.response_length, RESPONSE_LENGTH_VALUES),
    formality: asEnum(payload.formality, current.formality, FORMALITY_VALUES),
    adapt_to_caller: asBool(payload.adapt_to_caller, current.adapt_to_caller),
    explanation_level_default: asEnum(
      payload.explanation_level_default,
      current.explanation_level_default,
      EXPLANATION_LEVEL_DEFAULT_VALUES
    ),
    allow_gentle_rephrase_offer: asBool(
      payload.allow_gentle_rephrase_offer,
      current.allow_gentle_rephrase_offer
    ),
    avoid_jargon_by_default: asBool(payload.avoid_jargon_by_default, current.avoid_jargon_by_default),
    forbid_abbreviations_in_voice: asBool(
      payload.forbid_abbreviations_in_voice,
      current.forbid_abbreviations_in_voice
    ),
    allow_professional_terms: asEnum(
      payload.allow_professional_terms,
      current.allow_professional_terms,
      ALLOW_PROFESSIONAL_TERMS_VALUES
    ),
    explain_terms_if_needed: asBool(payload.explain_terms_if_needed, current.explain_terms_if_needed),
    quality_over_speed: asBool(payload.quality_over_speed, current.quality_over_speed),
    allow_check_kb_phrase: asBool(payload.allow_check_kb_phrase, current.allow_check_kb_phrase),
    fallback_if_not_confident: asEnum(
      payload.fallback_if_not_confident,
      current.fallback_if_not_confident,
      FALLBACK_IF_NOT_CONFIDENT_VALUES
    ),
    forbid_flirty_tone: asBool(payload.forbid_flirty_tone, current.forbid_flirty_tone),
    forbid_vulgar_tone: asBool(payload.forbid_vulgar_tone, current.forbid_vulgar_tone),
    forbid_patronizing_tone: asBool(payload.forbid_patronizing_tone, current.forbid_patronizing_tone),
    forbid_slang_mirroring: asBool(payload.forbid_slang_mirroring, current.forbid_slang_mirroring),
    confirmations: asInt(payload.confirmations, current.confirmations, { min: 1, max: 64 }),
    invoice_ttl_minutes: asInt(payload.invoice_ttl_minutes, current.invoice_ttl_minutes, { min: 15, max: 1440 }),
    booking_slot_minutes: asInt(payload.booking_slot_minutes, current.booking_slot_minutes, { min: 10, max: 180 }),
    booking_hours: normalizeBookingHours(
      payload.booking_hours != null ? { ...current.booking_hours, ...payload.booking_hours } : current.booking_hours,
      current.booking_hours
    )
  };
  if (!next.booking_editor_user_id) next.booking_editor_user_id = null;

  if (next.booking_editor_user_id) {
    await assertEditorUser(next.booking_editor_user_id);
  }

  if (next.model_call) {
    const { isVoiceCallRealtimeModel } = require('./qwenRealtimeService');
    if (!isVoiceCallRealtimeModel(next.model_call)) {
      const err = new Error('Для трубки нужна модель qwen3.5-omni-flash-realtime или omni-plus-realtime. Перевод, ASR и TTS сюда не подходят.');
      err.status = 400;
      err.code = 'MODEL_CALL_INVALID';
      throw err;
    }
  }

  if (next.paid_enabled) {
    if (!next.pay_to_address) {
      const err = new Error('Для платных звонков укажите адрес кошелька или контракта');
      err.status = 400;
      err.code = 'PAY_TO_REQUIRED';
      throw err;
    }
    if (!next.token_address) {
      const err = new Error('Для платных звонков укажите адрес токена');
      err.status = 400;
      err.code = 'TOKEN_REQUIRED';
      throw err;
    }
    if (!next.chain_id) {
      const err = new Error('Для платных звонков укажите сеть');
      err.status = 400;
      err.code = 'CHAIN_REQUIRED';
      throw err;
    }
  }

  await db.getQuery()(
    `UPDATE voice_call_settings SET
       enabled = $1,
       paid_enabled = $2,
       model_call = $3,
       system_prompt = $19,
       booking_editor_user_id = $4,
       pay_mode = $5,
       pay_to_address = $6,
       chain_id = $7,
       token_symbol = $8,
       token_address = $9,
       token_decimals = $10,
       packages_json = $11::jsonb,
       hard_stop = $12,
       write_call_stub_to_chat = $13,
       save_call_recording = $37,
       confirmations = $14,
       invoice_ttl_minutes = $15,
       booking_slot_minutes = $16,
       booking_hours_json = $17::jsonb,
       tone = $20,
       response_length = $21,
       formality = $22,
       adapt_to_caller = $23,
       explanation_level_default = $24,
       allow_gentle_rephrase_offer = $25,
       avoid_jargon_by_default = $26,
       forbid_abbreviations_in_voice = $27,
       allow_professional_terms = $28,
       explain_terms_if_needed = $29,
       quality_over_speed = $30,
       allow_check_kb_phrase = $31,
       fallback_if_not_confident = $32,
       forbid_flirty_tone = $33,
       forbid_vulgar_tone = $34,
       forbid_patronizing_tone = $35,
       forbid_slang_mirroring = $36,
       updated_at = NOW(),
       updated_by = $18
     WHERE id = 1`,
    [
      next.enabled,
      next.paid_enabled,
      next.model_call || null,
      next.booking_editor_user_id,
      next.pay_mode,
      next.pay_to_address || null,
      next.chain_id,
      next.token_symbol,
      next.token_address || null,
      next.token_decimals,
      JSON.stringify(next.packages),
      next.hard_stop,
      next.write_call_stub_to_chat,
      next.confirmations,
      next.invoice_ttl_minutes,
      next.booking_slot_minutes,
      JSON.stringify(next.booking_hours),
      updatedBy,
      next.system_prompt,
      next.tone,
      next.response_length,
      next.formality,
      next.adapt_to_caller,
      next.explanation_level_default,
      next.allow_gentle_rephrase_offer,
      next.avoid_jargon_by_default,
      next.forbid_abbreviations_in_voice,
      next.allow_professional_terms,
      next.explain_terms_if_needed,
      next.quality_over_speed,
      next.allow_check_kb_phrase,
      next.fallback_if_not_confident,
      next.forbid_flirty_tone,
      next.forbid_vulgar_tone,
      next.forbid_patronizing_tone,
      next.forbid_slang_mirroring,
      next.save_call_recording
    ]
  );
  return getSettings();
}

function findPackage(settings, packageId) {
  return (settings.packages || []).find((p) => p.id === String(packageId)) || null;
}

function packageNeedsPayment(settings, pkg) {
  if (!settings.paid_enabled || !pkg) return false;
  try {
    return Number(pkg.price) > 0;
  } catch (_) {
    return false;
  }
}

function isHardStopEnabled(settings) {
  if (!settings) return true;
  return settings.hard_stop !== false;
}

module.exports = {
  DEFAULT_PACKAGES,
  DEFAULT_CALL_SYSTEM_PROMPT,
  DEFAULT_CALL_SYSTEM_PROMPT_EN,
  normalizeCallLocale,
  resolveCallSystemPrompt,
  TONE_VALUES,
  RESPONSE_LENGTH_VALUES,
  FORMALITY_VALUES,
  EXPLANATION_LEVEL_DEFAULT_VALUES,
  ALLOW_PROFESSIONAL_TERMS_VALUES,
  FALLBACK_IF_NOT_CONFIDENT_VALUES,
  defaultSettings,
  normalizePackages,
  publicConfig,
  getSettings,
  saveSettings,
  findPackage,
  packageNeedsPayment,
  isHardStopEnabled,
  normalizeBookingHours,
  assertEditorUser
};
