/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Обложки блога из HTML контента Quill-редактора (/content/create):
 * - изображения: <img src="/api/uploads/media/{id}/file">
 * - видео: <div class="video-wrapper"><video src=".../api/uploads/media/{id}/file">
 * - legacy: <iframe class="ql-video" src=".../api/uploads/media/{id}/file">
 */

const UPLOAD_MEDIA_RE = /\/api\/uploads\/media\/\d+\/file|\/api\/v\/[A-Za-z0-9_-]+|(?:^|[^a-zA-Z0-9])\/v\/[A-Za-z0-9_-]+/i;

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

function parsePageSettings(settings) {
  if (!settings) return {};
  if (typeof settings === 'object' && !Array.isArray(settings)) return settings;
  if (typeof settings === 'string') {
    try {
      const parsed = JSON.parse(settings);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function parseListingMedia(settings) {
  const lm = parsePageSettings(settings).listing_media;
  if (!lm || typeof lm !== 'object') return { photos: [], video: null };
  return {
    photos: Array.isArray(lm.photos) ? lm.photos.filter(Boolean).map(String) : [],
    video: lm.video ? String(lm.video) : null,
  };
}

function stripWatermarkQuery(url) {
  const src = String(url || '');
  if (!src) return src;
  return src
    .replace(/([?&])wm=1\b/g, '$1')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?');
}

function guessVideoMime(url, explicit) {
  if (explicit && String(explicit).startsWith('video/')) return String(explicit);
  const p = stripWatermarkQuery(url).split('?')[0].toLowerCase();
  if (p.endsWith('.webm')) return 'video/webm';
  if (p.endsWith('.ogg') || p.endsWith('.ogv')) return 'video/ogg';
  if (p.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}

function urlsMatch(a, b) {
  return Boolean(stripWatermarkQuery(a)) && stripWatermarkQuery(a) === stripWatermarkQuery(b);
}

function resolveSharePreview(settings, listingMedia) {
  const s = parsePageSettings(settings);
  const lm = listingMedia || parseListingMedia(s);
  const photos = lm.photos || [];
  const video = lm.video || null;
  const raw = s.share_preview && typeof s.share_preview === 'object' ? s.share_preview : null;
  const url = raw?.url ? String(raw.url) : '';
  const type = raw?.type === 'image' || raw?.type === 'video' ? raw.type : null;
  if (type === 'image' && photos.some((p) => urlsMatch(p, url))) {
    const match = photos.find((p) => urlsMatch(p, url));
    return { type: 'image', url: match, mime: null };
  }
  if (type === 'video' && video && urlsMatch(video, url)) {
    return { type: 'video', url: video, mime: guessVideoMime(video, raw.mime) };
  }
  if (photos[0]) return { type: 'image', url: photos[0], mime: null };
  if (video) return { type: 'video', url: video, mime: guessVideoMime(video, raw?.mime) };
  return null;
}

function coverFromListingOrHtml(page) {
  const lm = parseListingMedia(page?.settings);
  if (lm.photos[0]) return { cover_url: lm.photos[0], cover_type: 'image' };
  if (lm.video) return { cover_url: lm.video, cover_type: 'video' };
  return extractCoverFromHtml(page?.content);
}

function attachCoverToPage(page) {
  if (!page) return page;
  const { cover_url, cover_type } = coverFromListingOrHtml(page);
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

function parsePageSeo(seo) {
  if (!seo) return {};
  if (typeof seo === 'object') return seo;
  if (typeof seo === 'string') {
    try {
      const parsed = JSON.parse(seo);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function absolutizeMediaUrl(url, baseUrl) {
  const src = normalizeCoverUrl(url);
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  const base = String(baseUrl || '').replace(/\/$/, '');
  return `${base}${src.startsWith('/') ? '' : '/'}${src}`;
}

/**
 * Картинка для соцпревью (og:image):
 * 1) seo.og_image (явная обложка из формы)
 * 2) первое изображение в контенте / cover_type=image
 * 3) fallback логотип сайта
 * Видео само по себе в og:image не подходит — мессенджеры ждут JPEG/PNG.
 */
function resolveSocialPreviewImage({
  seo = null,
  cover = null,
  content = '',
  settings = null,
  listingMedia = null,
  baseUrl = '',
  fallbackPath = '/og-default.png'
} = {}) {
  const lm = listingMedia || parseListingMedia(settings);
  const share = resolveSharePreview(settings, lm);
  if (share?.type === 'image' && share.url) {
    return absolutizeMediaUrl(stripWatermarkQuery(share.url), baseUrl);
  }
  if (share?.type === 'video') {
    if (lm.photos[0]) {
      return absolutizeMediaUrl(stripWatermarkQuery(lm.photos[0]), baseUrl);
    }
    return absolutizeMediaUrl(fallbackPath, baseUrl);
  }

  const seoObj = parsePageSeo(seo);
  const explicit = seoObj.og_image || seoObj.image || seoObj.social_image || null;
  if (explicit) {
    return absolutizeMediaUrl(stripWatermarkQuery(explicit), baseUrl);
  }

  if (cover?.cover_url && cover.cover_type === 'image') {
    return absolutizeMediaUrl(stripWatermarkQuery(cover.cover_url), baseUrl);
  }

  const candidates = collectMediaCandidates(content || '');
  const image = candidates.find((c) => c.cover_type === 'image');
  if (image?.cover_url) {
    return absolutizeMediaUrl(stripWatermarkQuery(image.cover_url), baseUrl);
  }

  return absolutizeMediaUrl(fallbackPath, baseUrl);
}

function resolveSocialPreviewVideo({
  cover = null,
  content = '',
  settings = null,
  listingMedia = null,
  baseUrl = '',
} = {}) {
  const lm = listingMedia || parseListingMedia(settings);
  const share = resolveSharePreview(settings, lm);
  if (share?.type === 'image') {
    return null;
  }
  if (share?.type === 'video' && share.url) {
    return {
      url: absolutizeMediaUrl(stripWatermarkQuery(share.url), baseUrl),
      mime: share.mime || guessVideoMime(share.url),
    };
  }

  if (lm.photos.length || lm.video) {
    return null;
  }

  if (cover?.cover_url && cover.cover_type === 'video') {
    const url = absolutizeMediaUrl(stripWatermarkQuery(cover.cover_url), baseUrl);
    return url ? { url, mime: guessVideoMime(cover.cover_url) } : null;
  }
  const video = collectMediaCandidates(content || '').find((c) => c.cover_type === 'video');
  if (video?.cover_url) {
    const url = absolutizeMediaUrl(stripWatermarkQuery(video.cover_url), baseUrl);
    return url ? { url, mime: guessVideoMime(video.cover_url) } : null;
  }
  return null;
}

module.exports = {
  extractCoverFromHtml,
  attachCoverToPage,
  normalizeCoverUrl,
  isUploadMediaUrl,
  buildCoverHtml,
  parsePageSeo,
  parsePageSettings,
  parseListingMedia,
  resolveSharePreview,
  stripWatermarkQuery,
  guessVideoMime,
  absolutizeMediaUrl,
  resolveSocialPreviewImage,
  resolveSocialPreviewVideo,
  collectMediaCandidates,
};
