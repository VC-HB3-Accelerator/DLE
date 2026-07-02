/**
 * Конфигурация региональных ячеек (отдельные VDS / субдомены).
 * Переопределение через VITE_REGION_RU_URL и VITE_REGION_EN_URL.
 */

import { getRegionUrlsCache } from './regionUrlsCache.js';

export const REGIONS = [
  {
    id: 'ru',
    labelKey: 'region.ru',
    subdomain: 'ru',
  },
  {
    id: 'en',
    labelKey: 'region.en',
    subdomain: 'en',
  },
];

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1']);

function stripWww(hostname) {
  return hostname.replace(/^www\./, '');
}

/**
 * Базовый домен без регионального префикса (hb3-accelerator.com).
 */
export function getBaseDomain(hostname = typeof window !== 'undefined' ? window.location.hostname : '') {
  if (LOCALHOST_HOSTS.has(hostname)) {
    return hostname;
  }
  const parts = stripWww(hostname).split('.');
  if (parts.length >= 3 && (parts[0] === 'ru' || parts[0] === 'en')) {
    return parts.slice(1).join('.');
  }
  return stripWww(hostname);
}

function detectLegacyRegion(hostname) {
  const fromEnv = import.meta.env.VITE_DEFAULT_REGION;
  if (LOCALHOST_HOSTS.has(hostname)) {
    return fromEnv === 'en' ? 'en' : 'ru';
  }
  const sub = stripWww(hostname).split('.')[0];
  if (sub === 'ru' || sub === 'en') {
    return sub;
  }
  return fromEnv === 'en' ? 'en' : 'ru';
}

function getCurrentOrigin() {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return new URL(window.location.href).origin.replace(/\/$/, '');
  } catch {
    return '';
  }
}

/**
 * Текущий регион по URL из настроек, hostname или VITE_DEFAULT_REGION.
 */
export function detectCurrentRegion(hostname = typeof window !== 'undefined' ? window.location.hostname : '') {
  const cached = getRegionUrlsCache();
  if (cached.regions?.length) {
    const currentOrigin = getCurrentOrigin();
    if (currentOrigin) {
      const match = cached.regions.find((region) => {
        try {
          return new URL(region.url).origin.replace(/\/$/, '') === currentOrigin;
        } catch {
          return false;
        }
      });
      if (match) {
        return match.id;
      }
    }
    return cached.regions[0].id;
  }

  return detectLegacyRegion(hostname);
}

/**
 * Список серверов для переключателя в шапке (только из настроек).
 */
export function getRegionSwitcherList() {
  const cached = getRegionUrlsCache();
  if (!cached.regions?.length) {
    return [];
  }

  return cached.regions.map((region) => ({
    id: region.id,
    label: region.label,
    url: region.url,
  }));
}

/**
 * URL региональной ячейки.
 */
export function getRegionUrl(regionId, hostname = typeof window !== 'undefined' ? window.location.hostname : '') {
  const cached = getRegionUrlsCache();
  if (cached.regions?.length) {
    const found = cached.regions.find((region) => region.id === regionId);
    if (found?.url) {
      return found.url.replace(/\/$/, '');
    }
  }

  const envKey = regionId === 'ru' ? 'VITE_REGION_RU_URL' : 'VITE_REGION_EN_URL';
  const fromEnv = import.meta.env[envKey];
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  const port = typeof window !== 'undefined' ? window.location.port : '';

  if (LOCALHOST_HOSTS.has(hostname)) {
    const portSuffix = port ? `:${port}` : '';
    return `${protocol}//${hostname}${portSuffix}`;
  }

  const base = getBaseDomain(hostname);
  const portSuffix = port && !['80', '443'].includes(port) ? `:${port}` : '';
  return `${protocol}//${regionId}.${base}${portSuffix}`;
}
