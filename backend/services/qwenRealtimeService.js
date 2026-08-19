/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Qwen-Audio Realtime (Model Studio MaaS): WebSocket /api-ws/v1/realtime.
 * Не chat.completions — иначе 400 «url error».
 * docs: https://help.aliyun.com/en/model-studio/qwen-audio-realtime-user-guides
 */

const WebSocket = require('ws');
const logger = require('../utils/logger');

/** DashScope intl: HTTP Omni = `qwen3.5-omni-*`; WS = `*-realtime`. Старый MaaS `qwen-audio-3.0-realtime-plus` на новом ключе 404. */
const QWEN_AUDIO_REALTIME_MODEL = process.env.QWEN_AUDIO_REALTIME_MODEL || 'qwen3.5-omni-flash-realtime';
const DEFAULT_TIMEOUT_MS = 90000;

function isQwenRealtimeModelName(modelName) {
  const n = String(modelName || '').trim().toLowerCase();
  if (!n.startsWith('qwen')) return false;
  return n.includes('realtime');
}

/** Для трубки: разговорная Omni. Не перевод, не ASR, не TTS. */
function isVoiceCallRealtimeModel(modelName) {
  const n = String(modelName || '').trim().toLowerCase();
  if (!isQwenRealtimeModelName(n)) return false;
  if (!n.includes('omni')) return false;
  if (n.includes('livetranslate') || n.includes('asr') || n.includes('tts')) return false;
  return true;
}

/**
 * https://{workspace}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1
 * → wss://{workspace}.ap-southeast-1.maas.aliyuncs.com/api-ws/v1/realtime?model=…
 */
function realtimeWsUrlFromCompatibleBase(baseUrl, model) {
  const raw = String(baseUrl || '').trim();
  if (!raw) {
    const err = new Error('Qwen Cloud base_url не задан');
    err.code = 'QWEN_REALTIME_NO_BASE';
    throw err;
  }
  let u;
  try {
    u = new URL(raw);
  } catch (_) {
    const err = new Error('Qwen Cloud base_url некорректный');
    err.code = 'QWEN_REALTIME_BAD_BASE';
    throw err;
  }
  const modelQ = encodeURIComponent(String(model || QWEN_AUDIO_REALTIME_MODEL).trim());
  return `wss://${u.host}/api-ws/v1/realtime?model=${modelQ}`;
}

function pcm16leFromWav(wavBuf) {
  if (!Buffer.isBuffer(wavBuf) || wavBuf.length < 44) return null;
  if (wavBuf.toString('ascii', 0, 4) !== 'RIFF') return wavBuf;
  return wavBuf.subarray(44);
}

function extractEventText(event) {
  if (!event || typeof event !== 'object') return '';
  const t = String(event.type || '');
  if (t === 'response.audio_transcript.done' || t === 'response.output_audio_transcript.done') {
    return String(event.transcript || '');
  }
  if (t === 'response.text.done' || t === 'response.output_text.done') {
    return String(event.text || event.transcript || '');
  }
  if (t === 'response.text.delta' || t === 'response.output_text.delta' || t === 'response.audio_transcript.delta') {
    return String(event.delta || event.transcript || '');
  }
  const content = event.response?.output?.[0]?.content;
  if (Array.isArray(content)) {
    return content.map((c) => c.transcript || c.text || '').join('');
  }
  return '';
}

/**
 * Один ход Realtime: session.update (push-to-talk) → опционально PCM → input_text → response.create.
 * Ответ только текстом (без audio.delta), чтобы smoke не качал PCM.
 */
function askQwenRealtime({
  settings,
  model = QWEN_AUDIO_REALTIME_MODEL,
  instructions,
  userText,
  pcm16,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  WebSocketImpl = WebSocket
} = {}) {
  if (!settings?.api_key) {
    const err = new Error('Qwen Cloud API key не настроен');
    err.code = 'QWENCLOUD_KEY_MISSING';
    throw err;
  }
  const url = realtimeWsUrlFromCompatibleBase(settings.base_url, model);
  const prompt = String(userText || '').trim();
  if (!prompt && !pcm16) {
    const err = new Error('Пустой запрос в Qwen Realtime');
    err.code = 'QWEN_REALTIME_EMPTY';
    throw err;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let readySent = false;
    let acc = '';
    const events = [];

    const ws = new WebSocketImpl(url, {
      headers: {
        Authorization: `Bearer ${settings.api_key}`,
        'x-dashscope-dataInspection': 'disable'
      }
    });

    const finish = (err, text) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch (_) { /* ignore */ }
      if (err) {
        err.realtimeEvents = events.slice(-8);
        reject(err);
        return;
      }
      resolve(String(text || '').trim());
    };

    const timer = setTimeout(() => {
      const err = new Error(`Qwen Realtime timeout after ${timeoutMs}ms`);
      err.code = 'QWEN_REALTIME_TIMEOUT';
      finish(err);
    }, timeoutMs);

    const send = (obj) => {
      ws.send(JSON.stringify(obj));
    };

    const kickTurn = () => {
      if (readySent || settled) return;
      readySent = true;
      if (pcm16 && Buffer.isBuffer(pcm16) && pcm16.length >= 2) {
        send({
          type: 'input_audio_buffer.append',
          audio: pcm16.toString('base64')
        });
        send({ type: 'input_audio_buffer.commit' });
      }
      if (prompt) {
        send({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: prompt }]
          }
        });
      }
      send({
        type: 'response.create',
        response: {
          modalities: ['text'],
          max_output_tokens: 4096
        }
      });
    };

    ws.on('open', () => {
      send({
        type: 'session.update',
        session: {
          modalities: ['text'],
          instructions: String(instructions || '').trim() || undefined,
          turn_detection: null
        }
      });
    });

    ws.on('message', (raw) => {
      let event;
      try {
        event = JSON.parse(String(raw));
      } catch (_) {
        return;
      }
      const t = String(event.type || '');
      events.push(t);
      if (t === 'error') {
        const msg = event.error?.message || event.message || 'Qwen Realtime error';
        logger.warn(`[qwenRealtime] ${msg}`);
        const err = new Error(msg);
        err.code = 'QWEN_REALTIME_ERROR';
        finish(err);
        return;
      }
      if (t === 'session.updated' || t === 'session.created') {
        kickTurn();
      }
      const piece = extractEventText(event);
      if (piece && (t.endsWith('.delta'))) {
        acc += piece;
      } else if (piece && t.endsWith('.done') && !t.includes('delta')) {
        acc = piece || acc;
      }
      if (t === 'response.done') {
        finish(null, acc);
      }
    });

    ws.on('error', (err) => {
      const wrapped = new Error(err.message || 'Qwen Realtime WebSocket error');
      wrapped.code = 'QWEN_REALTIME_WS';
      finish(wrapped);
    });

    ws.on('close', () => {
      if (!settled) {
        const err = new Error('Qwen Realtime: соединение закрыто до response.done');
        err.code = 'QWEN_REALTIME_CLOSED';
        finish(err);
      }
    });
  });
}

module.exports = {
  QWEN_AUDIO_REALTIME_MODEL,
  isQwenRealtimeModelName,
  isVoiceCallRealtimeModel,
  realtimeWsUrlFromCompatibleBase,
  pcm16leFromWav,
  extractEventText,
  askQwenRealtime
};
