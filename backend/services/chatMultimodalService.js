/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Multimodal in/out для чата: parts + audio reply.
 * Whisper STT — fallback в ragService/whisperSttService (ключ Qwen Cloud).
 */

function loadShared(name) {
  try {
    return require(`/app/shared/${name}`);
  } catch (_) {
    return require(`../../shared/${name}`);
  }
}

const { resolveModelCapabilities } = loadShared('modelCapabilities');
const { ATTACHMENT_KINDS } = loadShared('mediaLimits');

function audioFormatFromMime(mimetype) {
  const mime = String(mimetype || '').toLowerCase();
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'mp4';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('webm')) return 'webm';
  return 'wav';
}

function buildUserContentParts({ promptText, media }) {
  const text = String(promptText || '').trim() || 'Пользователь прислал медиасообщение.';
  const parts = [{ type: 'text', text }];
  if (!media?.data) return { parts, used: false, reason: 'no_media' };

  const kind = media.kind;
  const b64 = Buffer.isBuffer(media.data) ? media.data.toString('base64') : null;
  if (!b64) return { parts, used: false, reason: 'no_buffer' };

  const caps = media.capabilities || resolveModelCapabilities(media.model);
  if ((kind === ATTACHMENT_KINDS.AUDIO) && caps.input.audio) {
    const format = audioFormatFromMime(media.mimetype);
    const modelName = String(media.model || '').toLowerCase();
    // DashScope Omni/Qwen-Audio: data URL. OpenAI audio: raw base64 + format.
    const qwenAudio = modelName.includes('omni') || modelName.includes('qwen-audio') || modelName.startsWith('qwen');
    parts.push({
      type: 'input_audio',
      input_audio: qwenAudio
        ? { data: `data:audio/${format};base64,${b64}` }
        : { data: b64, format }
    });
    return { parts, used: true, reason: 'audio_in' };
  }

  if ((kind === ATTACHMENT_KINDS.IMAGE) && caps.input.image) {
    parts.push({
      type: 'image_url',
      image_url: { url: `data:${media.mimetype || 'image/jpeg'};base64,${b64}` }
    });
    return { parts, used: true, reason: 'image_in' };
  }

  if ((kind === ATTACHMENT_KINDS.VIDEO || kind === ATTACHMENT_KINDS.VIDEO_NOTE) && caps.input.video) {
    parts.push({
      type: 'video_url',
      video_url: { url: `data:${media.mimetype || 'video/webm'};base64,${b64}` }
    });
    return { parts, used: true, reason: 'video_in' };
  }

  const label = kind === ATTACHMENT_KINDS.VIDEO_NOTE
    ? 'video_note'
    : (kind || 'file');
  parts[0].text = `${text}\n\n[Пользователь прислал ${label}]`;
  return { parts, used: false, reason: 'model_text_only' };
}

function extraPayloadForAudioOut(caps, incomingKind) {
  if (!caps?.output?.audio) return {};
  if (incomingKind === ATTACHMENT_KINDS.AUDIO && caps.input?.audio) {
    return {
      modalities: ['text', 'audio'],
      audio: { voice: 'alloy', format: 'wav' }
    };
  }
  if (incomingKind === ATTACHMENT_KINDS.VIDEO_NOTE && caps.input?.video) {
    return {
      modalities: ['text', 'audio'],
      audio: { voice: 'alloy', format: 'wav' }
    };
  }
  return {};
}

function extractAudioFromMessage(message) {
  const audio = message?.audio;
  if (!audio?.data) return null;
  const buf = Buffer.from(audio.data, 'base64');
  const format = String(audio.format || 'wav').toLowerCase();
  const mime = format === 'mp3' ? 'audio/mpeg' : (format === 'ogg' ? 'audio/ogg' : 'audio/wav');
  return {
    buffer: buf,
    mimetype: mime,
    kind: ATTACHMENT_KINDS.AUDIO,
    filename: `assistant-reply.${format === 'mp3' ? 'mp3' : 'wav'}`
  };
}

function fallbackGuestCopy() {
  return 'Сообщение принято. Напишите, пожалуйста, текстом — так я смогу ответить точнее.';
}

module.exports = {
  buildUserContentParts,
  extraPayloadForAudioOut,
  extractAudioFromMessage,
  fallbackGuestCopy,
  resolveModelCapabilities
};
