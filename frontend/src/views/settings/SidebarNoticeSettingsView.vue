<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="sidebar-notice-settings settings-panel">
    <button class="close-btn" type="button" @click="router.push('/settings')">×</button>
    <h2>{{ t('settings.sidebarNotice.pageTitle') }}</h2>
    <p class="sidebar-notice-settings__intro">{{ t('settings.sidebarNotice.intro') }}</p>

    <form class="sidebar-notice-settings__form" @submit.prevent="handleSave">
      <label class="sidebar-notice-settings__field">
        <span class="sidebar-notice-settings__label">{{ t('settings.sidebarNotice.textLabel') }}</span>
        <textarea
          v-model="body"
          class="sidebar-notice-settings__textarea"
          rows="8"
          :placeholder="t('settings.sidebarNotice.textPlaceholder')"
          :disabled="isSaving"
          maxlength="4000"
        />
        <span class="sidebar-notice-settings__hint">{{ t('settings.sidebarNotice.textHint') }}</span>
      </label>

      <div class="sidebar-notice-settings__fixed-link">
        <span class="sidebar-notice-settings__label">{{ t('settings.sidebarNotice.fixedLinkLabel') }}</span>
        <a
          class="sidebar-notice-settings__privacy"
          :href="privacyDocsUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('settings.sidebarNotice.privacyLink') }}
        </a>
        <span class="sidebar-notice-settings__hint">{{ t('settings.sidebarNotice.fixedLinkHint') }}</span>
      </div>

      <p v-if="saveError" class="sidebar-notice-settings__error">{{ saveError }}</p>
      <p v-if="saveSuccess" class="sidebar-notice-settings__success">{{ saveSuccess }}</p>

      <div class="sidebar-notice-settings__actions">
        <button type="submit" class="sidebar-notice-settings__save" :disabled="isSaving">
          {{ isSaving ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthContext } from '@/composables/useAuth';
import { fetchSidebarNotice, saveSidebarNotice } from '@/services/sidebarNoticeService';
import { getPrivacyDocsUrl } from '@/constants/publishedDocs';

const { t } = useI18n();
const router = useRouter();
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
    console.error('[SidebarNoticeSettingsView] load failed:', error);
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
.sidebar-notice-settings {
  position: relative;
  padding: var(--block-padding, 1.5rem);
  background-color: var(--color-light, #f8f9fa);
  border-radius: var(--radius-md, 12px);
  margin-top: var(--spacing-lg, 1.5rem);
}

.sidebar-notice-settings__intro {
  margin: 0 0 1.5rem;
  color: #6c757d;
  line-height: 1.5;
  max-width: 720px;
}

.sidebar-notice-settings__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 720px;
}

.sidebar-notice-settings__field,
.sidebar-notice-settings__fixed-link {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar-notice-settings__label {
  font-weight: 600;
  color: #343a40;
  font-size: 0.95rem;
}

.sidebar-notice-settings__textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem 1rem;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font: inherit;
  line-height: 1.5;
  resize: vertical;
  min-height: 140px;
  background: #fff;
}

.sidebar-notice-settings__textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.15);
}

.sidebar-notice-settings__hint {
  font-size: 0.85rem;
  color: #6c757d;
  line-height: 1.4;
}

.sidebar-notice-settings__privacy {
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: underline;
  width: fit-content;
}

.sidebar-notice-settings__error {
  margin: 0;
  color: #c0392b;
}

.sidebar-notice-settings__success {
  margin: 0;
  color: var(--color-primary-dark, #2e7d32);
}

.sidebar-notice-settings__actions {
  display: flex;
  gap: 0.75rem;
}

.sidebar-notice-settings__save {
  background: var(--color-primary);
  color: #fff;
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.sidebar-notice-settings__save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: #6c757d;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #343a40;
}
</style>
