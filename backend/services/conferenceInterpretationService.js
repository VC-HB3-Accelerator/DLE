/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Лайв-синхрон: перевод речи participant ↔ host (текст + озвучка).
 */

const logger = require('../utils/logger');
const aiProviderSettingsService = require('./aiProviderSettingsService');
const conferenceTranslateService = require('./conferenceTranslateService');
const conferenceRealtimeService = require('./conferenceRealtimeService');
const conferenceService = require('./conferenceService');
const conferenceInterpretationHub = require('./conferenceInterpretationHub');
const { streamTranslationSpeech } = require('./conferenceInterpretationTts');
const { QWEN_AUDIO_REALTIME_MODEL } = require('./qwenRealtimeService');

function isInterpretationEnabled(conf) {
  return Boolean(conf?.interpretation_enabled);
}

function pushInterpretLine(conferenceId, payload) {
  conferenceInterpretationHub.sendJsonToRole(conferenceId, 'primary', payload);
  conferenceInterpretationHub.sendJsonToRole(conferenceId, 'host', payload);
}

async function getTtsProvider() {
  const settings = await aiProviderSettingsService.getProviderSettings('qwencloud');
  if (!settings?.api_key) return null;
  return settings;
}

/**
 * Речь participant (primary mic) → текст host + озвучка редактору.
 */
async function handleParticipantUtterance(conferenceId, conf, originalText, actorId) {
  const text = String(originalText || '').trim();
  if (!text) return;

  let translated = null;
  try {
    translated = await conferenceTranslateService.translateForConferenceRoles(
      text,
      'participant',
      conf
    );
  } catch (e) {
    logger.warn('[conferenceInterpretation] translate participant:', e?.message || e);
  }

  try {
    await conferenceRealtimeService.appendTranscript(conferenceId, 'participant', text, {
      translatedText: translated
    });
  } catch (e) {
    logger.warn('[conferenceInterpretation] append participant:', e?.message || e);
  }

  const line = {
    type: 'interpret_line',
    role: 'participant',
    original: text,
    translated: translated || null,
    target_lang: conf.host_language || 'ru'
  };
  pushInterpretLine(conferenceId, line);

  if (!isInterpretationEnabled(conf)) return;

  const provider = await getTtsProvider();
  if (!provider) return;

  const speakText = translated || text;
  await streamTranslationSpeech({
    conferenceId,
    targetRole: 'host',
    text: speakText,
    language: conf.host_language || 'ru',
    providerSettings: provider,
    model: QWEN_AUDIO_REALTIME_MODEL
  });
}

/**
 * Речь host → текст guest + озвучка primary (юзеру).
 */
async function handleHostUtterance(conferenceId, conf, originalText) {
  const text = String(originalText || '').trim();
  if (!text) return;

  let translated = null;
  try {
    translated = await conferenceTranslateService.translateForConferenceRoles(text, 'host', conf);
  } catch (e) {
    logger.warn('[conferenceInterpretation] translate host:', e?.message || e);
  }

  try {
    await conferenceRealtimeService.appendTranscript(conferenceId, 'host', text, {
      translatedText: translated
    });
  } catch (e) {
    logger.warn('[conferenceInterpretation] append host:', e?.message || e);
  }

  const line = {
    type: 'interpret_line',
    role: 'host',
    original: text,
    translated: translated || null,
    target_lang: conf.guest_language || 'en'
  };
  pushInterpretLine(conferenceId, line);

  if (!isInterpretationEnabled(conf)) return;

  const provider = await getTtsProvider();
  if (!provider) return;

  const speakText = translated || text;
  await streamTranslationSpeech({
    conferenceId,
    targetRole: 'primary',
    text: speakText,
    language: conf.guest_language || 'en',
    providerSettings: provider,
    model: QWEN_AUDIO_REALTIME_MODEL
  });
}

async function loadConf(conferenceId) {
  const { session } = await conferenceService.getSession(conferenceId);
  return session;
}

module.exports = {
  isInterpretationEnabled,
  handleParticipantUtterance,
  handleHostUtterance,
  loadConf
};
