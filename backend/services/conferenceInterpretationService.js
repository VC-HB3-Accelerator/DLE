/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Лайв-перевод: текст в журнал и на экран.
 * Голос перевода даёт Qwen LiveTranslate в media proxy, не отдельная озвучка.
 */

const logger = require('../utils/logger');
const conferenceRealtimeService = require('./conferenceRealtimeService');
const conferenceService = require('./conferenceService');
const conferenceInterpretationHub = require('./conferenceInterpretationHub');

function isInterpretationEnabled(conf) {
  return Boolean(conf?.interpretation_enabled);
}

function pushInterpretLine(conferenceId, payload) {
  conferenceInterpretationHub.sendJsonToRole(conferenceId, 'primary', payload);
  conferenceInterpretationHub.sendJsonToRole(conferenceId, 'host', payload);
}

/**
 * Речь participant → строка перевода для редактора (без отдельной озвучки).
 */
async function handleParticipantUtterance(conferenceId, conf, originalText, _actorId, translatedText = null) {
  const text = String(originalText || '').trim();
  const translated = translatedText ? String(translatedText).trim() : '';
  if (!text && !translated) return;

  if (text || translated) {
    try {
      await conferenceRealtimeService.appendTranscript(
        conferenceId,
        text ? 'participant' : 'interpret_to_host',
        text || translated,
        { translatedText: text ? (translated || null) : null }
      );
    } catch (e) {
      logger.warn('[conferenceInterpretation] append participant:', e?.message || e);
    }
  }

  pushInterpretLine(conferenceId, {
    type: 'interpret_line',
    role: 'participant',
    original: text,
    translated: translated || null,
    target_lang: conf.host_language || 'ru'
  });
}

/**
 * Речь host → строка перевода для гостя (без отдельной озвучки).
 */
async function handleHostUtterance(conferenceId, conf, originalText, translatedText = null) {
  const text = String(originalText || '').trim();
  const translated = translatedText ? String(translatedText).trim() : '';
  if (!text && !translated) return;

  if (text || translated) {
    try {
      await conferenceRealtimeService.appendTranscript(
        conferenceId,
        text ? 'host' : 'interpret_to_primary',
        text || translated,
        { translatedText: text ? (translated || null) : null }
      );
    } catch (e) {
      logger.warn('[conferenceInterpretation] append host:', e?.message || e);
    }
  }

  pushInterpretLine(conferenceId, {
    type: 'interpret_line',
    role: 'host',
    original: text,
    translated: translated || null,
    target_lang: conf.guest_language || 'en'
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
