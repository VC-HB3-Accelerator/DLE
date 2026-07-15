/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

export const BLOG_REACTION_TYPES = ['heart', 'fire', 'clap', 'idea', 'wow'];

export const BLOG_REACTIONS = [
  { type: 'heart', emoji: '❤️', labelKey: 'blog.reactions.heart' },
  { type: 'fire', emoji: '🔥', labelKey: 'blog.reactions.fire' },
  { type: 'clap', emoji: '👏', labelKey: 'blog.reactions.clap' },
  { type: 'idea', emoji: '💡', labelKey: 'blog.reactions.idea' },
  { type: 'wow', emoji: '😮', labelKey: 'blog.reactions.wow' },
];

export function emptyReactionCounts() {
  return Object.fromEntries(BLOG_REACTION_TYPES.map((t) => [t, 0]));
}
