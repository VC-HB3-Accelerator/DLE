/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Копия shared/roleScreenCaps.js для Vite.
 */

export const SCREEN_ROLES = Object.freeze(['guest', 'readonly', 'editor']);

export const EDITOR_LOCKED_SCREENS = Object.freeze(['/settings/security/roles']);

export const SCREEN_GROUPS = Object.freeze([
  {
    id: 'nav',
    keys: Object.freeze(['/', '/blog', '/blog/feed-settings', '/management', '/crm', '/store'])
  },
  {
    id: 'management',
    keys: Object.freeze([
      '/management/dle',
      '/management/dle-blocks',
      '/management/create-proposal',
      '/management/proposals',
      '/management/modules',
      '/management/analytics',
      '/management/history',
      '/management/settings',
      '/management/add-module',
      '/management/remove-module',
      '/management/transfer-tokens',
      '/management/module-bridge-op',
      '/management/treasury-bridge-op',
      '/management/dle-core-op'
    ])
  },
  {
    id: 'crm_hub',
    keys: Object.freeze([
      '/contacts-list',
      '/content',
      '/vds',
      '/tables',
      '/settings',
      '/groups',
      '/crm/store'
    ])
  },
  {
    id: 'contacts',
    keys: Object.freeze([
      '/contacts-list/parser',
      '/contacts-list/broadcast',
      '/contacts-list/broadcast/agent',
      '/contacts-list/broadcast/analytics',
      '/contacts-list/broadcast/history',
      '/contacts/:id',
      '/contacts/:id/profile',
      '/contacts/:id/conference',
      '/contacts/:id/conference/agent',
      '/contacts/:id/conference/live/:sessionId',
      '/contacts/:id/delete',
      '/conferences',
      '/conferences/schedule',
      '/conferences/:sessionId',
      '/conferences/:sessionId/agent',
      '/conferences/:sessionId/live',
      '/admin-chat/:adminId',
      '/personal-messages',
      '/book-call',
      '/conference/join',
      '/conference/live/:sessionId'
    ])
  },
  {
    id: 'content',
    keys: Object.freeze([
      '/content/create',
      '/content/published',
      '/content/published/:slug',
      '/content/internal',
      '/content/templates',
      '/content/settings',
      '/content/system-messages/table',
      '/content/media',
      '/content/store',
      '/content/store/settings',
      '/content/store/sections',
      '/content/store/sections/new',
      '/content/store/sections/:id',
      '/content/store/product/new',
      '/content/store/product/:id',
      '/content/page/:id',
      '/public/page/:id'
    ])
  },
  {
    id: 'tables',
    keys: Object.freeze([
      '/tables/create',
      '/tables/:id',
      '/tables/:id/edit',
      '/tables/:id/delete'
    ])
  },
  {
    id: 'settings_hub',
    keys: Object.freeze([
      '/settings/ai',
      '/settings/security',
      '/settings/sidebar',
      '/settings/dle-v2-deploy',
      '/settings/interface',
      '/settings/updates'
    ])
  },
  {
    id: 'settings_security',
    keys: Object.freeze([
      '/settings/security/rpc',
      '/settings/security/auth',
      '/settings/security/roles'
    ])
  },
  {
    id: 'settings_sidebar',
    keys: Object.freeze([
      '/settings/sidebar/text',
      '/settings/sidebar/languages',
      '/settings/sidebar/auth',
      '/settings/sidebar/buttons',
      '/settings/sidebar/regions'
    ])
  },
  {
    id: 'settings_ai',
    keys: Object.freeze([
      '/settings/ai/openai',
      '/settings/ai/deepseek',
      '/settings/ai/qwencloud',
      '/settings/ai/vpn',
      '/settings/ai/ollama',
      '/settings/ai/telegram',
      '/settings/ai/email',
      '/settings/ai/database',
      '/settings/ai/rag',
      '/settings/ai/agent-access',
      '/settings/ai/voice-call',
      '/settings/ai/assistant'
    ])
  },
  {
    id: 'settings_server',
    keys: Object.freeze(['/settings/interface/webssh'])
  },
  {
    id: 'store',
    keys: Object.freeze([
      '/store/cart',
      '/store/pay/:id',
      '/store/s/:slug',
      '/store/:id'
    ])
  },
  {
    id: 'other',
    keys: Object.freeze(['/blog/:slug', '/connect-wallet'])
  }
]);

export const SCREEN_KEYS = Object.freeze(
  SCREEN_GROUPS.flatMap((g) => g.keys)
);

export function normalizePath(path) {
  const raw = String(path || '').split('?')[0].split('#')[0];
  if (!raw) return '/';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  if (withSlash.length > 1 && withSlash.endsWith('/')) return withSlash.slice(0, -1);
  return withSlash;
}

export function roleKeyForScreens(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'readonly') return 'readonly';
  if (r === 'editor') return 'editor';
  return 'guest';
}

export function pathMatchesKey(path, key) {
  const pParts = normalizePath(path).split('/');
  const kParts = String(key).split('/');
  if (kParts.length > pParts.length) return false;
  for (let i = 0; i < kParts.length; i += 1) {
    const kp = kParts[i];
    const pp = pParts[i];
    if (kp.startsWith(':')) {
      if (!pp) return false;
      continue;
    }
    if (kp !== pp) return false;
  }
  return true;
}

export function resolveScreenKey(path) {
  const p = normalizePath(path);
  let best = null;
  let bestLen = -1;
  for (const key of SCREEN_KEYS) {
    if (!pathMatchesKey(p, key)) continue;
    const len = String(key).split('/').length;
    if (len > bestLen) {
      best = key;
      bestLen = len;
    }
  }
  return best;
}

function defaultGuestScreens() {
  const out = {};
  for (const key of SCREEN_KEYS) out[key] = false;

  const allowExactOrUnder = [
    '/',
    '/blog',
    '/blog/:slug',
    '/book-call',
    '/conference/join',
    '/connect-wallet',
    '/public/page/:id',
    '/content/published',
    '/content/published/:slug',
    '/store',
    '/store/cart',
    '/store/pay/:id',
    '/store/s/:slug',
    '/store/:id',
    '/management',
    '/management/dle',
    '/management/dle-blocks',
    '/management/create-proposal',
    '/management/proposals',
    '/management/modules',
    '/management/analytics',
    '/management/history',
    '/management/settings',
    '/management/add-module',
    '/management/remove-module',
    '/management/transfer-tokens',
    '/management/module-bridge-op',
    '/management/treasury-bridge-op',
    '/management/dle-core-op',
    '/crm',
    '/settings',
    '/settings/security',
    '/settings/ai',
    '/content'
  ];
  for (const key of allowExactOrUnder) {
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = true;
  }
  return out;
}

function defaultFullAccessScreens() {
  const out = {};
  for (const key of SCREEN_KEYS) out[key] = true;
  return out;
}

export function cloneDefaultScreens(role) {
  const key = roleKeyForScreens(role);
  if (key === 'guest') return defaultGuestScreens();
  return defaultFullAccessScreens();
}

export function normalizeScreensMap(rowScreens, role) {
  const base = cloneDefaultScreens(role);
  if (!rowScreens || typeof rowScreens !== 'object') return base;
  for (const key of SCREEN_KEYS) {
    if (rowScreens[key] === false) base[key] = false;
    else if (rowScreens[key] === true) base[key] = true;
  }
  if (roleKeyForScreens(role) === 'editor') {
    for (const locked of EDITOR_LOCKED_SCREENS) {
      if (Object.prototype.hasOwnProperty.call(base, locked)) base[locked] = true;
    }
  }
  return base;
}

export function isScreenAllowedByMap(screensMap, path) {
  const key = resolveScreenKey(path);
  if (!key) return true;
  if (!screensMap || typeof screensMap !== 'object') return true;
  return screensMap[key] !== false;
}

export function validateScreensMatrix(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'INVALID_SCREEN_CAPS' };
  }
  const data = {};
  for (const role of SCREEN_ROLES) {
    const block = body[role];
    if (!block || typeof block !== 'object') {
      return { ok: false, error: 'INVALID_SCREEN_CAPS' };
    }
    const normalized = {};
    for (const key of SCREEN_KEYS) {
      if (typeof block[key] !== 'boolean') {
        return { ok: false, error: 'INVALID_SCREEN_CAPS' };
      }
      normalized[key] = block[key];
    }
    if (role === 'editor') {
      for (const locked of EDITOR_LOCKED_SCREENS) {
        normalized[locked] = true;
      }
    }
    data[role] = normalized;
  }
  return { ok: true, data };
}

export function buildDefaultMatrix() {
  return {
    guest: cloneDefaultScreens('guest'),
    readonly: cloneDefaultScreens('readonly'),
    editor: cloneDefaultScreens('editor')
  };
}
