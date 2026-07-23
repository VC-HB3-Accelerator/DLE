/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Исходящий прокси для OpenAI: BlancVPN (SOCKS через Xray) или ручной HTTP/SOCKS.
 */

const OpenAI = require('openai');
const { ProxyAgent, fetch: undiciFetch } = require('undici');
const logger = require('../utils/logger');
const blancVpnService = require('./blancVpnService');

function normalizeProxyUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    return `http://${s}`;
  }
  return s;
}

function hasBlanc(settings) {
  return Boolean(settings?.proxy_enabled)
    && Boolean(String(settings?.blanc_subscription_url || '').trim());
}

function hasManualProxy(settings) {
  return Boolean(settings?.proxy_enabled)
    && Boolean(String(settings?.proxy_url || '').trim())
    && !blancVpnService.isBlancSubscriptionUrl(settings.proxy_url);
}

function isProxyEnabled(settings) {
  return hasBlanc(settings) || hasManualProxy(settings);
}

function resolveOutboundProxyUrl(settings) {
  if (hasBlanc(settings)) {
    return blancVpnService.getSocksUrl();
  }
  if (hasManualProxy(settings)) {
    return assertManualProxyUrl(settings.proxy_url);
  }
  return null;
}

function assertManualProxyUrl(raw) {
  const proxyUrl = normalizeProxyUrl(raw);
  if (!proxyUrl) {
    const err = new Error('Укажите URL прокси');
    err.status = 400;
    throw err;
  }
  let parsed;
  try {
    parsed = new URL(proxyUrl);
  } catch {
    const err = new Error('Некорректный URL прокси');
    err.status = 400;
    throw err;
  }
  const proto = parsed.protocol.replace(':', '').toLowerCase();
  const allowed = new Set(['http', 'https', 'socks', 'socks4', 'socks5', 'socks5h']);
  if (!allowed.has(proto)) {
    const err = new Error('Прокси: только http(s):// или socks5://');
    err.status = 400;
    throw err;
  }
  if (!parsed.hostname) {
    const err = new Error('В URL прокси нет хоста');
    err.status = 400;
    throw err;
  }
  return proxyUrl;
}

function isSocks(proxyUrl) {
  const proto = new URL(proxyUrl).protocol.replace(':', '').toLowerCase();
  return proto.startsWith('socks');
}

function buildSocksAgent(proxyUrl) {
  // eslint-disable-next-line global-require
  const { SocksProxyAgent } = require('socks-proxy-agent');
  return new SocksProxyAgent(proxyUrl);
}

function applyProxyToOpenAIOpts(opts, proxyUrl) {
  if (isSocks(proxyUrl)) {
    opts.httpAgent = buildSocksAgent(proxyUrl);
  } else {
    const dispatcher = new ProxyAgent(proxyUrl);
    opts.fetch = (url, init = {}) => undiciFetch(url, { ...init, dispatcher });
  }
}

/**
 * OpenAI SDK-клиент с опциональным прокси из ai_providers_settings.
 */
function createOpenAIClient(settings, extra = {}) {
  if (!settings?.api_key) {
    const err = new Error('OpenAI API key не настроен');
    err.status = 400;
    err.code = 'OPENAI_KEY_MISSING';
    throw err;
  }

  const opts = {
    apiKey: settings.api_key,
    baseURL: settings.base_url || undefined,
    ...extra
  };

  const proxyUrl = resolveOutboundProxyUrl(settings);
  if (proxyUrl) {
    applyProxyToOpenAIOpts(opts, proxyUrl);
    logger.info('[openaiProxy] OpenAI client via proxy', {
      mode: hasBlanc(settings) ? 'blanc' : 'manual',
      protocol: new URL(proxyUrl).protocol,
      host: new URL(proxyUrl).host
    });
  }

  return new OpenAI(opts);
}

/**
 * fetch с тем же прокси (Realtime и прочие прямые HTTP-вызовы).
 */
async function proxiedFetch(url, init, settings) {
  const proxyUrl = resolveOutboundProxyUrl(settings);
  if (!proxyUrl) {
    return fetch(url, init);
  }

  if (isSocks(proxyUrl)) {
    // eslint-disable-next-line global-require
    const nodeFetch = require('node-fetch');
    return nodeFetch(url, { ...init, agent: buildSocksAgent(proxyUrl) });
  }

  const dispatcher = new ProxyAgent(proxyUrl);
  return undiciFetch(url, { ...init, dispatcher });
}

module.exports = {
  normalizeProxyUrl,
  isProxyEnabled,
  assertProxyUrl: assertManualProxyUrl,
  assertManualProxyUrl,
  resolveOutboundProxyUrl,
  createOpenAIClient,
  proxiedFetch
};
