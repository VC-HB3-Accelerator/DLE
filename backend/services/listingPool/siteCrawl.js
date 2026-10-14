'use strict';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function sameHost(url, allowHost) {
  const host = hostOf(url);
  return host && host === String(allowHost || '').replace(/^www\./i, '');
}

function extractUrls(html, pageUrl) {
  const text = String(html || '');
  const images = new Set();
  const videos = new Set();
  const og = text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
  if (og?.[1]) images.add(og[1]);
  for (const match of text.matchAll(/<img[^>]+src=["']([^"']+)/gi)) {
    if (match[1]) images.add(match[1]);
  }
  for (const match of text.matchAll(/<source[^>]+src=["']([^"']+\.mp4[^"']*)/gi)) {
    if (match[1]) videos.add(match[1]);
  }
  for (const match of text.matchAll(/https?:\/\/[^"' \s>]+\.mp4/gi)) {
    videos.add(match[0]);
  }
  const base = pageUrl;
  const resolve = (raw) => {
    try {
      return new URL(raw, base).href;
    } catch {
      return '';
    }
  };
  return {
    images: [...images].map(resolve).filter(Boolean),
    videos: [...videos].map(resolve).filter(Boolean),
  };
}

async function crawlPages(urls, { limit = 3 } = {}) {
  const pages = Array.isArray(urls) ? urls.filter(Boolean).slice(0, limit) : [];
  const images = [];
  const videos = [];
  for (const pageUrl of pages) {
    const allowHost = hostOf(pageUrl);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(pageUrl, {
        signal: ctrl.signal,
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const html = await res.text();
      const found = extractUrls(html, pageUrl);
      for (const url of found.images) {
        if (sameHost(url, allowHost)) images.push(url);
      }
      for (const url of found.videos) {
        if (sameHost(url, allowHost)) videos.push(url);
      }
    } catch {
      /* skip page */
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    images: [...new Set(images)].slice(0, 16),
    videos: [...new Set(videos)].slice(0, 4),
  };
}

module.exports = {
  hostOf,
  sameHost,
  extractUrls,
  crawlPages,
};
