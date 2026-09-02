/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Копия shared/chatRoleCaps.js для Vite.
 */

export const CHAT_CAP_KEYS = Object.freeze([
  'send_text',
  'send_file',
  'send_video',
  'send_audio',
  'send_call'
]);

export const CHAT_CAP_ROLES = Object.freeze(['guest', 'user', 'readonly', 'editor']);

export const DEFAULT_CHAT_CAPS = Object.freeze({
  send_text: true,
  send_file: true,
  send_video: true,
  send_audio: true,
  send_call: true
});

export function cloneDefaultCaps() {
  return { ...DEFAULT_CHAT_CAPS };
}

export function roleKeyForChatCaps(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'user') return 'user';
  if (r === 'readonly') return 'readonly';
  if (r === 'editor') return 'editor';
  return 'guest';
}
