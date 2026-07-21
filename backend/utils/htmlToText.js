/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * HTML → plain text without executing scripts. No DOM / browser.
 */

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCharCode(n) : '';
    });
}

function extractMeta(html, nameOrProp) {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${nameOrProp}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${nameOrProp}["'][^>]*>`,
    'i'
  );
  const m = html.match(re) || html.match(re2);
  return m ? decodeEntities(m[1]).trim() : '';
}

function extractTitle(html) {
  const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
}

function extractLinks(html, baseUrl) {
  const links = [];
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const href = String(match[1] || '').trim();
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      continue;
    }
    try {
      const abs = new URL(href, baseUrl).toString();
      links.push(abs);
    } catch {
      // skip bad href
    }
  }
  return [...new Set(links)];
}

function htmlToPlainText(html) {
  let text = String(html || '');

  text = text.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ');
  text = text.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, ' ');
  text = text.replace(/<object\b[\s\S]*?<\/object>/gi, ' ');
  text = text.replace(/<embed\b[^>]*>/gi, ' ');
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|section|article|header|footer)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text);
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]{2,}/g, ' ').trim();
  return text;
}

function extractPageContent(html, pageUrl) {
  const title = extractTitle(html);
  const description =
    extractMeta(html, 'description')
    || extractMeta(html, 'og:description')
    || '';
  const text = htmlToPlainText(html);
  const links = extractLinks(html, pageUrl);

  return {
    url: pageUrl,
    title,
    description,
    text,
    links
  };
}

module.exports = {
  htmlToPlainText,
  extractPageContent,
  extractLinks,
  extractTitle
};
