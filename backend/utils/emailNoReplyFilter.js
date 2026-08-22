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

/**
 * Входящая почта: «отвечать не нужно» / auto-submitted — не кормить в ИИ.
 * Цитируемую историю отрезаем, чтобы вопрос клиента поверх футера рассылки не терялся.
 */

const NO_REPLY_PATTERNS = [
  /отвечать\s+на\s+(это(т)?\s+)?(письм[оае]|сообщение)\s+не\s+нужно/i,
  /на\s+(это(т)?\s+)?(письм[оае]|сообщение)\s+отвечать\s+не\s+нужно/i,
  /отвечать\s+не\s+нужно/i,
  /не\s+отвечайте\s+на\s+(это(т)?\s+)?(письм[оае]|сообщение)/i,
  /пожалуйста,?\s+не\s+отвечайте/i,
  /ответ\s+не\s+требуется/i,
  /не\s+требует\s+ответа/i,
  /письм[оа]\s+(сформировано|создано|отправлено)\s+автоматически/i,
  /отправлено\s+автоматически/i,
  /автоматическ\w*\s+(письмо|уведомление|сообщение)/i,
  /это\s+автоматическ/i,
  /do\s+not\s+reply/i,
  /don't\s+reply/i,
  /please\s+do\s+not\s+(reply|respond)/i,
  /no\s+reply\s+(is\s+)?(needed|necessary|required)/i,
  /this\s+(is\s+an?\s+)?automated\s+(message|email|notification)/i,
  /this\s+mailbox\s+is\s+not\s+monitored/i,
  /replies?\s+to\s+this\s+(email|message)\s+are\s+not\s+(monitored|read)/i,
  /automatically\s+generated/i
];

const QUOTE_MARKERS = [
  /\nOn .{10,160} wrote:\s*\n/i,
  /\n-----Original Message-----/i,
  /\n----- Исходное сообщение -----/i,
  /\n----- Пересылаемое сообщение -----/i,
  /\nFrom:\s.+\nSent:/i,
  /\nFrom:\s.+\nDate:/i,
  /\nОт:\s.+\nОтправлено:/i,
  /\n\d{1,2}[./]\d{1,2}[./]\d{2,4}.+писал/i
];

function headerValue(parsed, name) {
  const headers = parsed?.headers;
  if (!headers || typeof headers.get !== 'function') return '';
  const raw = headers.get(name);
  if (raw == null) return '';
  if (Array.isArray(raw)) return raw.map(String).join(' ');
  return String(raw);
}

function htmlToPlain(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripQuotedEmail(text) {
  let s = String(text || '').replace(/\r\n/g, '\n');
  let cut = s.length;
  for (const re of QUOTE_MARKERS) {
    const idx = s.search(re);
    if (idx >= 0 && idx < cut) cut = idx;
  }
  s = s.slice(0, cut);
  return s
    .split('\n')
    .filter((line) => !/^\s*>/.test(line))
    .join('\n')
    .trim();
}

function matchesNoReplyPhrase(text) {
  const hay = String(text || '');
  if (!hay.trim()) return false;
  return NO_REPLY_PATTERNS.some((re) => re.test(hay));
}

function isAutoSubmitted(parsed) {
  const auto = headerValue(parsed, 'auto-submitted').trim().toLowerCase();
  if (auto && auto !== 'no') return true;
  const precedence = headerValue(parsed, 'precedence').trim().toLowerCase();
  if (['bulk', 'list', 'junk'].includes(precedence)) return true;
  const suppress = headerValue(parsed, 'x-auto-response-suppress').trim();
  if (suppress) return true;
  return false;
}

/**
 * @param {object} parsed mailparser ParsedMail
 * @returns {{ skip: boolean, reason: string|null }}
 */
function shouldSkipNoReplyEmail(parsed) {
  if (isAutoSubmitted(parsed)) {
    return { skip: true, reason: 'auto-submitted' };
  }

  const subject = String(parsed?.subject || '');
  const text = String(parsed?.text || '');
  const htmlPlain = htmlToPlain(parsed?.html || '');
  const body = [text, htmlPlain].filter(Boolean).join('\n');
  const fresh = stripQuotedEmail(body);
  const haystack = fresh.length >= 20
    ? `${subject}\n${fresh}`
    : `${subject}\n${body}`;

  if (matchesNoReplyPhrase(haystack)) {
    return { skip: true, reason: 'no-reply-phrase' };
  }
  return { skip: false, reason: null };
}

module.exports = {
  NO_REPLY_PATTERNS,
  htmlToPlain,
  stripQuotedEmail,
  matchesNoReplyPhrase,
  shouldSkipNoReplyEmail
};
