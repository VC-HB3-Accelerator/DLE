/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Limited same-origin crawl: homepage + scored internal pages (max N).
 */

const { safeFetchText, assertSafeUrl } = require('../utils/safeHttpFetch');
const { extractPageContent } = require('../utils/htmlToText');

const DEFAULT_ALLOW = [
  'about', 'company', 'team', 'product', 'products', 'service', 'services',
  'pricing', 'contact', 'contacts', 'о-нас', 'компания', 'команда', 'продукт',
  'услуги', 'контакты'
];

const DEFAULT_DENY = [
  'login', 'signin', 'signup', 'cart', 'checkout', 'wp-admin', 'admin',
  'cdn', 'tag', 'page', 'account', 'auth'
];

const BLOG_KEYWORDS = ['blog', 'news', 'новост', 'блог', 'стат'];

function parseKeywordList(value, fallback) {
  if (Array.isArray(value) && value.length) {
    return value.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[,;\n]+/).map((v) => v.trim().toLowerCase()).filter(Boolean);
  }
  return [...fallback];
}

function sameOrigin(a, b) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.protocol === ub.protocol && ua.hostname === ub.hostname;
  } catch {
    return false;
  }
}

function normalizePath(url) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return '';
  }
}

function scorePath(pathname, allowKeywords, denyKeywords) {
  const path = String(pathname || '').toLowerCase();
  if (!path || path === '/') return 100; // homepage

  for (const deny of denyKeywords) {
    if (deny && path.includes(deny)) return -1;
  }

  let score = 0;
  for (const allow of allowKeywords) {
    if (allow && path.includes(allow)) score += 50;
  }
  for (const blog of BLOG_KEYWORDS) {
    if (path.includes(blog)) score += 15;
  }

  // Prefer short clean paths
  if (path.split('/').filter(Boolean).length <= 2) score += 5;
  return score;
}

function isBlogPath(pathname) {
  const path = String(pathname || '').toLowerCase();
  return BLOG_KEYWORDS.some((k) => path.includes(k));
}

/**
 * @param {string} startUrl
 * @param {object} options
 */
async function crawlSite(startUrl, options = {}) {
  const maxPages = Math.min(20, Math.max(1, Number(options.maxPages) || 5));
  const maxBlogPages = Math.min(5, Math.max(0, Number(options.maxBlogPages) || 1));
  const allowKeywords = parseKeywordList(options.allowPathKeywords, DEFAULT_ALLOW);
  const denyKeywords = parseKeywordList(options.denyPathKeywords, DEFAULT_DENY);
  const fetchTimeoutMs = Number(options.fetchTimeoutMs) > 0 ? Number(options.fetchTimeoutMs) : 10000;
  const maxBodyBytes = Number(options.maxBodyBytes) > 0 ? Number(options.maxBodyBytes) : 512 * 1024;

  const root = assertSafeUrl(startUrl).toString();
  const queue = [root];
  const seen = new Set();
  const pages = [];
  let blogCount = 0;
  const errors = [];

  while (queue.length && pages.length < maxPages) {
    const next = queue.shift();
    if (!next || seen.has(next)) continue;
    seen.add(next);

    if (!sameOrigin(root, next)) continue;

    const path = normalizePath(next);
    const score = scorePath(path, allowKeywords, denyKeywords);
    if (score < 0 && next !== root) continue;

    const blog = isBlogPath(path);
    if (blog && next !== root && blogCount >= maxBlogPages) continue;

    try {
      const fetched = await safeFetchText(next, {
        timeoutMs: fetchTimeoutMs,
        maxBytes: maxBodyBytes,
        maxRedirects: 3
      });

      if (!sameOrigin(root, fetched.url)) {
        errors.push({ url: next, error: 'redirect_left_origin' });
        continue;
      }

      const content = extractPageContent(fetched.body, fetched.url);
      pages.push({
        url: content.url,
        title: content.title,
        description: content.description,
        text: content.text.slice(0, 12000),
        score: next === root ? 100 : score,
        isBlog: blog
      });
      if (blog && next !== root) blogCount += 1;

      const candidates = (content.links || [])
        .filter((link) => sameOrigin(root, link))
        .map((link) => {
          try {
            const u = new URL(link);
            u.hash = '';
            // strip tracking query noise lightly
            return u.toString();
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .map((link) => ({
          url: link,
          score: scorePath(normalizePath(link), allowKeywords, denyKeywords)
        }))
        .filter((item) => item.score >= 0)
        .sort((a, b) => b.score - a.score);

      for (const item of candidates) {
        if (seen.has(item.url) || queue.includes(item.url)) continue;
        if (isBlogPath(normalizePath(item.url)) && blogCount >= maxBlogPages) continue;
        // Prefer allow-matched pages; still allow modest scores for discovery from homepage
        if (item.score < 15 && pages.length > 0) continue;
        queue.push(item.url);
      }

      queue.sort((a, b) => {
        const sa = scorePath(normalizePath(a), allowKeywords, denyKeywords);
        const sb = scorePath(normalizePath(b), allowKeywords, denyKeywords);
        return sb - sa;
      });
    } catch (error) {
      errors.push({ url: next, error: error.message || String(error) });
    }
  }

  pages.sort((a, b) => b.score - a.score);

  const combinedText = pages.map((p) => {
    const parts = [
      `URL: ${p.url}`,
      p.title ? `TITLE: ${p.title}` : '',
      p.description ? `DESCRIPTION: ${p.description}` : '',
      p.text
    ].filter(Boolean);
    return parts.join('\n');
  }).join('\n\n-----\n\n');

  return {
    startUrl: root,
    pages,
    pageCount: pages.length,
    combinedText: combinedText.slice(0, 40000),
    errors
  };
}

module.exports = {
  crawlSite,
  scorePath,
  parseKeywordList,
  DEFAULT_ALLOW,
  DEFAULT_DENY
};
