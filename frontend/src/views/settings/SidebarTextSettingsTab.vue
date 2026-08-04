<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="sidebar-text-tab">
    <p class="sidebar-text-tab__intro">{{ t('settings.sidebarNotice.intro') }}</p>

    <form class="sidebar-text-tab__form" @submit.prevent="handleSave">
      <label class="sidebar-text-tab__field">
        <span class="form-label">{{ t('settings.sidebarNotice.textLabel') }}</span>
        <textarea
          v-model="body"
          class="form-control"
          rows="8"
          :placeholder="t('settings.sidebarNotice.textPlaceholder')"
          :disabled="isSaving"
          maxlength="4000"
        />
        <span class="form-hint">{{ t('settings.sidebarNotice.textHint') }}</span>
      </label>

      <div class="sidebar-text-tab__fixed-link">
        <span class="form-label">{{ t('settings.sidebarNotice.fixedLinkLabel') }}</span>
        <a
          class="sidebar-text-tab__privacy"
          :href="privacyDocsUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('settings.sidebarNotice.privacyLink') }}
        </a>
        <span class="form-hint">{{ t('settings.sidebarNotice.fixedLinkHint') }}</span>
      </div>

      <p v-if="saveError" class="alert alert-danger">{{ saveError }}</p>
      <p v-if="saveSuccess" class="alert alert-success">{{ saveSuccess }}</p>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="isSaving">
          {{ isSaving ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthContext } from '@/composables/useAuth';
import { fetchSidebarNotice, saveSidebarNotice } from '@/services/sidebarNoticeService';
import { getPrivacyDocsUrl } from '@/constants/publishedDocs';

const { t } = useI18n();
const { checkAuth, checkUserAccessLevel, address, isAuthenticated } = useAuthContext();

const body = ref('');
const isSaving = ref(false);
const saveError = ref('');
const saveSuccess = ref('');
const privacyDocsUrl = getPrivacyDocsUrl();

function formatSaveError(error) {
  const data = error.response?.data;
  if (typeof data?.error === 'string') return data.error;
  if (data?.error?.message) return data.error.message;
  if (data?.message) return data.message;
  return error.message || t('settings.sidebarNotice.saveError');
}

async function loadSettings() {
  try {
    const data = await fetchSidebarNotice();
    body.value = data.body || '';
  } catch (error) {
    console.error('[SidebarTextTab] load failed:', error);
    saveError.value = t('settings.sidebarNotice.loadError');
  }
}

async function handleSave() {
  isSaving.value = true;
  saveError.value = '';
  saveSuccess.value = '';
  try {
    const data = await saveSidebarNotice(body.value);
    body.value = data.body || '';
    saveSuccess.value = t('settings.sidebarNotice.saved');
  } catch (error) {
    saveError.value = formatSaveError(error);
  } finally {
    isSaving.value = false;
  }
}

async function initPage() {
  await checkAuth();
  if (isAuthenticated.value && address.value) {
    await checkUserAccessLevel(address.value);
  }
  await loadSettings();
}

watch(
  () => isAuthenticated.value,
  (authenticated) => {
    if (authenticated) loadSettings();
  }
);

onMounted(initPage);
</script>

<style scoped>
.sidebar-text-tab__intro {
  margin: 0 0 var(--spacing-lg);
  color: var(--color-text-light);
  line-height: 1.5;
  max-width: 720px;
}

.sidebar-text-tab__form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 720px;
}

.sidebar-text-tab__field,
.sidebar-text-tab__fixed-link {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.sidebar-text-tab__privacy {
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: underline;
  width: fit-content;
}

@media (max-width: 768px) {
  .sidebar-text-tab, .settings-panel {
    max-width: 100%;
    box-sizing: border-box;
  }
}
</style>
