/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Лимиты медиа чата (копия shared/mediaLimits.js для Vite).
 */

export const MEDIA_MAX_BYTES = 20 * 1024 * 1024;
export const VIDEO_NOTE_MAX_SECONDS = 60;
export const AUDIO_MAX_SECONDS = 120;

export const ATTACHMENT_KINDS = Object.freeze({
  AUDIO: 'audio',
  VIDEO: 'video',
  VIDEO_NOTE: 'video_note',
  IMAGE: 'image',
  DOCUMENT: 'document'
});

export function detectAttachmentKind({ filename = '', mimetype = '', hint = '' } = {}) {
  const mime = String(mimetype || '').toLowerCase();
  const name = String(filename || '').toLowerCase();
  const hinted = String(hint || '').trim().toLowerCase();

  const looksLikeVideoNote = hinted === ATTACHMENT_KINDS.VIDEO_NOTE || name.startsWith('video-note');
  if (looksLikeVideoNote && (mime.startsWith('video/') || /\.(webm|mp4)$/i.test(name))) {
    return ATTACHMENT_KINDS.VIDEO_NOTE;
  }

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

export function isMediaTooLarge(size) {
  return Number(size) > MEDIA_MAX_BYTES;
}
