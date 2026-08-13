/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Локальные URL медиа CMS (числовой file + короткий /api/v/ и /v/).
 */

export function isLocalCmsMediaUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (/\/api\/uploads\/media\/\d+\/file/i.test(url)) return true;
  if (/\/api\/v\/[A-Za-z0-9_-]+/.test(url)) return true;
  if (/(?:^|[^a-zA-Z0-9])\/v\/[A-Za-z0-9_-]+/.test(url)) return true;
  return false;
}

export function toRelativeCmsMediaUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (isLocalCmsMediaUrl(parsed.pathname)) return parsed.pathname;
  } catch {
    /* keep as-is */
  }
  return url;
}
