/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * search.pages: несколько текстовых выдач + опционально база знаний
 * (только таблица-источник, с сессией). Не публичный /api/rag/answer.
 */

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const ENGINES = ['yandex', 'bing', 'google'];
const PER_ENGINE = 5;

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeMaybe(s) {
  try {
    return decodeURIComponent(String(s || ''));
  } catch {
    return String(s || '');
  }
}

function cleanUrl(raw) {
  const url = decodeMaybe(String(raw || '').replace(/&amp;/g, '&'));
  if (!/^https?:\/\//i.test(url)) return '';
  if (/yandex\.(ru|com)|google\.(com|ru)|bing\.com|microsoft\.com|gstatic\.com/i.test(url)
    && !/\/url\?/.test(url)) {
    if (/search\?|images\/search|webhp/i.test(url)) return '';
  }
  const google = url.match(/[?&]q=(https?[^&]+)/);
  if (google) return decodeMaybe(google[1]);
  return url.split('&')[0];
}

function parseYandexWeb(html) {
  const out = [];
  const re = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const seen = new Set();
  while ((match = re.exec(html)) && out.length < PER_ENGINE) {
    const url = cleanUrl(match[1]);
    const title = stripTags(match[2]);
    if (!url || !title || title.length < 4 || seen.has(url)) continue;
    if (/yandex\.(ru|com)\/search/i.test(url)) continue;
    seen.add(url);
    out.push({ system: 'yandex', url, title, snippet: '' });
  }
  return out;
}

function parseBingWeb(html) {
  const out = [];
  const re = /<li class="b_algo"[\s\S]*?<h2>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;
  let match;
  while ((match = re.exec(html)) && out.length < PER_ENGINE) {
    const url = cleanUrl(match[1]);
    const title = stripTags(match[2]);
    if (!url || !title) continue;
    out.push({ system: 'bing', url, title, snippet: stripTags(match[3] || '') });
  }
  return out;
}

function parseGoogleWeb(html) {
  const out = [];
  const re = /<a[^>]+href="(\/url\?q=https?[^"]+|https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const seen = new Set();
  while ((match = re.exec(html)) && out.length < PER_ENGINE) {
    const url = cleanUrl(match[1]);
    const title = stripTags(match[2]);
    if (!url || !title || title.length < 4 || seen.has(url)) continue;
    if (/google\.(com|ru)/i.test(url)) continue;
    seen.add(url);
    out.push({ system: 'google', url, title, snippet: '' });
  }
  return out;
}

const PARSERS = {
  yandex: parseYandexWeb,
  bing: parseBingWeb,
  google: parseGoogleWeb,
};

function searchUrl(engine, query) {
  const q = encodeURIComponent(query);
  if (engine === 'yandex') return `https://yandex.ru/search/?text=${q}`;
  if (engine === 'bing') return `https://www.bing.com/search?q=${q}`;
  return `https://www.google.com/search?q=${q}&hl=ru`;
}

async function defaultFetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } finally {
    clearTimeout(t);
  }
}

function findConflicts(sources) {
  const years = new Map();
  const prices = new Map();
  for (const src of sources || []) {
    const text = `${src.title || ''} ${src.snippet || ''}`;
    for (const year of text.match(/\b(?:19|20)\d{2}\b/g) || []) {
      if (!years.has(year)) years.set(year, []);
      years.get(year).push(src);
    }
    for (const price of text.match(/\b\d[\d\s]{2,}\s?(?:₽|руб|usd|\$)\b/gi) || []) {
      const key = price.replace(/\s+/g, '');
      if (!prices.has(key)) prices.set(key, []);
      prices.get(key).push(src);
    }
  }
  const questions = [];
  if (years.size >= 2) {
    const keys = [...years.keys()];
    const text = `Источники расходятся по году: ${keys.join(' и ')}. Какой верный?`;
    questions.push({
      id: 'conflict_year',
      field: 'sources',
      text,
      prompt: text,
      options: keys.map((year) => ({ id: year, label: year })),
    });
  }
  if (prices.size >= 2) {
    const keys = [...prices.keys()].slice(0, 3);
    const text = `Источники расходятся по цене: ${keys.join(' и ')}. Какая верная?`;
    questions.push({
      id: 'conflict_price',
      field: 'sources',
      text,
      prompt: text,
      options: keys.map((price) => ({ id: price, label: price })),
    });
  }
  return questions;
}

function stamp(system, hit, fetchedAt) {
  return {
    system,
    url: hit.url || null,
    title: hit.title || '',
    snippet: hit.snippet || '',
    fetched_at: fetchedAt,
  };
}

async function searchKnowledge({ query, tableId, ownerUserId, hooks = {} }) {
  if (!tableId) return [];
  const allowed = hooks.isRagSource
    ? await hooks.isRagSource(tableId)
    : await require('./aiAssistantRulesMirrorService').isRagSourceTable(tableId);
  if (!allowed) return [];
  if (hooks.knowledge) {
    const rows = await hooks.knowledge({ query, tableId, ownerUserId });
    return Array.isArray(rows) ? rows : [];
  }
  const rag = require('./ragService');
  const ans = await rag.ragAnswer({
    tableId: Number(tableId),
    userQuestion: String(query || ''),
    userId: ownerUserId || null,
  });
  const text = String(ans?.answer || '').trim();
  if (!text) return [];
  return [{
    system: 'knowledge',
    url: null,
    title: 'База знаний',
    snippet: text.slice(0, 1200),
    fetched_at: new Date().toISOString(),
  }];
}

async function searchPages({
  query,
  tableId = null,
  ownerUserId = null,
  fetchHtml = defaultFetchHtml,
  engines = ENGINES,
  hooks = {},
} = {}) {
  const q = String(query || '').trim();
  if (!q) {
    return {
      query: '',
      sources: [],
      questions: [{ id: 'query', field: 'query', text: 'Что искать?', prompt: 'Что искать?' }],
    };
  }
  const fetchedAt = new Date().toISOString();
  const collected = [];
  await Promise.all(engines.map(async (engine) => {
    const parser = PARSERS[engine];
    if (!parser) return;
    try {
      const got = await fetchHtml(searchUrl(engine, q), { engine });
      const html = got?.text || '';
      const hits = parser(html);
      hits.forEach((hit) => collected.push(stamp(engine, hit, fetchedAt)));
    } catch {
      /* одна система молчит — остальные остаются */
    }
  }));
  const seen = new Set();
  const sources = [];
  for (const src of collected) {
    const key = src.url || `${src.system}:${src.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push(src);
  }
  try {
    const knowledge = await searchKnowledge({ query: q, tableId, ownerUserId, hooks });
    knowledge.forEach((row) => sources.push({
      system: row.system || 'knowledge',
      url: row.url || null,
      title: row.title || 'База знаний',
      snippet: row.snippet || '',
      fetched_at: row.fetched_at || fetchedAt,
    }));
  } catch {
    /* база знаний не обязательна */
  }
  return {
    query: q,
    sources,
    questions: findConflicts(sources),
  };
}

module.exports = {
  ENGINES,
  parseYandexWeb,
  parseBingWeb,
  parseGoogleWeb,
  findConflicts,
  searchPages,
  searchKnowledge,
  cleanUrl,
};
