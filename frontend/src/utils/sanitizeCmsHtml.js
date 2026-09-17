/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Санитизация HTML CMS перед v-html (DOMPurify).
 */

import DOMPurify from 'dompurify';
import { isLocalCmsMediaUrl } from './cmsMediaUrl';

/** Разрешаем медиа Quill / CMS; остальное — дефолт DOMPurify (без script/on*). */
export const CMS_HTML_SANITIZE = {
  ADD_TAGS: ['video', 'source', 'img', 'iframe', 'pre', 'code'],
  ADD_ATTR: [
    'controls',
    'autoplay',
    'loop',
    'muted',
    'poster',
    'preload',
    'playsinline',
    'src',
    'alt',
    'title',
    'width',
    'height',
    'style',
    'class',
    'loading',
    'frameborder',
    'allowfullscreen',
    'allow',
  ],
  ALLOW_DATA_ATTR: true,
  KEEP_CONTENT: true,
};

/**
 * Quill часто кладёт локальное видео в iframe — для /api/v|uploads нужен <video>.
 */
function rewriteLocalVideoIframes(html) {
  return String(html || '').replace(
    /<iframe([^>]*?)src=["']([^"']+)["']([^>]*?)><\/iframe>/gi,
    (match, _attrs1, url) => {
      if (isLocalCmsMediaUrl(url)) {
        return `<video controls class="ql-video" style="max-width: 100%; width: 100%; height: auto; min-height: 400px; border-radius: 8px; margin: 1.5rem 0; display: block;" src="${url}"></video>`;
      }
      return match;
    }
  );
}

/**
 * @param {string} content
 * @param {{ config?: object }} [opts]
 * @returns {string}
 */
export function sanitizeCmsHtml(content, opts = {}) {
  if (!content || typeof content !== 'string') return '';
  const config = opts.config || CMS_HTML_SANITIZE;
  // Сначала iframe→video для локальных URL, затем DOMPurify (один проход).
  return DOMPurify.sanitize(rewriteLocalVideoIframes(content), config);
}
