<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.

  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <div class="panel settings-subpage page-with-close">
    <PageCloseButton fallback="/settings/security" />
    <h2>{{ t('settings.security.roles.title') }}</h2>
    <p class="page-lead">{{ t('settings.security.roles.description') }}</p>
    <p v-if="!loaded" class="page-state">{{ t('common.loading') }}</p>
    <form v-else class="roles-form" @submit.prevent="saveMatrix">
      <fieldset v-for="role in roleKeys" :key="role" class="role-card">
        <legend>{{ t(`settings.security.roles.${role}`) }}</legend>
        <label v-for="cap in capKeys" :key="cap" class="cap-row">
          <input v-model="matrix[role][cap]" type="checkbox">
          <span>{{ t(`settings.security.roles.${cap}`) }}</span>
        </label>
      </fieldset>
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
import PageCloseButton from '@/components/PageCloseButton.vue';
import { CHAT_CAP_KEYS, CHAT_CAP_ROLES } from '@/shared/chatRoleCaps.js';

const { t } = useI18n();
const loaded = ref(false);
const saving = ref(false);
const roleKeys = CHAT_CAP_ROLES;
const capKeys = CHAT_CAP_KEYS;
const matrix = reactive({
  guest: {},
  readonly: {},
  editor: {}
});

async function loadMatrix() {
  loaded.value = false;
  try {
    const { data } = await api.get('/settings/chat-role-capabilities', {
      headers: { 'Cache-Control': 'no-store' }
    });
    if (!data?.success || !data.data) {
      throw new Error('load failed');
    }
    for (const role of roleKeys) {
      matrix[role] = { ...data.data[role] };
    }
    loaded.value = true;
  } catch (error) {
    console.error('[UserRolesSettingsView] load failed', error);
    ElMessage.error(t('settings.security.roles.loadFailed'));
  }
}

async function saveMatrix() {
  if (!loaded.value || saving.value) return;
  saving.value = true;
  try {
    const { data } = await api.put('/settings/chat-role-capabilities', {
      guest: { ...matrix.guest },
      readonly: { ...matrix.readonly },
      editor: { ...matrix.editor }
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
    if (!data?.success) {
      throw new Error(data?.error || 'save failed');
    }
    for (const role of roleKeys) {
      matrix[role] = { ...data.data[role] };
    }
    ElMessage.success(t('settings.security.roles.saved'));
  } catch (error) {
    console.error('[UserRolesSettingsView] save failed', error);
    ElMessage.error(t('settings.security.roles.saveFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(loadMatrix);
</script>

<style scoped>
.settings-subpage {
  position: relative;
  max-width: 100%;
  box-sizing: border-box;
}

.settings-subpage h2 {
  margin: 0 0 var(--spacing-md, 16px);
  padding-right: 2.5rem;
  color: var(--theme-text, #222);
}

.page-lead {
  margin: 0 0 1.5rem;
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

.role-card {
  margin: 0;
  padding: 1.25rem 1.5rem 1rem;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  background: #fff;
}

.role-card legend {
  padding: 0 0.5rem;
  font-weight: 600;
  color: var(--color-primary, #1a365d);
}

.cap-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0.55rem 0;
  cursor: pointer;
  color: #334155;
}

.cap-row input {
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
