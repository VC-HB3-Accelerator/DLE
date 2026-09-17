/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Кэш матрицы видимости экранов для текущей роли (guest / user / readonly / editor).
 */

import { computed, ref } from 'vue';
import api from '@/api/axios';
import { isScreenAllowed, roleKeyForScreens } from '@/shared/roleScreenAllowlist.js';
import { cloneDefaultScreens, resolveScreenKey } from '@/shared/roleScreenCaps.js';
import { userId as sessionUserId } from '@/composables/useAuth';

/** Как backend USER_OWN_WORKSPACE: приватные чаты нельзя выключить устаревшей матрицей. */
const PRIVATE_CHAT_SCREEN_KEYS = Object.freeze([
  '/personal-messages',
  '/admin-chat/:adminId'
]);

function fallbackScreenRole() {
  try {
    // eslint-disable-next-line global-require, import/no-cycle
    const auth = require('./useAuth.js');
    if (!auth.isAuthenticated?.value) return 'guest';
    const level = String(auth.userAccessLevel?.value?.level || '').toLowerCase();
    if (level === 'editor' || level === 'readonly' || level === 'user') return level;
    if (auth.userId?.value) return 'user';
    return 'guest';
  } catch {
    return sessionUserId?.value ? 'user' : 'guest';
  }
}

function withPrivateChatScreens(roleKey, map) {
  if (!map || typeof map !== 'object' || roleKey === 'guest') return map;
  const next = { ...map };
  for (const key of PRIVATE_CHAT_SCREEN_KEYS) {
    next[key] = true;
  }
  return next;
}

function isPrivateChatPath(path) {
  const key = resolveScreenKey(path);
  return PRIVATE_CHAT_SCREEN_KEYS.includes(key);
}

const screens = ref(null);
const role = ref('guest');
const loaded = ref(false);
let inflight = null;

export function invalidateScreenAccess() {
  screens.value = null;
  loaded.value = false;
  inflight = null;
}

export async function ensureScreenAccessLoaded(force = false) {
  if (!force && loaded.value && screens.value) {
    screens.value = withPrivateChatScreens(role.value, screens.value);
    return { role: role.value, screens: screens.value };
  }
  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      const { data } = await api.get('/settings/my-screen-access', {
        headers: { 'Cache-Control': 'no-store' }
      });
      if (data?.success && data.data?.screens) {
        role.value = roleKeyForScreens(data.data.role);
        screens.value = withPrivateChatScreens(role.value, data.data.screens);
      } else {
        const key = fallbackScreenRole();
        role.value = key;
        screens.value = withPrivateChatScreens(key, cloneDefaultScreens(key));
      }
    } catch (err) {
      console.warn('[useScreenAccess] fallback defaults', err?.message || err);
      const key = fallbackScreenRole();
      role.value = key;
      screens.value = withPrivateChatScreens(key, cloneDefaultScreens(key));
    } finally {
      loaded.value = true;
      inflight = null;
    }
    return { role: role.value, screens: screens.value };
  })();

  return inflight;
}

/** Если роль сессии сменилась (login/logout) — перечитать матрицу. */
export async function syncScreenAccessRole(nextRole) {
  const key = roleKeyForScreens(nextRole);
  if (loaded.value && role.value === key && screens.value) {
    screens.value = withPrivateChatScreens(role.value, screens.value);
    return { role: role.value, screens: screens.value };
  }
  invalidateScreenAccess();
  return ensureScreenAccessLoaded(true);
}

export function canAccessPath(path) {
  // Устаревший кэш матрицы мог держать admin-chat=false у user — приватный чат всё равно доступен.
  if (role.value !== 'guest' && isPrivateChatPath(path)) {
    return true;
  }
  return isScreenAllowed(role.value, path, screens.value);
}

export function useScreenAccess() {
  return {
    role: computed(() => role.value),
    screens: computed(() => screens.value),
    loaded: computed(() => loaded.value),
    ensureScreenAccessLoaded,
    invalidateScreenAccess,
    syncScreenAccessRole,
    canAccessPath
  };
}
