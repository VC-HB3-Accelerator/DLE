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
  'Я ИИ-агент, администратор компании VC HB3 Accelerator.',
  'Продолжая разговор, вы подтверждаете ознакомление с политикой и согласие на обработку персональных данных.',
  'Консультация может быть по темам: операционная система и меры поддержки для бизнеса; условия сотрудничества для подрядчиков; условия сотрудничества для инвестора.',
  'Спросите, какая тема интересует.'
].join('\n');

const DEFAULT_CALL_SYSTEM_PROMPT_EN = [
  'I am an AI agent and administrator of VC HB3 Accelerator.',
  'By continuing the call, you confirm that you have read the privacy policy and consent to personal data processing.',
  'Consultation topics: operating system and business support measures; partnership terms for contractors; investor cooperation terms.',
  'Ask which topic they are interested in.'
].join('\n');

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
    booking_editor_user_id: settings.booking_editor_user_id,
    booking_slot_minutes: settings.booking_slot_minutes,
    booking_hours: settings.booking_hours,
    model_call: settings.model_call || '',
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
       confirmations = $14,
       invoice_ttl_minutes = $15,
       booking_slot_minutes = $16,
       booking_hours_json = $17::jsonb,
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
      next.system_prompt
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
