/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Очередь речи абонента, пока агент ещё говорит или играет TTS.
 * Несколько фраз за время одной реплики агента — один ход: склейка burst'ов
 * с паузой короче server_vad, чтобы Omni не отвечал на каждое предложение.
 */

const MAX_QUEUED_BYTES = 16000 * 2 * 10;
const SILENCE_RMS = 400;
const PLAYING_RMS = 1100;
const PCM_RATE = 16000;
const SILENCE_GAP_MS = 250;

function pcmRms(b64) {
  const buf = Buffer.from(String(b64 || ''), 'base64');
  const n = Math.floor(buf.length / 2);
  if (n < 8) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const s = buf.readInt16LE(i * 2);
    sum += s * s;
  }
  return Math.sqrt(sum / n);
}

function shouldQueuePcm(b64, { agentSpeaking = false } = {}) {
  const min = agentSpeaking ? PLAYING_RMS : SILENCE_RMS;
  return pcmRms(b64) >= min;
}

function shouldHoldMic({ responseOpen = false, playing = false } = {}) {
  return Boolean(responseOpen || playing);
}

function silencePcmB64(ms) {
  const samples = Math.max(0, Math.round((PCM_RATE * Number(ms || 0)) / 1000));
  return Buffer.alloc(samples * 2).toString('base64');
}

function burstBytes(burst) {
  let n = 0;
  for (const chunk of burst) n += Buffer.from(chunk, 'base64').length;
  return n;
}

function createBargeQueue() {
  const bursts = [];
  let current = [];
  let bytes = 0;

  const closeBurst = () => {
    if (!current.length) return;
    bursts.push(current);
    current = [];
  };

  const dropOldest = () => {
    if (bursts.length) {
      bytes -= burstBytes(bursts.shift());
      return;
    }
    if (current.length) {
      bytes -= Buffer.from(current.shift(), 'base64').length;
    }
  };

  return {
    push(b64) {
      const raw = String(b64 || '');
      if (!raw) return;
      bytes += Buffer.from(raw, 'base64').length;
      current.push(raw);
      while (bytes > MAX_QUEUED_BYTES && (bursts.length || current.length > 1)) dropOldest();
    },
    closeBurst,
    clear() {
      bursts.length = 0;
      current = [];
      bytes = 0;
    },
    drainStitched() {
      closeBurst();
      const chunks = [];
      bursts.forEach((burst, idx) => {
        if (idx > 0) chunks.push(silencePcmB64(SILENCE_GAP_MS));
        chunks.push(...burst);
      });
      const burstCount = bursts.length;
      bursts.length = 0;
      current = [];
      bytes = 0;
      return { chunks, burstCount };
    },
    get chunkCount() {
      return bursts.reduce((n, burst) => n + burst.length, 0) + current.length;
    },
    get burstCount() {
      return bursts.length + (current.length ? 1 : 0);
    },
    get byteLength() {
      return bytes;
    }
  };
}

function flushAppendEvents(chunks) {
  return (chunks || []).map((audio) => ({
    type: 'input_audio_buffer.append',
    audio
  }));
}

function routeClientAudio(queue, { pcm, responseOpen, playing }) {
  const hold = shouldHoldMic({ responseOpen, playing });
  if (hold) {
    if (shouldQueuePcm(pcm, { agentSpeaking: true })) queue.push(pcm);
    else queue.closeBurst();
    return { action: 'hold', flush: [], burstCount: 0 };
  }
  const { chunks, burstCount } = queue.drainStitched();
  return { action: 'forward', flush: chunks, burstCount, pcm };
}

module.exports = {
  MAX_QUEUED_BYTES,
  SILENCE_RMS,
  PLAYING_RMS,
  SILENCE_GAP_MS,
  pcmRms,
  shouldQueuePcm,
  shouldHoldMic,
  silencePcmB64,
  createBargeQueue,
  flushAppendEvents,
  routeClientAudio
};
