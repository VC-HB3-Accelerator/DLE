/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Кэш прав на действия для текущей роли (overlay над PERMISSIONS_MAP).
 */

import { computed, ref } from 'vue';
import api from '@/api/axios';
import {
  roleKeyForActions,
  cloneDefaultActions,
  hasActionPermission
} from '@/shared/roleActionCaps.js';
import { hasPermission as hasPermissionDefault } from '@/shared/permissions.js';

const actions = ref(null);
const role = ref('guest');
const loaded = ref(false);
let inflight = null;

export function invalidateActionAccess() {
  actions.value = null;
  loaded.value = false;
  inflight = null;
}

export async function ensureActionAccessLoaded(force = false) {
  if (!force && loaded.value && actions.value) {
    return { role: role.value, actions: actions.value };
  }
  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      const { data } = await api.get('/settings/my-action-access', {
        headers: { 'Cache-Control': 'no-store' }
      });
      if (data?.success && data.data?.actions) {
        role.value = roleKeyForActions(data.data.role);
        actions.value = data.data.actions;
      } else {
        role.value = 'guest';
        actions.value = cloneDefaultActions('guest');
      }
    } catch (err) {
      console.warn('[useActionAccess] fallback defaults', err?.message || err);
      role.value = 'guest';
      actions.value = cloneDefaultActions('guest');
    } finally {
      loaded.value = true;
      inflight = null;
    }
    return { role: role.value, actions: actions.value };
  })();

  return inflight;
}

export async function syncActionAccessRole(nextRole) {
  const key = roleKeyForActions(nextRole);
  if (loaded.value && role.value === key && actions.value) {
    return { role: role.value, actions: actions.value };
  }
  invalidateActionAccess();
  return ensureActionAccessLoaded(true);
}

export function hasActionAccess(permission) {
  if (actions.value) {
    return hasActionPermission(actions.value, permission);
  }
  return hasPermissionDefault(role.value, permission);
}

export function useActionAccess() {
  return {
    role: computed(() => role.value),
    actions: computed(() => actions.value),
    loaded: computed(() => loaded.value),
    ensureActionAccessLoaded,
    invalidateActionAccess,
    syncActionAccessRole,
    hasActionAccess
  };
}
