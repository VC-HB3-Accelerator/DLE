/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Title / meta из API GET /settings/sidebar-notice
 * → domainDescription, ogImageUrl, hideOgImage.
 */

import { fetchSidebarNotice } from '@/services/sidebarNoticeService';

const DEFAULT_OG_IMAGE = '/og-default.png';

let cached = null;

function updateOrCreateMeta(name, content, attribute = 'name') {
  let meta = document.querySelector(`meta[${attribute}="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function removeMeta(name, attribute = 'name') {
  const meta = document.querySelector(`meta[${attribute}="${name}"]`);
  if (meta) meta.remove();
}

function applyFavicon(href) {
  const url = String(href || '').trim() || '/favicon.ico';
  const links = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
  if (links.length) {
    links.forEach((link) => {
      link.setAttribute('href', url);
      if (url.endsWith('.png') || url.includes('/uploads/')) {
        link.setAttribute('type', 'image/png');
      } else if (url.endsWith('.ico')) {
        link.setAttribute('type', 'image/x-icon');
      }
    });
    return;
  }
  const link = document.createElement('link');
  link.setAttribute('rel', 'icon');
  link.setAttribute('href', url);
  if (url.endsWith('.png') || url.includes('/uploads/')) {
    link.setAttribute('type', 'image/png');
  }
  document.head.appendChild(link);
}

function titleFromDescription(text) {
  return String(text || '').trim().slice(0, 120);
}

function siteNameFromDescription(text) {
  const value = String(text || '').trim();
  const part = value.split(/\s+[—–-]\s+/)[0].trim();
  return (part || value).slice(0, 80);
}

function resolveOgImage(state) {
  if (state?.hideOgImage) {
    return { url: '', hidden: true };
  }
  const custom = String(state?.ogImageUrl || '').trim();
  return { url: custom || DEFAULT_OG_IMAGE, hidden: false };
}

function applySiteMeta(state) {
  const custom = String(state?.description || '').trim();
  const title = titleFromDescription(custom);
  const siteName = siteNameFromDescription(custom);
  const og = resolveOgImage(state);

  updateOrCreateMeta('description', custom);
  updateOrCreateMeta('og:description', custom, 'property');
  updateOrCreateMeta('twitter:description', custom);
  updateOrCreateMeta('og:title', title, 'property');
  updateOrCreateMeta('twitter:title', title);
  updateOrCreateMeta('og:site_name', siteName, 'property');

  if (og.hidden) {
    removeMeta('og:image', 'property');
    removeMeta('twitter:image');
    updateOrCreateMeta('twitter:card', 'summary');
    applyFavicon('/favicon.ico');
  } else {
    updateOrCreateMeta('og:image', og.url, 'property');
    updateOrCreateMeta('twitter:image', og.url);
    updateOrCreateMeta(
      'twitter:card',
      og.url && og.url !== DEFAULT_OG_IMAGE ? 'summary_large_image' : 'summary'
    );
    applyFavicon(og.url);
  }

  if (window.location.pathname === '/' || window.location.pathname === '') {
    document.title = title;
  }

  return custom;
}

export function applySiteMetaDescription(text, extras = {}) {
  const custom = String(text || '').trim();
  cached = {
    description: custom,
    isCustom: Boolean(custom),
    ogImageUrl: extras.ogImageUrl !== undefined
      ? String(extras.ogImageUrl || '').trim()
      : (cached?.ogImageUrl || ''),
    hideOgImage: extras.hideOgImage !== undefined
      ? Boolean(extras.hideOgImage)
      : Boolean(cached?.hideOgImage),
  };
  return applySiteMeta(cached);
}

export function applySiteMetaState(state) {
  cached = {
    description: String(state?.description || state?.domainDescription || '').trim(),
    isCustom: Boolean(String(state?.description || state?.domainDescription || '').trim()),
    ogImageUrl: String(state?.ogImageUrl || '').trim(),
    hideOgImage: Boolean(state?.hideOgImage),
  };
  return applySiteMeta(cached);
}

export async function loadSiteMetaDescription() {
  if (cached != null) {
    applySiteMeta(cached);
    return cached.description;
  }
  try {
    const data = await fetchSidebarNotice();
    cached = {
      description: String(data?.domainDescription || '').trim(),
      isCustom: Boolean(String(data?.domainDescription || '').trim()),
      ogImageUrl: String(data?.ogImageUrl || '').trim(),
      hideOgImage: Boolean(data?.hideOgImage),
    };
  } catch {
    cached = {
      description: '',
      isCustom: false,
      ogImageUrl: '',
      hideOgImage: false,
    };
  }
  applySiteMeta(cached);
  return cached.description;
}

export function setCachedSiteMetaDescription(text, extras = {}) {
  return applySiteMetaDescription(text, extras);
}

export { applyFavicon, DEFAULT_OG_IMAGE };
