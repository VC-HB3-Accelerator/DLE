/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Озвучка перевода: qwen-audio-3.0-tts-plus (HTTP), иначе Omni realtime
 * той же модели, что уже живёт у конференции.
 */

const axios = require('axios');
const WebSocket = require('ws');
const logger = require('../utils/logger');
const {
  realtimeWsUrlFromCompatibleBase,
  pcm16leFromWav,
  isQwenRealtimeModelName,
  QWEN_AUDIO_REALTIME_MODEL
} = require('./qwenRealtimeService');
const hub = require('./conferenceInterpretationHub');

const TTS_HTTP_MODEL = 'qwen-audio-3.0-tts-plus';
const TTS_VOICE = 'longanlingxin';

function extractAudioB64(event) {
  if (!event || typeof event !== 'object') return '';
  if (event.delta && (event.type === 'response.audio.delta' || event.type === 'response.output_audio.delta')) {
    return String(event.delta);
  }
  return '';
}

function dashscopeOrigin(baseUrl) {
  try {
    return new URL(String(baseUrl || '')).origin;
  } catch (_) {
    return 'https://dashscope-intl.aliyuncs.com';
  }
}

function sendPcm(conferenceId, targetRole, pcmB64, language) {
  if (!pcmB64) return false;
  return hub.sendJsonToRole(conferenceId, targetRole, {
    type: 'interpret_audio',
    pcm: pcmB64,
    language
  });
}

function sendFile(conferenceId, targetRole, b64, mime, language) {
  if (!b64) return false;
  return hub.sendJsonToRole(conferenceId, targetRole, {
    type: 'interpret_audio_file',
    data: b64,
    mime: mime || 'audio/mpeg',
    language
  });
}

async function synthesizeHttp(providerSettings, text, language) {
  const origin = dashscopeOrigin(providerSettings.base_url);
  const url = `${origin}/api/v1/services/audio/tts/SpeechSynthesizer`;
  const lang = String(language || 'en').slice(0, 2);
  const { data } = await axios.post(
    url,
    {
      model: TTS_HTTP_MODEL,
      input: {
        text,
        voice: TTS_VOICE,
        format: 'pcm',
        sample_rate: 24000,
        language_hints: [lang]
      }
    },
    {
      headers: {
        Authorization: `Bearer ${providerSettings.api_key}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );
  const audio = data?.output?.audio || {};
  if (audio.data) {
    return { pcm: audio.data };
  }
  if (audio.url) {
    const file = await axios.get(audio.url, { responseType: 'arraybuffer', timeout: 20000 });
    const buf = Buffer.from(file.data);
    const pcm = pcm16leFromWav(buf);
    if (pcm && pcm !== buf) {
      return { pcm: pcm.toString('base64') };
    }
    const mime = String(file.headers?.['content-type'] || 'audio/wav');
    return { file: buf.toString('base64'), mime };
  }
  throw new Error('TTS HTTP: пустой ответ');
}

function resolveRealtimeModel(providerSettings, model) {
  if (isQwenRealtimeModelName(model)) return model;
  if (isQwenRealtimeModelName(providerSettings.selected_model)) {
    return providerSettings.selected_model;
  }
  return QWEN_AUDIO_REALTIME_MODEL;
}

async function synthesizeRealtime(providerSettings, phrase, language, model, onPcm) {
  const realtimeModel = resolveRealtimeModel(providerSettings, model);
  const url = realtimeWsUrlFromCompatibleBase(providerSettings.base_url, realtimeModel);
  logger.info(`[conferenceInterpretationTts] omni model=${realtimeModel}`);

  return new Promise((resolve, reject) => {
    let settled = false;
    let chunks = 0;
    let kicked = false;
    const upstream = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${providerSettings.api_key}`,
        'x-dashscope-dataInspection': 'disable'
      }
    });

    const done = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        upstream.close();
      } catch (_) {
        /* ignore */
      }
      if (err) reject(err);
      else resolve({ chunks });
    };

    const timer = setTimeout(() => {
      done(chunks ? null : new Error('TTS realtime timeout'));
    }, 25000);

    const kick = () => {
      if (kicked || settled) return;
      kicked = true;
      upstream.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: phrase }]
        }
      }));
      upstream.send(JSON.stringify({
        type: 'response.create',
        response: { modalities: ['audio', 'text'] }
      }));
    };

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
          turn_detection: null
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
      if (t === 'error') {
        done(new Error(event.error?.message || event.message || 'TTS realtime error'));
        return;
      }
      if (t === 'session.updated' || t === 'session.created') {
        kick();
      }
      const audio = extractAudioB64(event);
      if (audio) {
        chunks += 1;
        onPcm(audio);
      }
      if (t === 'response.done') {
        done(chunks ? null : new Error('TTS realtime: нет звука'));
      }
    });

    upstream.on('error', (err) => done(err));
    upstream.on('close', () => {
      if (!settled) done(chunks ? null : new Error('TTS realtime closed'));
    });
  });
}

/**
 * Озвучить перевод и отдать PCM/файл на primary или host.
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

  try {
    const http = await synthesizeHttp(providerSettings, phrase, language);
    if (http.pcm) {
      const ok = sendPcm(conferenceId, targetRole, http.pcm, language);
      logger.info(`[conferenceInterpretationTts] http pcm to=${targetRole} sent=${ok}`);
      return;
    }
    if (http.file) {
      const ok = sendFile(conferenceId, targetRole, http.file, http.mime, language);
      logger.info(`[conferenceInterpretationTts] http file to=${targetRole} sent=${ok}`);
      return;
    }
  } catch (e) {
    logger.warn('[conferenceInterpretationTts] http:', e?.message || e);
  }

  try {
    const result = await synthesizeRealtime(
      providerSettings,
      phrase,
      language,
      model,
      (audio) => sendPcm(conferenceId, targetRole, audio, language)
    );
    logger.info(`[conferenceInterpretationTts] omni chunks=${result.chunks} to=${targetRole}`);
  } catch (e) {
    logger.warn('[conferenceInterpretationTts] omni:', e?.message || e);
  }
}

module.exports = {
  streamTranslationSpeech
};
