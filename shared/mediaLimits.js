/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Лимиты медиа чата. SoT: docs.ru/back-docs/TZ_CHAT_AUDIO_VIDEO_MULTIMODAL.ru.md
 */

const MEDIA_MAX_BYTES = 20 * 1024 * 1024;
const VIDEO_NOTE_MAX_SECONDS = 60;
const AUDIO_MAX_SECONDS = 120;

const ATTACHMENT_KINDS = Object.freeze({
  AUDIO: 'audio',
  VIDEO: 'video',
  VIDEO_NOTE: 'video_note',
  IMAGE: 'image',
  DOCUMENT: 'document'
});

function sniffMimeFromBuffer(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 4) return null;

  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return 'image/png';
  }
  // JPEG
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return 'image/jpeg';
  }
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return 'image/gif';
  }
  // WEBP / WAV share RIFF
  if (
    buf.length >= 12
    && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
  ) {
    if (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
      return 'image/webp';
    }
    if (buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45) {
      return 'audio/wav';
    }
  }
  // WebM / Matroska (часто audio/webm из MediaRecorder)
  if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) {
    return 'video/webm';
  }
  // MP4 / ISO BMFF (….ftyp)
  if (
    buf.length >= 8
    && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70
  ) {
    return 'video/mp4';
  }
  // Ogg
  if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
    return 'audio/ogg';
  }
  // MP3 ID3
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    return 'audio/mpeg';
  }
  // MP3 frame sync
  if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) {
    return 'audio/mpeg';
  }
  return null;
}

function detectAttachmentKind({ filename = '', mimetype = '', hint = '' } = {}) {
  const mime = String(mimetype || '').toLowerCase();
  const name = String(filename || '').toLowerCase();
  const hinted = String(hint || '').trim().toLowerCase();

  // Кружок: hint или имя video-note-*.webm (в истории kind часто теряется, остаётся video/webm)
  const looksLikeVideoNote = hinted === ATTACHMENT_KINDS.VIDEO_NOTE || name.startsWith('video-note');
  if (looksLikeVideoNote && (mime.startsWith('video/') || /\.(webm|mp4)$/i.test(name))) {
    return ATTACHMENT_KINDS.VIDEO_NOTE;
  }

  // Голосовое: hint или имя audio-* (часто video/webm из MediaRecorder)
  const looksLikeAudio = hinted === ATTACHMENT_KINDS.AUDIO
    || /^audio[-_]/.test(name)
    || /^voice-call[-_]/.test(name);
  if (looksLikeAudio && (
    mime.startsWith('audio/')
    || mime === 'video/webm'
    || /\.(webm|ogg|mp3|wav|m4a|aac)$/i.test(name)
  )) {
    return ATTACHMENT_KINDS.AUDIO;
  }

  if (mime.startsWith('audio/')) return ATTACHMENT_KINDS.AUDIO;
  if (mime.startsWith('video/')) return ATTACHMENT_KINDS.VIDEO;
  if (mime.startsWith('image/')) return ATTACHMENT_KINDS.IMAGE;

  if (/\.(mp3|wav|m4a|aac|flac|wma)$/i.test(name)) return ATTACHMENT_KINDS.AUDIO;
  if (/\.(mp4|webm|ogg|mov|avi)$/i.test(name)) return ATTACHMENT_KINDS.VIDEO;
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return ATTACHMENT_KINDS.IMAGE;
  return ATTACHMENT_KINDS.DOCUMENT;
}

function mediaPlaceholder(kind) {
  switch (kind) {
    case ATTACHMENT_KINDS.VIDEO_NOTE:
      return '[video_note]';
    case ATTACHMENT_KINDS.VIDEO:
      return '[video]';
    case ATTACHMENT_KINDS.AUDIO:
      return '[audio]';
    case ATTACHMENT_KINDS.IMAGE:
      return '[image]';
    default:
      return '[file]';
  }
}

function mediaRagQuery(kind, userText) {
  const text = String(userText || '').trim();
  if (text && !/^\[(audio|video|video_note|image|file)\]$/i.test(text)) return text;
  if (kind === ATTACHMENT_KINDS.AUDIO) return 'аудиосообщение пользователя';
  if (kind === ATTACHMENT_KINDS.VIDEO_NOTE || kind === ATTACHMENT_KINDS.VIDEO) {
    return 'видеосообщение пользователя';
  }
  return 'вложение пользователя';
}

function isMediaTooLarge(size) {
  return Number(size) > MEDIA_MAX_BYTES;
}

module.exports = {
  MEDIA_MAX_BYTES,
  VIDEO_NOTE_MAX_SECONDS,
  AUDIO_MAX_SECONDS,
  ATTACHMENT_KINDS,
  sniffMimeFromBuffer,
  detectAttachmentKind,
  mediaPlaceholder,
  mediaRagQuery,
  isMediaTooLarge
};
