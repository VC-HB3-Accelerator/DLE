/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Копия shared/roleScreenAllowlist.js для Vite. ТЗ §5 P2.
 */

export const GUEST_DENIED_PREFIXES = Object.freeze([
  '/settings',
  '/tables',
  '/crm',
  '/smartcontracts',
  '/management',
  '/vds',
  '/webssh',
  '/content/internal',
  '/content/system-messages'
]);

export const GUEST_ALLOWED_EXACT = Object.freeze([
  '/management',
  '/crm',
  '/settings',
  '/settings/security',
  '/settings/ai',
  '/content/published'
]);

export function normalizePath(path) {
  const raw = String(path || '').split('?')[0].split('#')[0];
  if (!raw) return '/';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  if (withSlash.length > 1 && withSlash.endsWith('/')) return withSlash.slice(0, -1);
  return withSlash;
}

function matchesDeniedPrefix(path, prefix) {
  const p = normalizePath(path);
  const pre = normalizePath(prefix);
  if (pre === '/management' && p === '/management') {
    return false;
  }
  return p === pre || p.startsWith(`${pre}/`);
}

export function isScreenAllowed(role, path) {
  const r = String(role || 'guest').trim().toLowerCase();
  if (r && r !== 'guest') return true;
  const p = normalizePath(path);
  if (GUEST_ALLOWED_EXACT.includes(p)) return true;
  return !GUEST_DENIED_PREFIXES.some((prefix) => matchesDeniedPrefix(path, prefix));
}
