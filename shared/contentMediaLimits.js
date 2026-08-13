/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Лимиты медиа CMS (статьи/блог). Чат это не читает.
 * SoT: docs.ru/back-docs/TZ_CONTENT_MEDIA_CHUNKED_UPLOAD.ru.md
 */

const PART_SIZE = 8 * 1024 * 1024;
const MAX_PARALLEL_PARTS = 3;
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_PARTS = Math.ceil(MAX_VIDEO_BYTES / PART_SIZE);
const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const PUBLIC_ID_LENGTH = 8;
const PUBLIC_ID_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';

const IMAGE_MIME_RE = /^image\/(png|jpe?g|gif|webp|svg\+xml|svg)$/i;
const VIDEO_MIME_RE = /^video\/(mp4|webm|ogg|quicktime|x-msvideo|avi)$/i;
const AUDIO_MIME_RE = /^audio\/(mp3|mpeg|wav|ogg|webm|mp4|m4a|aac|x-m4a|x-wav)$/i;

function classifyMime(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (IMAGE_MIME_RE.test(mime) || mime.startsWith('image/')) {
    if (IMAGE_MIME_RE.test(mime) || /^image\/(png|jpe?g|gif|webp|svg)/i.test(mime)) {
      return 'image';
    }
  }
  if (VIDEO_MIME_RE.test(mime) || /^video\/(mp4|webm|ogg|quicktime|x-msvideo)/i.test(mime)) {
    return 'video';
  }
  if (AUDIO_MIME_RE.test(mime) || mime.startsWith('audio/')) {
    if (AUDIO_MIME_RE.test(mime) || /^audio\//i.test(mime)) {
      return 'audio';
    }
  }
  return null;
}

function isAllowedCmsMime(mimeType, originalName = '') {
  const kind = classifyMime(mimeType);
  if (kind) return kind;
  const name = String(originalName || '').toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return 'image';
  if (/\.(mp4|webm|ogg|mov|avi)$/i.test(name)) return 'video';
  if (/\.(mp3|mpeg|wav|ogg|m4a|aac)$/i.test(name)) return 'audio';
  return null;
}

function maxBytesForKind(kind) {
  if (kind === 'image') return MAX_IMAGE_BYTES;
  if (kind === 'video') return MAX_VIDEO_BYTES;
  if (kind === 'audio') return MAX_AUDIO_BYTES;
  return 0;
}

function shouldUseChunked(kind, size) {
  const bytes = Number(size) || 0;
  if (!kind || bytes <= 0) return false;
  if (bytes > maxBytesForKind(kind)) return false;
  return kind === 'video' || bytes > PART_SIZE;
}

module.exports = {
  PART_SIZE,
  MAX_PARALLEL_PARTS,
  MAX_VIDEO_BYTES,
  MAX_IMAGE_BYTES,
  MAX_AUDIO_BYTES,
  MAX_PARTS,
  UPLOAD_TTL_MS,
  PUBLIC_ID_LENGTH,
  PUBLIC_ID_ALPHABET,
  IMAGE_MIME_RE,
  VIDEO_MIME_RE,
  AUDIO_MIME_RE,
  classifyMime,
  isAllowedCmsMime,
  maxBytesForKind,
  shouldUseChunked,
};
