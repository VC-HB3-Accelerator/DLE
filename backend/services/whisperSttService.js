/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * STT fallback: text-only LLM + входящее audio / video_note.
 * Ключ — Qwen Cloud (DashScope). Сначала OpenAI-совместимый whisper-1,
 * если модели нет — qwen3-asr-flash. Не pull Ollama. Не ключ OpenAI.
 */

const OpenAI = require('openai');
const logger = require('../utils/logger');
const {
  getProviderSettings,
  createQwenCloudClient
} = require('./aiProviderSettingsService');

function loadShared(name) {
  try {
    return require(`/app/shared/${name}`);
  } catch (_) {
    return require(`../../shared/${name}`);
  }
}

const { ATTACHMENT_KINDS } = loadShared('mediaLimits');

const WHISPER_MODEL = 'whisper-1';
const QWEN_ASR_MODEL = 'qwen3-asr-flash';

function needsWhisperFallback({ used, media } = {}) {
  if (used) return false;
  if (!media?.data) return false;
  const kind = String(media.kind || '');
  return kind === ATTACHMENT_KINDS.AUDIO || kind === ATTACHMENT_KINDS.VIDEO_NOTE;
}

function audioFileName(media) {
  const name = String(media?.filename || '').trim();
  if (name && /\.[a-z0-9]{2,5}$/i.test(name)) return name;
  const mime = String(media?.mimetype || '').toLowerCase();
  if (mime.includes('ogg')) return 'voice.ogg';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'voice.mp3';
  if (mime.includes('wav')) return 'voice.wav';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'voice.m4a';
  return 'voice.webm';
}

function dataUrlFromMedia(media) {
  const mime = media.mimetype || 'application/octet-stream';
  return `data:${mime};base64,${media.data.toString('base64')}`;
}

async function transcribeViaWhisper1(client, media) {
  const file = await OpenAI.toFile(media.data, audioFileName(media), {
    type: media.mimetype || 'application/octet-stream'
  });
  const result = await client.audio.transcriptions.create({
    file,
    model: WHISPER_MODEL
  });
  return String(result?.text || '').trim();
}

async function transcribeViaQwenAsr(client, media) {
  const completion = await client.chat.completions.create({
    model: QWEN_ASR_MODEL,
    messages: [{
      role: 'user',
      content: [{
        type: 'input_audio',
        input_audio: { data: dataUrlFromMedia(media) }
      }]
    }],
    max_tokens: 1024,
    temperature: 0
  });
  return String(completion?.choices?.[0]?.message?.content || '').trim();
}

/**
 * @returns {Promise<{ text: string|null, reason: string, model?: string }>}
 */
async function transcribeMedia(media, deps = {}) {
  const buf = media?.data;
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 16) {
    return { text: null, reason: 'no_buffer' };
  }

  const loadSettings = deps.getProviderSettings || (() => getProviderSettings('qwencloud'));
  let settings;
  try {
    settings = await loadSettings();
  } catch (err) {
    logger.warn(`[Whisper] settings: ${err.message}`);
    return { text: null, reason: 'settings_error' };
  }
  if (!settings?.api_key) {
    return { text: null, reason: 'no_qwencloud_key' };
  }

  const makeClient = deps.createClient || ((s) => createQwenCloudClient(s));
  const client = makeClient(settings);

  try {
    const text = await transcribeViaWhisper1(client, media);
    if (text) return { text, reason: 'whisper_stt', model: WHISPER_MODEL };
  } catch (err) {
    logger.warn(`[Whisper] ${WHISPER_MODEL} via Qwen Cloud: ${err.message}`);
  }

  try {
    const text = await transcribeViaQwenAsr(client, media);
    if (!text) return { text: null, reason: 'empty_transcript', model: QWEN_ASR_MODEL };
    return { text, reason: 'whisper_stt', model: QWEN_ASR_MODEL };
  } catch (err) {
    logger.warn(`[Whisper] ${QWEN_ASR_MODEL} failed: ${err.message}`);
    return { text: null, reason: 'whisper_failed' };
  }
}

module.exports = {
  WHISPER_MODEL,
  QWEN_ASR_MODEL,
  needsWhisperFallback,
  audioFileName,
  transcribeMedia
};
