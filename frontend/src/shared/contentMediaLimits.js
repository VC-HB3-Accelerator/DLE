/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Лимиты медиа CMS (копия shared/contentMediaLimits.js для Vite).
 * Чат это не читает.
 */

export const PART_SIZE = 8 * 1024 * 1024;
export const MAX_PARALLEL_PARTS = 3;
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export const MAX_PARTS = Math.ceil(MAX_VIDEO_BYTES / PART_SIZE);
export const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
export const PUBLIC_ID_LENGTH = 8;
export const PUBLIC_ID_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';

export function classifyMime(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (/^image\/(png|jpe?g|gif|webp|svg)/i.test(mime) || mime.startsWith('image/')) return 'image';
  if (/^video\/(mp4|webm|ogg|quicktime|x-msvideo|avi)/i.test(mime) || mime.startsWith('video/')) return 'video';
  if (/^audio\//i.test(mime)) return 'audio';
  return null;
}

export function maxBytesForKind(kind) {
  if (kind === 'image') return MAX_IMAGE_BYTES;
  if (kind === 'video') return MAX_VIDEO_BYTES;
  if (kind === 'audio') return MAX_AUDIO_BYTES;
  return 0;
}

export function shouldUseChunked(kind, size) {
  const bytes = Number(size) || 0;
  if (!kind || bytes <= 0) return false;
  if (bytes > maxBytesForKind(kind)) return false;
  return kind === 'video' || bytes > PART_SIZE;
}
