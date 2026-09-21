/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Распознавание речи синхрона: qwen3-asr-flash через chat.completions
 * (input_audio). Совместимый /audio/transcriptions у Qwen нет — не вызываем.
 */

const logger = require('../utils/logger');
const aiProviderSettingsService = require('./aiProviderSettingsService');

const QWEN_ASR_MODEL = 'qwen3-asr-flash';

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
  if (!settings?.api_key) {
    logger.warn('[conferenceInterpretationAsr] no qwencloud key');
    return '';
  }

  const wav = pcm16ToWav(pcmBuffer);
  const client = aiProviderSettingsService.createQwenCloudClient(settings);
  const dataUrl = `data:audio/wav;base64,${wav.toString('base64')}`;
  const lang = String(languageHint || '').slice(0, 2);

  try {
    const completion = await client.chat.completions.create({
      model: QWEN_ASR_MODEL,
      messages: [{
        role: 'user',
        content: [{ type: 'input_audio', input_audio: { data: dataUrl } }]
      }],
      max_tokens: 1024,
      temperature: 0
    });
    const text = String(completion?.choices?.[0]?.message?.content || '').trim();
    if (!text) {
      logger.warn(`[conferenceInterpretationAsr] empty lang=${lang}`);
    } else {
      logger.info(`[conferenceInterpretationAsr] chars=${text.length} lang=${lang}`);
    }
    return text;
  } catch (e) {
    logger.warn('[conferenceInterpretationAsr] failed:', e?.message || e);
    return '';
  }
}

module.exports = {
  pcm16ToWav,
  transcribePcm16Buffer,
  QWEN_ASR_MODEL
};
