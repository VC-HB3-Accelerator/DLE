/**
 * Reactive cache of enabled UI locales from sidebar-nav settings.
 */

import { reactive } from 'vue';
import { SUPPORTED } from '../locales';

const cache = reactive({
  locales: [...SUPPORTED],
  loaded: false,
});

export function setEnabledLocalesCache(locales) {
  const list = Array.isArray(locales)
    ? locales.map((code) => String(code || '').trim().toLowerCase()).filter((code) => SUPPORTED.includes(code))
    : [];
  cache.locales = list.length ? list : [...SUPPORTED];
  cache.loaded = true;
}

export function getEnabledLocalesCache() {
  return cache;
}

export function clearEnabledLocalesCache() {
  cache.locales = [...SUPPORTED];
  cache.loaded = false;
}
