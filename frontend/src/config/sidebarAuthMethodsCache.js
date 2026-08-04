/**
 * Reactive cache: guest auth methods for sidebar picker.
 */

import { reactive } from 'vue';

const DEFAULT = Object.freeze({
  wallet: true,
  telegram: false,
  email: false,
  password: false,
});

const cache = reactive({
  methods: { ...DEFAULT },
  loaded: false,
});

export function setSidebarAuthMethodsCache(authMethods) {
  const src = authMethods && typeof authMethods === 'object' ? authMethods : {};
  cache.methods = {
    wallet: true,
    telegram: Boolean(src.telegram),
    email: Boolean(src.email),
    password: Boolean(src.password),
  };
  cache.loaded = true;
}

export function getSidebarAuthMethodsCache() {
  return cache;
}

export function clearSidebarAuthMethodsCache() {
  cache.methods = { ...DEFAULT };
  cache.loaded = false;
}
