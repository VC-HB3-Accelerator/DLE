/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Одноразовая озвучка перевода через Qwen Realtime (PCM → клиент).
 */

const WebSocket = require('ws');
const logger = require('../utils/logger');
const {
  realtimeWsUrlFromCompatibleBase,
  QWEN_AUDIO_REALTIME_MODEL
} = require('./qwenRealtimeService');
const hub = require('./conferenceInterpretationHub');

function extractAudioB64(event) {
  if (!event || typeof event !== 'object') return '';
  if (event.delta && (event.type === 'response.audio.delta' || event.type === 'response.output_audio.delta')) {
    return String(event.delta);
  }
  return '';
}

/**
 * Озвучить перевод и стримить PCM на primary или host.
 */
async function streamTranslationSpeech({
  conferenceId,
  targetRole,
  text,
  language,
  providerSettings,
  model
}) {
  const phrase = String(text || '').trim();
  if (!phrase) return;

  const url = realtimeWsUrlFromCompatibleBase(
    providerSettings.base_url,
    model || providerSettings.selected_model || QWEN_AUDIO_REALTIME_MODEL
  );

  await new Promise((resolve, reject) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const upstream = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${providerSettings.api_key}`,
        'x-dashscope-dataInspection': 'disable'
      }
    });

    const timer = setTimeout(() => {
      try {
        upstream.close();
      } catch (_) {
        /* ignore */
      }
      done();
    }, 45000);

    upstream.on('open', () => {
      upstream.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['audio', 'text'],
          instructions:
            `You are a simultaneous interpreter. Speak ONLY the following phrase in ${language}. ` +
            'Do not add greetings or explanations.',
          input_audio_format: 'pcm',
          output_audio_format: 'pcm',
          turn_detection: { type: 'server_vad', silence_duration_ms: 1200 }
        }
      }));
    });

    upstream.on('message', (raw) => {
      let event;
      try {
        event = JSON.parse(String(raw));
      } catch (_) {
        return;
      }
      const t = String(event.type || '');

      if (t === 'session.updated') {
        upstream.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: phrase }]
          }
        }));
        upstream.send(JSON.stringify({ type: 'response.create' }));
      }

      const audio = extractAudioB64(event);
      if (audio) {
        hub.sendJsonToRole(conferenceId, targetRole, {
          type: 'interpret_audio',
          pcm: audio,
          language
        });
      }

      if (t === 'response.done' || t === 'error') {
        clearTimeout(timer);
        try {
          upstream.close();
        } catch (_) {
          /* ignore */
        }
        done();
      }
    });

    upstream.on('error', (err) => {
      logger.warn('[conferenceInterpretationTts]', err.message);
      clearTimeout(timer);
      fail(err);
    });

    upstream.on('close', () => {
      clearTimeout(timer);
      done();
    });
  }).catch((e) => {
    logger.warn('[conferenceInterpretationTts] stream failed:', e?.message || e);
  });
}

module.exports = {
  streamTranslationSpeech
};
