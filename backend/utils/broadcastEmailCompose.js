/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Сборка письма рассылки из независимых блоков.
 * AI меняет только subject + greeting; body / signature / legal_footer / fingerprint — нет.
 */

const crypto = require('crypto');

const DEFAULT_GREETING = 'Здравствуйте!';
const FINGERPRINT_LENGTH = 20;
/** Без символов, ломающих HTML/MIME: < > & " ' \ */
const FINGERPRINT_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%*_+-=';

const LINK_STYLE = 'color:#0563C1;text-decoration:underline;';
const MAIN_STYLE = 'font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#333333;';
const MUTED_STYLE = 'font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.4;color:#999999;margin-top:16px;';

let schemaReady = false;

function normalizePart(value) {
  const text = String(value || '').trim();
  return text || '';
}

/** Уникальный хвост письма (анти-шаблон спама), не через LLM. */
function generateUniqueToken(length = FINGERPRINT_LENGTH) {
  const size = Math.min(Math.max(Number(length) || FINGERPRINT_LENGTH, 12), 32);
  const bytes = crypto.randomBytes(size);
  let out = '';
  for (let i = 0; i < size; i += 1) {
    out += FINGERPRINT_ALPHABET[bytes[i] % FINGERPRINT_ALPHABET.length];
  }
  return out;
}

function isFingerprintLine(line) {
  const s = String(line || '').trim();
  return /^[A-Za-z0-9!@#$%*_\+\-=]{12,32}$/.test(s);
}

/**
 * Склеивает финальное тело письма (plain text, без subject).
 * Порядок: greeting → body → signature → legal → fingerprint.
 */
function composeEmailBody({
  greeting = '',
  body = '',
  signature = '',
  legalFooter = '',
  fingerprint = ''
} = {}) {
  const parts = [
    normalizePart(greeting),
    normalizePart(body),
    normalizePart(signature),
    normalizePart(legalFooter),
    normalizePart(fingerprint)
  ].filter(Boolean);

  return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function resolveGreeting(greeting) {
  const g = normalizePart(greeting);
  return g || DEFAULT_GREETING;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Экранирование + синие ссылки + <br>. */
function linkifyAndEscape(text) {
  const raw = String(text || '');
  const urlRe = /(https?:\/\/[^\s]+)/g;
  let last = 0;
  let out = '';
  let match = urlRe.exec(raw);
  while (match) {
    out += escapeHtml(raw.slice(last, match.index));
    let url = match[1];
    let trailing = '';
    const trimMatch = url.match(/^(.*?)([),.;:!?]+)$/);
    if (trimMatch && !/[/?#]$/.test(trimMatch[1])) {
      url = trimMatch[1];
      trailing = trimMatch[2];
    }
    out += `<a href="${escapeHtml(url)}" style="${LINK_STYLE}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
    out += escapeHtml(trailing);
    last = match.index + match[0].length;
    match = urlRe.exec(raw);
  }
  out += escapeHtml(raw.slice(last));
  return out.replace(/\r?\n/g, '<br>');
}

function escapeWithBreaks(text) {
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

/**
 * Отделяет основной текст от legal+fingerprint (для HTML-стилей).
 */
function splitMainAndMuted(text, legalFooter = '') {
  const full = String(text || '').trim();
  if (!full) {
    return { main: '', muted: '' };
  }

  const legal = normalizePart(legalFooter);
  if (legal) {
    const idx = full.lastIndexOf(legal);
    if (idx >= 0) {
      return {
        main: full.slice(0, idx).trim(),
        muted: full.slice(idx).trim()
      };
    }
  }

  const lines = full.split(/\n/);
  const last = (lines[lines.length - 1] || '').trim();
  if (isFingerprintLine(last)) {
    return {
      main: lines.slice(0, -1).join('\n').trim(),
      muted: last
    };
  }

  return { main: full, muted: '' };
}

/**
 * HTML письма: основной текст стандартный, ссылки синие,
 * legal + fingerprint — мелкий светло-серый.
 */
function composeEmailHtml({
  greeting = '',
  body = '',
  signature = '',
  legalFooter = '',
  fingerprint = '',
  plainText = null,
  trackingPixelUrl = null
} = {}) {
  let mainHtml = '';
  let mutedHtml = '';

  if (plainText != null) {
    const { main, muted } = splitMainAndMuted(plainText, legalFooter);
    if (main) {
      mainHtml = `<div style="${MAIN_STYLE}">${linkifyAndEscape(main)}</div>`;
    }
    if (muted) {
      mutedHtml = `<div style="${MUTED_STYLE}">${escapeWithBreaks(muted)}</div>`;
    }
  } else {
    const mainParts = [
      normalizePart(greeting),
      normalizePart(body),
      normalizePart(signature)
    ].filter(Boolean);
    const mutedParts = [
      normalizePart(legalFooter),
      normalizePart(fingerprint)
    ].filter(Boolean);

    if (mainParts.length) {
      mainHtml = `<div style="${MAIN_STYLE}">${linkifyAndEscape(mainParts.join('\n\n'))}</div>`;
    }
    if (mutedParts.length) {
      mutedHtml = `<div style="${MUTED_STYLE}">${escapeWithBreaks(mutedParts.join('\n\n'))}</div>`;
    }
  }

  const pixel = trackingPixelUrl
    ? `<img src="${escapeHtml(trackingPixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`
    : '';

  return [
    '<!DOCTYPE html>',
    '<html><body style="margin:0;padding:0;">',
    '<div style="margin:0;padding:16px;">',
    mainHtml,
    mutedHtml,
    pixel,
    '</div>',
    '</body></html>'
  ].join('');
}

/**
 * @param {Function} queryFn — db.getQuery()
 */
async function ensureBroadcastComposeSchema(queryFn) {
  if (schemaReady) return;
  const q = typeof queryFn === 'function' ? queryFn : queryFn;
  await q(`ALTER TABLE broadcast_campaigns ADD COLUMN IF NOT EXISTS greeting TEXT`);
  await q(`ALTER TABLE broadcast_campaigns ADD COLUMN IF NOT EXISTS signature TEXT`);
  await q(`ALTER TABLE broadcast_campaigns ADD COLUMN IF NOT EXISTS legal_footer TEXT`);
  await q(`ALTER TABLE broadcast_templates ADD COLUMN IF NOT EXISTS greeting TEXT`);
  await q(`ALTER TABLE broadcast_templates ADD COLUMN IF NOT EXISTS signature TEXT`);
  await q(`ALTER TABLE broadcast_templates ADD COLUMN IF NOT EXISTS legal_footer TEXT`);
  schemaReady = true;
}

module.exports = {
  DEFAULT_GREETING,
  FINGERPRINT_LENGTH,
  normalizePart,
  generateUniqueToken,
  isFingerprintLine,
  composeEmailBody,
  composeEmailHtml,
  splitMainAndMuted,
  linkifyAndEscape,
  resolveGreeting,
  ensureBroadcastComposeSchema
};
