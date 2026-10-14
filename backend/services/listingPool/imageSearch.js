'use strict';

/**
 * Internet image search for listing research (NOT manufacturer-site crawl).
 * Engines run in parallel: Yandex Images, Bing Images, Google Images.
 */
const { rejectWatermarkUrl } = require('./watermarkFilter');

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const ENGINE_ORDER = ['yandex', 'bing', 'google'];
const DEFAULT_RETRIES = 2;
const RETRY_BASE_MS = 450;

function decodeMaybe(s) {
  try {
    return decodeURIComponent(String(s || ''));
  } catch {
    return String(s || '');
  }
}

function isLikelyPhotoUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (/yandex\.(ru|net|com)|google\.(com|ru)|gstatic\.com|bing\.com|yahoo\.com/i.test(url)) {
    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(url)) return false;
  }
  if (/logo|favicon|sprite|1x1|pixel|tracking|avatar|icon[_-]?s?\d/i.test(url)) return false;
  const wm = rejectWatermarkUrl(url);
  if (!wm.ok) return false;
  return true;
}

function uniqUrls(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const url = item.url || item;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(typeof item === 'string' ? { url: item } : item);
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url, { referer } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        ...(referer ? { Referer: referer } : {}),
      },
      redirect: 'follow',
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, url: res.url || url, text };
  } finally {
    clearTimeout(t);
  }
}

function parseYandex(html) {
  const out = [];
  const reImg = /img_url=([^&"'\s]+)/gi;
  let m;
  while ((m = reImg.exec(html))) {
    const url = decodeMaybe(m[1]);
    if (isLikelyPhotoUrl(url)) out.push({ url, engine: 'yandex' });
  }
  const reOrig = /origUrl&quot;:&quot;([^&"]+)/gi;
  while ((m = reOrig.exec(html))) {
    const url = decodeMaybe(m[1].replace(/\\u0026/g, '&'));
    if (isLikelyPhotoUrl(url)) out.push({ url, engine: 'yandex' });
  }
  const reJson = /"url"\s*:\s*"(https?:\\\/\\\/[^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi;
  while ((m = reJson.exec(html))) {
    const url = m[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&');
    if (isLikelyPhotoUrl(url)) out.push({ url, engine: 'yandex' });
  }
  return uniqUrls(out);
}

function parseBing(html) {
  const out = [];
  const re = /murl&quot;:&quot;([^&"]+)|"murl"\s*:\s*"([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = decodeMaybe(m[1] || m[2]);
    if (isLikelyPhotoUrl(url)) out.push({ url, engine: 'bing' });
  }
  return uniqUrls(out);
}

function parseGoogle(html) {
  const out = [];
  const reOu = /"ou"\s*:\s*"(https?:\\\/\\\/[^"]+)"/gi;
  let m;
  while ((m = reOu.exec(html))) {
    const url = m[1].replace(/\\\//g, '/').replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
    if (isLikelyPhotoUrl(url)) out.push({ url, engine: 'google' });
  }
  const reImgurl = /imgurl=(https?[^&]+)/gi;
  while ((m = reImgurl.exec(html))) {
    const url = decodeMaybe(m[1]);
    if (isLikelyPhotoUrl(url)) out.push({ url, engine: 'google' });
  }
  return uniqUrls(out);
}

async function searchYandex(query, { limit = 24 } = {}) {
  const q = encodeURIComponent(query);
  const url = `https://yandex.ru/images/search?text=${q}&itype=jpg`;
  const got = await fetchHtml(url, { referer: 'https://yandex.ru/' });
  if (!got.ok) return { engine: 'yandex', status: got.status, hits: [], error: `HTTP ${got.status}` };
  const hits = parseYandex(got.text).slice(0, limit);
  return {
    engine: 'yandex',
    status: got.status,
    hits,
    error: hits.length ? null : 'empty_parse',
  };
}

async function searchBing(query, { limit = 24 } = {}) {
  const q = encodeURIComponent(query);
  const pages = [1, 35, 70];
  const merged = [];
  let status = 0;
  let lastErr = null;
  for (const first of pages) {
    if (merged.length >= limit) break;
    const url = `https://www.bing.com/images/search?q=${q}&form=HDRSC2&first=${first}`;
    try {
      const got = await fetchHtml(url, { referer: 'https://www.bing.com/' });
      status = got.status || status;
      if (!got.ok) {
        lastErr = `HTTP ${got.status}`;
        continue;
      }
      merged.push(...parseBing(got.text));
    } catch (e) {
      lastErr = e.message || String(e);
    }
  }
  const hits = uniqUrls(merged).slice(0, limit);
  return {
    engine: 'bing',
    status: status || (hits.length ? 200 : 0),
    hits,
    error: hits.length ? null : lastErr || 'empty_parse',
  };
}

async function searchGoogle(query, { limit = 24 } = {}) {
  const q = encodeURIComponent(query);
  const url = `https://www.google.com/search?q=${q}&tbm=isch&hl=ru&safe=off`;
  const got = await fetchHtml(url, { referer: 'https://www.google.com/' });
  if (!got.ok) return { engine: 'google', status: got.status, hits: [], error: `HTTP ${got.status}` };
  const hits = parseGoogle(got.text).slice(0, limit);
  return {
    engine: 'google',
    status: got.status,
    hits,
    error: hits.length ? null : 'empty_parse',
  };
}

const RUNNERS = {
  yandex: searchYandex,
  bing: searchBing,
  google: searchGoogle,
};

/**
 * Run one engine with retries on network / HTTP / empty parse.
 */
async function runEngineWithRetry(name, query, { limit, retries = DEFAULT_RETRIES } = {}) {
  const run = RUNNERS[name];
  if (!run) return { engine: name, status: 0, hits: [], error: 'unknown_engine', attempts: 0 };

  let last = { engine: name, status: 0, hits: [], error: 'not_started', attempts: 0 };
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const r = await run(query, { limit });
      last = {
        engine: name,
        status: r.status,
        hits: r.hits || [],
        error: r.error || null,
        attempts: attempt,
      };
      if (last.hits.length > 0) return last;
    } catch (e) {
      last = {
        engine: name,
        status: 0,
        hits: [],
        error: e.message || String(e),
        attempts: attempt,
      };
    }
    if (attempt <= retries) await sleep(RETRY_BASE_MS * attempt);
  }
  return last;
}

/**
 * Interleave hits by engine order so one strong engine does not starve others.
 */
function mergeHitsRoundRobin(byEngine, engines, limit) {
  const queues = engines.map((name) => [...(byEngine.get(name) || [])]);
  const out = [];
  let progress = true;
  while (out.length < limit && progress) {
    progress = false;
    for (const q of queues) {
      if (!q.length || out.length >= limit) continue;
      out.push(q.shift());
      progress = true;
    }
  }
  return uniqUrls(out).slice(0, limit);
}

/**
 * @returns {{ query: string, engines: object[], hits: {url,engine}[] }}
 */
async function searchInternetImages(
  query,
  { limit = 32, engines = ENGINE_ORDER, retries = DEFAULT_RETRIES } = {}
) {
  const q = String(query || '').trim();
  if (!q) throw new Error('empty image search query');

  const list = (engines || ENGINE_ORDER).filter((n) => RUNNERS[n]);
  const per = Math.max(12, Math.ceil(limit / Math.max(1, list.length)) + 6);

  const settled = await Promise.allSettled(
    list.map((name) => runEngineWithRetry(name, q, { limit: per, retries }))
  );

  const engineResults = [];
  const byEngine = new Map();

  settled.forEach((s, i) => {
    const name = list[i];
    if (s.status === 'fulfilled') {
      const r = s.value;
      engineResults.push({
        engine: r.engine,
        status: r.status,
        count: (r.hits || []).length,
        attempts: r.attempts || 1,
        ...(r.error && !(r.hits || []).length ? { error: r.error } : {}),
      });
      byEngine.set(name, r.hits || []);
    } else {
      engineResults.push({
        engine: name,
        status: 0,
        count: 0,
        attempts: 1,
        error: s.reason?.message || String(s.reason || 'rejected'),
      });
      byEngine.set(name, []);
    }
  });

  const hits = mergeHitsRoundRobin(byEngine, list, limit);
  const anyOk = engineResults.some((e) => e.count > 0);
  if (!anyOk) {
    const detail = engineResults.map((e) => `${e.engine}:${e.error || e.status}`).join('; ');
    const err = new Error(`image search empty (${detail})`);
    err.code = 'IMAGE_SEARCH_EMPTY';
    err.engines = engineResults;
    throw err;
  }

  return { query: q, engines: engineResults, hits };
}

function buildSearchQuery(brand, model, extra = '') {
  const parts = [brand, model, extra].map((s) => String(s || '').trim()).filter(Boolean);
  return parts.join(' ');
}

module.exports = {
  searchInternetImages,
  searchYandex,
  searchBing,
  searchGoogle,
  buildSearchQuery,
  isLikelyPhotoUrl,
  ENGINE_ORDER,
};
