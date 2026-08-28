<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Вкладка: видимость страниц и блоков по ролям.
-->

<template>
  <div class="roles-tab">
    <p class="tab-lead">{{ t('settings.security.roles.screensLead') }}</p>
    <p v-if="!loaded" class="page-state">{{ t('common.loading') }}</p>
    <form v-else class="roles-form" @submit.prevent="saveMatrix">
      <div class="screens-table-wrap">
        <table class="screens-table">
          <thead>
            <tr>
              <th scope="col">{{ t('settings.security.roles.screenCol') }}</th>
              <th
                v-for="role in roleKeys"
                :key="`head-${role}`"
                scope="col"
              >
                {{ t(`settings.security.roles.${role}`) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in screenGroups" :key="group.id">
              <tr class="group-row">
                <td :colspan="1 + roleKeys.length">
                  {{ t(`settings.security.roles.groups.${group.id}`) }}
                </td>
              </tr>
              <tr v-for="screenKey in group.keys" :key="screenKey">
                <td class="screen-key">
                  <span class="screen-label">{{ screenLabel(screenKey) }}</span>
                </td>
                <td v-for="role in roleKeys" :key="`${role}-${screenKey}`" class="check-cell">
                  <input
                    v-model="matrix[role][screenKey]"
                    type="checkbox"
                    :disabled="isScreenLocked(role, screenKey)"
                    :aria-label="`${t(`settings.security.roles.${role}`)} — ${screenLabel(screenKey)}`"
                  >
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <button type="submit" class="save-btn" :disabled="!loaded || saving">
        {{ saving ? t('common.saving') : t('common.save') }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import api from '@/api/axios';
import {
  SCREEN_GROUPS,
  SCREEN_ROLES,
  EDITOR_LOCKED_SCREENS
} from '@/shared/roleScreenCaps.js';
import { invalidateScreenAccess } from '@/composables/useScreenAccess.js';

const { t, tm } = useI18n();
const loaded = ref(false);
const saving = ref(false);
const roleKeys = SCREEN_ROLES;
const screenGroups = SCREEN_GROUPS;
const matrix = reactive({
  guest: {},
  readonly: {},
  editor: {}
});

function isScreenLocked(role, screenKey) {
  return role === 'editor' && EDITOR_LOCKED_SCREENS.includes(screenKey);
}

function screenLabel(screenKey) {
  const map = tm('settings.security.roles.screens');
  if (map && typeof map === 'object' && typeof map[screenKey] === 'string' && map[screenKey]) {
    return map[screenKey];
  }
  return screenKey;
}

async function loadMatrix() {
  loaded.value = false;
  try {
    const { data } = await api.get('/settings/role-screen-capabilities', {
      headers: { 'Cache-Control': 'no-store' }
    });
    if (!data?.success || !data.data) throw new Error('load failed');
    for (const role of roleKeys) {
      matrix[role] = { ...data.data[role] };
    }
    loaded.value = true;
  } catch (error) {
    console.error('[UserRolesScreensTab] load failed', error);
    ElMessage.error(t('settings.security.roles.loadFailed'));
  }
}

async function saveMatrix() {
  if (!loaded.value || saving.value) return;
  saving.value = true;
  try {
    const { data } = await api.put('/settings/role-screen-capabilities', {
      guest: { ...matrix.guest },
      readonly: { ...matrix.readonly },
      editor: { ...matrix.editor }
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
    if (!data?.success) throw new Error(data?.error || 'save failed');
    for (const role of roleKeys) {
      matrix[role] = { ...data.data[role] };
    }
    invalidateScreenAccess();
    ElMessage.success(t('settings.security.roles.saved'));
  } catch (error) {
    console.error('[UserRolesScreensTab] save failed', error);
    ElMessage.error(t('settings.security.roles.saveFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(loadMatrix);
</script>

<style scoped>
.tab-lead {
  margin: 0 0 1.25rem;
  color: #666;
  line-height: 1.5;
}

.page-state {
  color: #888;
}

.roles-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.screens-table-wrap {
  overflow-x: auto;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  background: #fff;
}

.screens-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}

.screens-table th,
.screens-table td {
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  text-align: left;
  vertical-align: middle;
}

.screens-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #334155;
  position: sticky;
  top: 0;
}

.group-row td {
  background: #f1f5f9;
  font-weight: 600;
  color: var(--color-primary, #1a365d);
}

.screen-key {
  color: #334155;
}

.screen-label {
  color: #334155;
  line-height: 1.35;
}

.check-cell {
  text-align: center;
  width: 5.5rem;
}

.check-cell input {
  width: 16px;
  height: 16px;
}

.save-btn {
  align-self: flex-start;
  padding: 0.65rem 1.4rem;
  border: none;
  border-radius: 8px;
  background: var(--color-primary, #1a365d);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.save-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
