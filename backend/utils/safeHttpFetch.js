/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * SSRF-safe HTTP(S) fetch: DNS → IP check, no private targets,
 * limited redirects, size/timeout/content-type caps. Does not execute JS.
 */

const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const ALLOWED_PORTS = new Set([80, 443]);
const ALLOWED_CONTENT_TYPES = [
  'text/html',
  'application/xhtml+xml',
  'text/plain'
];

function isPrivateOrLocalIp(ip) {
  const addr = String(ip || '').trim().toLowerCase();
  if (!addr) return true;

  if (addr === '::1' || addr === '0.0.0.0') return true;
  if (addr.startsWith('fc') || addr.startsWith('fd') || addr.startsWith('fe80:')) return true;

  if (net.isIPv4(addr)) {
    const parts = addr.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  if (net.isIPv6(addr)) {
    if (addr === '::' || addr === '::1') return true;
    if (addr.startsWith('::ffff:')) {
      return isPrivateOrLocalIp(addr.slice(7));
    }
    return true; // conservative: block raw IPv6 literals unless public check added later
  }

  return true;
}

function assertSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https allowed');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URL credentials are not allowed');
  }

  const port = parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80);
  if (!ALLOWED_PORTS.has(port)) {
    throw new Error(`Port ${port} is not allowed`);
  }

  const host = parsed.hostname;
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new Error('Local hostnames are not allowed');
  }

  if (net.isIP(host) && isPrivateOrLocalIp(host)) {
    throw new Error('Private IP targets are not allowed');
  }

  return parsed;
}

async function resolveAndAssertPublic(hostname) {
  if (net.isIP(hostname)) {
    if (isPrivateOrLocalIp(hostname)) {
      throw new Error('Private IP targets are not allowed');
    }
    return [hostname];
  }

  let records;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new Error(`DNS lookup failed: ${error.message}`);
  }

  if (!records.length) {
    throw new Error('DNS lookup returned no addresses');
  }

  for (const row of records) {
    if (isPrivateOrLocalIp(row.address)) {
      throw new Error('Host resolves to a private/local address');
    }
  }

  return records.map((r) => r.address);
}

function contentTypeAllowed(contentType) {
  const ct = String(contentType || '').toLowerCase().split(';')[0].trim();
  if (!ct) return true; // some servers omit it
  return ALLOWED_CONTENT_TYPES.some((allowed) => ct === allowed || ct.startsWith(`${allowed}`));
}

function fetchOnce(parsedUrl, { timeoutMs, maxBytes, method = 'GET' }) {
  const lib = parsedUrl.protocol === 'https:' ? https : http;
  const headers = {
    'User-Agent': 'DLE-ContactSiteParser/1.0 (+https://hb3-accelerator.com; safe-text-fetch)',
    Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
    'Accept-Language': 'ru,en;q=0.8'
  };

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || undefined,
        path: `${parsedUrl.pathname || '/'}${parsedUrl.search || ''}`,
        method,
        headers,
        timeout: timeoutMs,
        setHost: true
      },
      (res) => {
        const status = res.statusCode || 0;
        const location = res.headers.location;
        const contentType = res.headers['content-type'] || '';
        const contentLength = Number(res.headers['content-length'] || 0);

        if (contentLength > maxBytes) {
          res.resume();
          reject(new Error('Response too large (Content-Length)'));
          return;
        }

        if (status >= 300 && status < 400) {
          res.resume();
          resolve({
            kind: 'redirect',
            status,
            location: location ? String(location) : null,
            contentType,
            finalUrl: parsedUrl.toString(),
            body: ''
          });
          return;
        }

        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }

        if (!contentTypeAllowed(contentType)) {
          res.resume();
          reject(new Error(`Unsupported Content-Type: ${contentType || 'unknown'}`));
          return;
        }

        const chunks = [];
        let size = 0;
        let aborted = false;

        res.on('data', (chunk) => {
          if (aborted) return;
          size += chunk.length;
          if (size > maxBytes) {
            aborted = true;
            req.destroy();
            reject(new Error('Response too large'));
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          if (aborted) return;
          resolve({
            kind: 'body',
            status,
            location: null,
            contentType,
            finalUrl: parsedUrl.toString(),
            body: Buffer.concat(chunks).toString('utf8')
          });
        });

        res.on('error', reject);
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Fetch timeout'));
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * @param {string} url
 * @param {{ timeoutMs?: number, maxBytes?: number, maxRedirects?: number }} [options]
 */
async function safeFetchText(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_MAX_BYTES;
  const maxRedirects = Number.isInteger(options.maxRedirects)
    ? options.maxRedirects
    : DEFAULT_MAX_REDIRECTS;

  let current = String(url || '').trim();
  let redirects = 0;

  while (redirects <= maxRedirects) {
    const parsed = assertSafeUrl(current);
    await resolveAndAssertPublic(parsed.hostname);

    const result = await fetchOnce(parsed, { timeoutMs, maxBytes });
    if (result.kind === 'body') {
      return {
        url: result.finalUrl,
        status: result.status,
        contentType: result.contentType,
        body: result.body
      };
    }

    if (!result.location) {
      throw new Error('Redirect without Location');
    }

    const next = new URL(result.location, parsed).toString();
    redirects += 1;
    if (redirects > maxRedirects) {
      throw new Error('Too many redirects');
    }
    current = next;
  }

  throw new Error('Too many redirects');
}

module.exports = {
  safeFetchText,
  assertSafeUrl,
  isPrivateOrLocalIp,
  ALLOWED_CONTENT_TYPES
};
