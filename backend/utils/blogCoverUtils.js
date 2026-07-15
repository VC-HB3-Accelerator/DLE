/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Обложки блога из HTML контента Quill-редактора (/content/create):
 * - изображения: <img src="/api/uploads/media/{id}/file">
 * - видео: <div class="video-wrapper"><video src=".../api/uploads/media/{id}/file">
 * - legacy: <iframe class="ql-video" src=".../api/uploads/media/{id}/file">
 */

const UPLOAD_MEDIA_RE = /\/api\/uploads\/media\/\d+\/file/i;

function normalizeCoverUrl(src) {
  if (!src || typeof src !== 'string') return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}

function isUploadMediaUrl(url) {
  return UPLOAD_MEDIA_RE.test(url || '');
}

function isInsideVideoWrapper(content, index) {
  const before = content.slice(Math.max(0, index - 800), index);
  const lastWrapper = before.lastIndexOf('video-wrapper');
  if (lastWrapper === -1) return false;
  const afterWrapper = before.slice(lastWrapper);
  return !afterWrapper.includes('</div>');
}

/**
 * Собирает все медиа-кандидаты с позицией в HTML (первый по тексту = обложка).
 */
function collectMediaCandidates(content) {
  const candidates = [];

  const videoWrapperRe = /<div[^>]*class="[^"]*video-wrapper[^"]*"[^>]*>[\s\S]*?<video[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = videoWrapperRe.exec(content)) !== null) {
    const src = normalizeCoverUrl(match[1]);
    if (src) {
      candidates.push({ index: match.index, cover_url: src, cover_type: 'video' });
    }
  }

  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
  while ((match = imgRe.exec(content)) !== null) {
    const src = normalizeCoverUrl(match[1]);
    if (src) {
      candidates.push({ index: match.index, cover_url: src, cover_type: 'image' });
    }
  }

  const videoRe = /<video[^>]+src=["']([^"']+)["']/gi;
  while ((match = videoRe.exec(content)) !== null) {
    if (isInsideVideoWrapper(content, match.index)) continue;
    const src = normalizeCoverUrl(match[1]);
    if (src) {
      candidates.push({
        index: match.index,
        cover_url: src,
        cover_type: 'video',
      });
    }
  }

  const iframeRe = /<iframe[^>]+src=["']([^"']+)["']/gi;
  while ((match = iframeRe.exec(content)) !== null) {
    const src = normalizeCoverUrl(match[1]);
    if (src && isUploadMediaUrl(src)) {
      candidates.push({ index: match.index, cover_url: src, cover_type: 'video' });
    }
  }

  return candidates.sort((a, b) => a.index - b.index);
}

/**
 * Извлекает обложку из HTML контента статьи.
 * @returns {{ cover_url: string|null, cover_type: 'image'|'video'|null }}
 */
function extractCoverFromHtml(content) {
  if (!content || typeof content !== 'string') {
    return { cover_url: null, cover_type: null };
  }

  const candidates = collectMediaCandidates(content);
  if (!candidates.length) {
    return { cover_url: null, cover_type: null };
  }

  const first = candidates[0];
  return {
    cover_url: first.cover_url,
    cover_type: first.cover_type,
  };
}

function attachCoverToPage(page) {
  if (!page) return page;
  const { cover_url, cover_type } = extractCoverFromHtml(page.content);
  return {
    ...page,
    cover_url,
    cover_type,
  };
}

function buildCoverHtml(cover, title, escapeHtml) {
  if (!cover?.cover_url) return '';
  const coverSrc = cover.cover_url.startsWith('http')
    ? cover.cover_url
    : cover.cover_url;

  if (cover.cover_type === 'video' && isUploadMediaUrl(coverSrc)) {
    return `<div class="article-cover"><video src="${escapeHtml(coverSrc)}" muted playsinline preload="metadata" class="article-cover-video"></video></div>`;
  }

  return `<div class="article-cover"><img src="${escapeHtml(coverSrc)}" alt="${escapeHtml(title || '')}" loading="lazy"></div>`;
}

module.exports = {
  extractCoverFromHtml,
  attachCoverToPage,
  normalizeCoverUrl,
  isUploadMediaUrl,
  buildCoverHtml,
};
