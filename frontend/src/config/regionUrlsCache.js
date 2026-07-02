/**
 * Reactive in-memory cache of region server URLs (loaded from API).
 */

import { reactive } from 'vue';

const cache = reactive({
  regions: [],
  loaded: false,
});

export function setRegionUrlsCache(data = {}) {
  cache.regions = Array.isArray(data.regions) ? [...data.regions] : [];
  cache.loaded = true;
}

export function getRegionUrlsCache() {
  return cache;
}

export function clearRegionUrlsCache() {
  cache.regions = [];
  cache.loaded = false;
}
