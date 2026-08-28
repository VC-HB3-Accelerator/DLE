/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Кэш матрицы видимости экранов для текущей роли (guest / readonly / editor).
 */

import { computed, ref } from 'vue';
import api from '@/api/axios';
import { isScreenAllowed, roleKeyForScreens } from '@/shared/roleScreenAllowlist.js';
import { cloneDefaultScreens } from '@/shared/roleScreenCaps.js';

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
        screens.value = data.data.screens;
      } else {
        role.value = 'guest';
        screens.value = cloneDefaultScreens('guest');
      }
    } catch (err) {
      console.warn('[useScreenAccess] fallback defaults', err?.message || err);
      role.value = 'guest';
      screens.value = cloneDefaultScreens('guest');
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
    return { role: role.value, screens: screens.value };
  }
  invalidateScreenAccess();
  return ensureScreenAccessLoaded(true);
}

export function canAccessPath(path) {
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
