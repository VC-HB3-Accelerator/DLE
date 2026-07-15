/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Общий набор эмодзи-реакций блога (backend + синхрон с frontend).
 */

const BLOG_REACTION_TYPES = ['heart', 'fire', 'clap', 'idea', 'wow'];

const BLOG_REACTIONS = [
  { type: 'heart', emoji: '❤️' },
  { type: 'fire', emoji: '🔥' },
  { type: 'clap', emoji: '👏' },
  { type: 'idea', emoji: '💡' },
  { type: 'wow', emoji: '😮' },
];

function emptyReactionCounts() {
  return Object.fromEntries(BLOG_REACTION_TYPES.map((t) => [t, 0]));
}

function normalizeReactionType(type) {
  if (type === 'like') return 'heart';
  if (BLOG_REACTION_TYPES.includes(type)) return type;
  return null;
}

module.exports = {
  BLOG_REACTION_TYPES,
  BLOG_REACTIONS,
  emptyReactionCounts,
  normalizeReactionType,
};
