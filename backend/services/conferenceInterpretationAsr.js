/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * ASR для буфера PCM 16 kHz (речь host в режиме синхрона).
 */

const OpenAI = require('openai');
const logger = require('../utils/logger');
const aiProviderSettingsService = require('./aiProviderSettingsService');

function pcm16ToWav(pcmBuffer, sampleRate = 16000) {
  const data = Buffer.isBuffer(pcmBuffer) ? pcmBuffer : Buffer.from(pcmBuffer);
  const header = Buffer.alloc(44);
  const dataLen = data.length;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLen, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLen, 40);
  return Buffer.concat([header, data]);
}

async function transcribePcm16Buffer(pcmBuffer, { languageHint = 'ru' } = {}) {
  const settings = await aiProviderSettingsService.getProviderSettings('qwencloud');
  if (!settings?.api_key) return '';

  const wav = pcm16ToWav(pcmBuffer);
  const baseUrl = String(settings.base_url || '').replace(/\/$/, '');
  const client = new OpenAI({
    apiKey: settings.api_key,
    baseURL: baseUrl || undefined
  });

  try {
    const file = await OpenAI.toFile(wav, 'utterance.wav', { type: 'audio/wav' });
    const result = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: String(languageHint || '').slice(0, 2) || undefined
    });
    return String(result?.text || '').trim();
  } catch (e) {
    logger.warn('[conferenceInterpretationAsr] whisper failed:', e?.message || e);
    try {
      const dataUrl = `data:audio/wav;base64,${wav.toString('base64')}`;
      const completion = await client.chat.completions.create({
        model: 'qwen3-asr-flash',
        messages: [{
          role: 'user',
          content: [{ type: 'input_audio', input_audio: { data: dataUrl } }]
        }],
        max_tokens: 1024,
        temperature: 0
      });
      return String(completion?.choices?.[0]?.message?.content || '').trim();
    } catch (e2) {
      logger.warn('[conferenceInterpretationAsr] qwen asr failed:', e2?.message || e2);
      return '';
    }
  }
}

module.exports = {
  pcm16ToWav,
  transcribePcm16Buffer
};
