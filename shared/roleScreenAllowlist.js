/**
 * Allowlist экранов по роли ОС (ТЗ §5 P2).
 * Не заменяет PERMISSIONS_MAP: только запрет гостю admin-префиксов.
 * Гость: чат / публичное. Без /settings, /tables, CRM.
 */

const GUEST_DENIED_PREFIXES = Object.freeze([
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

function normalizePath(path) {
  const raw = String(path || '').split('?')[0].split('#')[0];
  if (!raw) return '/';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  if (withSlash.length > 1 && withSlash.endsWith('/')) return withSlash.slice(0, -1);
  return withSlash;
}

function matchesDeniedPrefix(path, prefix) {
  const p = normalizePath(path);
  const pre = normalizePath(prefix);
  return p === pre || p.startsWith(`${pre}/`);
}

function isScreenAllowed(role, path) {
  const r = String(role || 'guest').trim().toLowerCase();
  if (r && r !== 'guest') return true;
  return !GUEST_DENIED_PREFIXES.some((prefix) => matchesDeniedPrefix(path, prefix));
}

module.exports = {
  GUEST_DENIED_PREFIXES,
  normalizePath,
  isScreenAllowed
};
