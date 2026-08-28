/**
 * Кэш «живости» хостов для импорта сайтов: DNS + короткий HTTP.
 * Мёртвый = DNS не резолвится. HTTP — подтверждение; таймаут/сеть при живом DNS = оставляем.
 */

const dns = require('dns').promises;
const { normalizeWebsiteUrl } = require('./contactImportMulti');

const DNS_TIMEOUT_MS = 2500;
const HTTP_TIMEOUT_MS = 4000;
const DEFAULT_CONCURRENCY = 12;

function hostnameOf(urlOrHost) {
  const raw = String(urlOrHost || '').trim();
  if (!raw) return null;
  try {
    const normalized = normalizeWebsiteUrl(raw) || (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = new URL(normalized).hostname.toLowerCase();
    if (!host || host === 'localhost' || host.includes(',')) return null;
    return host.replace(/\.$/, '');
  } catch {
    return null;
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
    })
  ]);
}

async function probeHost(hostname) {
  try {
    await withTimeout(dns.lookup(hostname, { all: false }), DNS_TIMEOUT_MS, 'dns');
  } catch {
    return false;
  }

  // DNS ок = живой для импорта. HTTP не блокируем (иначе 100k строк «замирают» на 0%).
  // Фоновая проверка только прогревает кэш ответов — на решение alive не влияет.
  setImmediate(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
    fetch(`https://${hostname}/`, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': 'DLE-ContactImport/1.0' }
    }).catch(() => {}).finally(() => clearTimeout(t));
  });

  return true;
}

function createLivenessCache({ concurrency = DEFAULT_CONCURRENCY } = {}) {
  const cache = new Map(); // host -> boolean
  const inflight = new Map();
  let active = 0;
  const queue = [];

  const pump = () => {
    while (active < concurrency && queue.length) {
      const { run } = queue.shift();
      active += 1;
      Promise.resolve()
        .then(run)
        .finally(() => {
          active -= 1;
          pump();
        });
    }
  };

  const enqueue = (fn) => new Promise((resolve, reject) => {
    queue.push({
      run: () => fn().then(resolve, reject)
    });
    pump();
  });

  async function isAlive(urlOrHost) {
    const host = hostnameOf(urlOrHost);
    if (!host) return false;
    if (cache.has(host)) return cache.get(host);

    if (inflight.has(host)) return inflight.get(host);

    const p = enqueue(async () => {
      const alive = await probeHost(host);
      cache.set(host, alive);
      inflight.delete(host);
      return alive;
    });
    inflight.set(host, p);
    return p;
  }

  async function filterAliveUrls(urls, { onDead } = {}) {
    const out = [];
    for (const url of urls) {
      const alive = await isAlive(url);
      if (alive) out.push(url);
      else if (typeof onDead === 'function') onDead(url);
    }
    return out;
  }

  async function warmHosts(hosts) {
    const unique = [...new Set((hosts || []).map(hostnameOf).filter(Boolean))];
    await Promise.all(unique.map((h) => isAlive(h)));
    return { checked: unique.length, alive: unique.filter((h) => cache.get(h)).length };
  }

  return {
    isAlive,
    filterAliveUrls,
    warmHosts,
    hostnameOf,
    stats: () => ({ size: cache.size, alive: [...cache.values()].filter(Boolean).length })
  };
}

module.exports = {
  createLivenessCache,
  hostnameOf,
  probeHost
};
