/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Перевод чата ИИ-конференции через OpenAI (ai_providers_settings).
 */

const logger = require('../utils/logger');
const aiProviderSettingsService = require('./aiProviderSettingsService');
const openaiProxy = require('./openaiProxy');

function normalizeLang(value, fallback = 'en') {
  const lang = String(value || '').trim().toLowerCase();
  if (/^[a-z]{2}(-[a-z]{2})?$/.test(lang)) return lang.slice(0, 2);
  return fallback;
}

/**
 * Перевести текст с sourceLang на targetLang.
 * При совпадении языков или ошибке — null (чат работает без перевода).
 */
async function translateChatText(text, sourceLang, targetLang) {
  const body = String(text || '').trim();
  if (!body) return null;

  const from = normalizeLang(sourceLang, 'en');
  const to = normalizeLang(targetLang, 'en');
  if (from === to) return null;

  const providerSettings = await aiProviderSettingsService.getProviderSettings('openai');
  if (!providerSettings?.api_key) {
    logger.warn('[conferenceTranslate] OpenAI key missing — skip translation');
    return null;
  }

  const model =
    providerSettings.selected_model ||
    providerSettings.model ||
    'gpt-4o-mini';

  try {
    const client = openaiProxy.createOpenAIClient(providerSettings, { timeout: 20000 });
    const response = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        {
          role: 'system',
          content:
            'You are a precise conference chat translator. Translate the user message only. ' +
            'Keep meaning, names and numbers. Output plain translated text only — no quotes, no notes.'
        },
        {
          role: 'user',
          content: `Translate from ${from} to ${to}:\n\n${body.slice(0, 4000)}`
        }
      ]
    });
    const translated = String(response.choices?.[0]?.message?.content || '').trim();
    return translated || null;
  } catch (e) {
    logger.error('[conferenceTranslate] failed:', e?.message || e);
    return null;
  }
}

/**
 * Для роли host → перевод на guest_language;
 * для participant → перевод на host_language.
 */
async function translateForConferenceRoles(text, role, session) {
  if (role !== 'host' && role !== 'participant') return null;
  const guest = session?.guest_language || 'en';
  const host = session?.host_language || 'ru';
  if (role === 'host') {
    return translateChatText(text, host, guest);
  }
  return translateChatText(text, guest, host);
}

module.exports = {
  translateChatText,
  translateForConferenceRoles,
  normalizeLang
};
