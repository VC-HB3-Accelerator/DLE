/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * BlancVPN / VLESS subscription → Xray config + локальный SOCKS для OpenAI.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const CONFIG_DIR = process.env.BLANC_XRAY_CONFIG_DIR || '/app/blanc-xray-data';
const SOCKS_URL = process.env.BLANC_XRAY_SOCKS_URL || 'socks5://dapp-blanc-xray:1080';
const SUB_FILE = 'subscription.url';
const CONFIG_FILE = 'config.json';
const META_FILE = 'meta.json';

function getConfigDir() {
  return CONFIG_DIR;
}

function getSocksUrl() {
  return SOCKS_URL;
}

function isBlancSubscriptionUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  if (/^vless:\/\//i.test(s) || /^ss:\/\//i.test(s)) return true;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function assertBlancSubscriptionUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) {
    const err = new Error('Укажите ссылку подписки BlancVPN');
    err.status = 400;
    throw err;
  }
  if (!isBlancSubscriptionUrl(s)) {
    const err = new Error('Ожидается https://…/s/… (Blanc), vless:// или ss://');
    err.status = 400;
    throw err;
  }
  return s;
}

function decodeSubscriptionBody(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  let decoded = raw;
  try {
    if (!/^vless:\/\//i.test(raw) && !/^ss:\/\//i.test(raw) && !raw.includes('\n')) {
      decoded = Buffer.from(raw, 'base64').toString('utf8');
    }
  } catch {
    decoded = raw;
  }
  return decoded
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function parseVlessUri(uri) {
  const u = new URL(uri);
  if (u.protocol !== 'vless:') return null;
  const uuid = decodeURIComponent(u.username || '');
  const address = u.hostname;
  const port = Number(u.port || 443);
  if (!uuid || !address || !port) return null;

  const q = u.searchParams;
  const security = (q.get('security') || 'none').toLowerCase();
  const network = (q.get('type') || 'tcp').toLowerCase();
  const flow = q.get('flow') || undefined;
  const encryption = q.get('encryption') || 'none';
  const name = decodeURIComponent(u.hash.replace(/^#/, '') || '');

  const streamSettings = {
    network,
    security: security === 'reality' || security === 'tls' ? security : 'none'
  };

  if (network === 'ws') {
    streamSettings.wsSettings = {
      path: q.get('path') || '/',
      headers: q.get('host') ? { Host: q.get('host') } : undefined
    };
  }
  if (network === 'grpc') {
    streamSettings.grpcSettings = {
      serviceName: q.get('serviceName') || q.get('service_name') || ''
    };
  }

  if (security === 'reality') {
    streamSettings.realitySettings = {
      serverName: q.get('sni') || q.get('serverName') || address,
      fingerprint: q.get('fp') || 'chrome',
      publicKey: q.get('pbk') || '',
      shortId: q.get('sid') || '',
      spiderX: q.get('spx') || ''
    };
  } else if (security === 'tls') {
    streamSettings.tlsSettings = {
      serverName: q.get('sni') || address,
      fingerprint: q.get('fp') || 'chrome',
      allowInsecure: q.get('allowInsecure') === '1'
    };
  }

  return {
    protocol: 'vless',
    name,
    address,
    port,
    uuid,
    encryption,
    flow,
    streamSettings
  };
}

function parseSsUri(uri) {
  // ss://BASE64(method:password)@host:port#name  OR ss://BASE64(method:password@host:port)
  try {
    const hashIdx = uri.indexOf('#');
    const name = hashIdx >= 0 ? decodeURIComponent(uri.slice(hashIdx + 1)) : '';
    const main = hashIdx >= 0 ? uri.slice(0, hashIdx) : uri;
    const withoutScheme = main.replace(/^ss:\/\//i, '');

    let method;
    let password;
    let address;
    let port;

    if (withoutScheme.includes('@')) {
      const [userInfo, hostPart] = withoutScheme.split('@');
      let decodedUser = userInfo;
      try {
        decodedUser = Buffer.from(userInfo, 'base64').toString('utf8');
      } catch {
        /* keep */
      }
      const colon = decodedUser.indexOf(':');
      method = decodedUser.slice(0, colon);
      password = decodedUser.slice(colon + 1);
      const hostUrl = new URL(`ss://dummy@${hostPart}`);
      address = hostUrl.hostname;
      port = Number(hostUrl.port || 443);
    } else {
      const decoded = Buffer.from(withoutScheme, 'base64').toString('utf8');
      const m = decoded.match(/^(.+?):(.+)@(.+):(\d+)$/);
      if (!m) return null;
      method = m[1];
      password = m[2];
      address = m[3];
      port = Number(m[4]);
    }

    if (!method || !password || !address || !port) return null;
    return {
      protocol: 'shadowsocks',
      name,
      address,
      port,
      method,
      password
    };
  } catch {
    return null;
  }
}

function parseNodeUri(uri) {
  if (/^vless:\/\//i.test(uri)) return parseVlessUri(uri);
  if (/^ss:\/\//i.test(uri)) return parseSsUri(uri);
  return null;
}

function pickPreferredNode(nodes) {
  if (!nodes.length) return null;
  const prefer = [/frankfurt|франкфурт|germany|герман/i, /netherlands|нидерл|amsterdam/i, /extra/i];
  for (const re of prefer) {
    const found = nodes.find((n) => re.test(n.name || ''));
    if (found) return found;
  }
  return nodes[0];
}

function buildXrayConfig(node) {
  let outbound;
  if (node.protocol === 'vless') {
    const user = {
      id: node.uuid,
      encryption: node.encryption || 'none'
    };
    if (node.flow) user.flow = node.flow;
    outbound = {
      tag: 'proxy',
      protocol: 'vless',
      settings: {
        vnext: [
          {
            address: node.address,
            port: node.port,
            users: [user]
          }
        ]
      },
      streamSettings: node.streamSettings
    };
  } else if (node.protocol === 'shadowsocks') {
    outbound = {
      tag: 'proxy',
      protocol: 'shadowsocks',
      settings: {
        servers: [
          {
            address: node.address,
            port: node.port,
            method: node.method,
            password: node.password
          }
        ]
      }
    };
  } else {
    throw new Error('Неподдерживаемый тип узла');
  }

  return {
    log: { loglevel: 'warning' },
    inbounds: [
      {
        tag: 'socks-in',
        listen: '0.0.0.0',
        port: 1080,
        protocol: 'socks',
        settings: { udp: true, auth: 'noauth' }
      }
    ],
    outbounds: [
      outbound,
      { tag: 'direct', protocol: 'freedom' },
      { tag: 'block', protocol: 'blackhole' }
    ],
    routing: {
      domainStrategy: 'AsIs',
      rules: [{ type: 'field', outboundTag: 'proxy', network: 'tcp,udp' }]
    }
  };
}

async function fetchSubscriptionLinks(subscriptionUrl) {
  const url = assertBlancSubscriptionUrl(subscriptionUrl);
  if (/^vless:\/\//i.test(url) || /^ss:\/\//i.test(url)) {
    return [url];
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': 'DLE-BlancXray/1.0' },
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) {
    const err = new Error(`Не удалось скачать подписку BlancVPN (HTTP ${res.status})`);
    err.status = 502;
    throw err;
  }
  const text = await res.text();
  return decodeSubscriptionBody(text);
}

async function resolveNodeFromSubscription(subscriptionUrl) {
  const links = await fetchSubscriptionLinks(subscriptionUrl);
  const nodes = links.map(parseNodeUri).filter(Boolean);
  if (!nodes.length) {
    const err = new Error('В подписке нет рабочих vless:// / ss:// узлов');
    err.status = 400;
    throw err;
  }
  const node = pickPreferredNode(nodes);
  return { node, total: nodes.length };
}

function ensureConfigDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/**
 * Пишет subscription.url + config.json для контейнера dapp-blanc-xray.
 */
async function applySubscription(subscriptionUrl) {
  const { node, total } = await resolveNodeFromSubscription(subscriptionUrl);
  const config = buildXrayConfig(node);
  ensureConfigDir();

  const subPath = path.join(CONFIG_DIR, SUB_FILE);
  const cfgPath = path.join(CONFIG_DIR, CONFIG_FILE);
  const metaPath = path.join(CONFIG_DIR, META_FILE);

  fs.writeFileSync(subPath, `${String(subscriptionUrl).trim()}\n`, 'utf8');
  fs.writeFileSync(cfgPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    metaPath,
    `${JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        protocol: node.protocol,
        name: node.name || null,
        address: node.address,
        port: node.port,
        nodesTotal: total,
        socksUrl: SOCKS_URL
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  // Триггер перечитывания entrypoint (mtime)
  try {
    fs.writeFileSync(path.join(CONFIG_DIR, 'reload.flag'), `${Date.now()}\n`);
  } catch (e) {
    logger.warn('[blancVpn] reload.flag:', e.message);
  }

  logger.info('[blancVpn] Xray config updated', {
    protocol: node.protocol,
    name: node.name,
    host: node.address,
    nodesTotal: total
  });

  return {
    socksUrl: SOCKS_URL,
    node: {
      protocol: node.protocol,
      name: node.name,
      address: node.address,
      port: node.port
    },
    nodesTotal: total
  };
}

function readMeta() {
  try {
    const p = path.join(CONFIG_DIR, META_FILE);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  getConfigDir,
  getSocksUrl,
  isBlancSubscriptionUrl,
  assertBlancSubscriptionUrl,
  decodeSubscriptionBody,
  parseNodeUri,
  pickPreferredNode,
  buildXrayConfig,
  fetchSubscriptionLinks,
  resolveNodeFromSubscription,
  applySubscription,
  readMeta
};
