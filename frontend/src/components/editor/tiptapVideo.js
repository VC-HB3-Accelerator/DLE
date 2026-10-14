/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Блок <video> / iframe (не YouTube) для TipTap. HTML совместим с старым Quill.
 */

import { Node, mergeAttributes } from '@tiptap/core';

function isYoutubeSrc(src) {
  return /youtu\.?be/i.test(String(src || ''));
}

function isFileVideoSrc(src) {
  return /\.(mp4|webm|ogg|ogv|mov)(\?|#|$)/i.test(String(src || ''));
}

export const TiptapVideo = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      embed: { default: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'video',
        getAttrs: (el) => ({
          src: el.getAttribute('src'),
          embed: false,
        }),
      },
      {
        tag: 'iframe',
        getAttrs: (el) => {
          const src = el.getAttribute('src') || '';
          if (!src || isYoutubeSrc(src)) return false;
          return { src, embed: !isFileVideoSrc(src) };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const src = HTMLAttributes.src || '';
    const embed = HTMLAttributes.embed || (!isFileVideoSrc(src) && /^https?:/i.test(src) && !src.startsWith('/') && !isYoutubeSrc(src));
    if (embed) {
      return [
        'iframe',
        mergeAttributes(HTMLAttributes, {
          class: 'rte-video',
          frameborder: '0',
          allowfullscreen: 'true',
          embed: undefined,
        }),
      ];
    }
    return [
      'video',
      mergeAttributes(HTMLAttributes, {
        controls: 'true',
        class: 'rte-video',
        embed: undefined,
      }),
    ];
  },

  addCommands() {
    return {
      setVideo: (attrs) => ({ commands }) => commands.insertContent({
        type: this.name,
        attrs: {
          src: attrs?.src || null,
          embed: Boolean(attrs?.embed),
        },
      }),
    };
  },
});

export function isYoutubeUrl(url) {
  return isYoutubeSrc(url);
}
