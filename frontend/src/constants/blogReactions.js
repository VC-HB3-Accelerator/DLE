/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * API может хранить несколько типов реакций.
 * UI блога показывает только лайк (heart) + SVG-иконки IG/Telegram-стиля.
 */

export const BLOG_REACTION_TYPES = ['heart', 'fire', 'clap', 'idea', 'wow'];

/** @deprecated emoji UI removed — types kept for API / emptyReactionCounts */
export const BLOG_REACTIONS = [
  { type: 'heart', labelKey: 'blog.reactions.heart' },
  { type: 'fire', labelKey: 'blog.reactions.fire' },
  { type: 'clap', labelKey: 'blog.reactions.clap' },
  { type: 'idea', labelKey: 'blog.reactions.idea' },
  { type: 'wow', labelKey: 'blog.reactions.wow' },
];

export function emptyReactionCounts() {
  return Object.fromEntries(BLOG_REACTION_TYPES.map((t) => [t, 0]));
}
