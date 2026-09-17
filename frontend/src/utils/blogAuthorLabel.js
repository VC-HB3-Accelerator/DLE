/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 * Публичная подпись автора в блоге: id12, без «User» и «#».
 */

const AVATAR_COLORS = [
  '#e11d48',
  '#d97706',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#0f766e',
  '#4f46e5',
];

export function blogAuthorLabel(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return '';
  return `id${id}`;
}

export function blogAuthorIdFromName(name) {
  const raw = String(name || '').trim();
  const fromId = raw.match(/^id(\d+)$/i);
  if (fromId) return Number(fromId[1]);
  const fromUserHash = raw.match(/^User\s*#(\d+)$/i);
  if (fromUserHash) return Number(fromUserHash[1]);
  const fromHash = raw.match(/^#(\d+)$/);
  if (fromHash) return Number(fromHash[1]);
  return null;
}

export function blogAuthorAvatarColor(userId) {
  const id = Math.abs(Number(userId) || 0);
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

export function formatBlogAuthorName(name) {
  const raw = String(name || '').trim();
  const fromUserHash = raw.match(/^User\s*#(\d+)$/i);
  if (fromUserHash) return `id${fromUserHash[1]}`;
  const fromHash = raw.match(/^#(\d+)$/);
  if (fromHash) return `id${fromHash[1]}`;
  return raw;
}
