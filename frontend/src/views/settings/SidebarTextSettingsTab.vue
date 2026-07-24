<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="sidebar-text-tab">
    <p class="sidebar-text-tab__intro">{{ t('settings.sidebarNotice.intro') }}</p>

    <form class="sidebar-text-tab__form" @submit.prevent="handleSave">
      <label class="sidebar-text-tab__field">
        <span class="sidebar-text-tab__label">{{ t('settings.sidebarNotice.textLabel') }}</span>
        <textarea
          v-model="body"
          class="sidebar-text-tab__textarea"
          rows="8"
          :placeholder="t('settings.sidebarNotice.textPlaceholder')"
          :disabled="isSaving"
          maxlength="4000"
        />
        <span class="sidebar-text-tab__hint">{{ t('settings.sidebarNotice.textHint') }}</span>
      </label>

      <div class="sidebar-text-tab__fixed-link">
        <span class="sidebar-text-tab__label">{{ t('settings.sidebarNotice.fixedLinkLabel') }}</span>
        <a
          class="sidebar-text-tab__privacy"
          :href="privacyDocsUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('settings.sidebarNotice.privacyLink') }}
        </a>
        <span class="sidebar-text-tab__hint">{{ t('settings.sidebarNotice.fixedLinkHint') }}</span>
      </div>

      <p v-if="saveError" class="sidebar-text-tab__error">{{ saveError }}</p>
      <p v-if="saveSuccess" class="sidebar-text-tab__success">{{ saveSuccess }}</p>

      <div class="sidebar-text-tab__actions">
        <button type="submit" class="sidebar-text-tab__save" :disabled="isSaving">
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
  margin: 0 0 1.25rem;
  color: #6c757d;
  line-height: 1.5;
  max-width: 720px;
}

.sidebar-text-tab__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 720px;
}

.sidebar-text-tab__field,
.sidebar-text-tab__fixed-link {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar-text-tab__label {
  font-weight: 600;
  color: #343a40;
  font-size: 0.95rem;
}

.sidebar-text-tab__textarea {
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

.sidebar-text-tab__textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.15);
}

.sidebar-text-tab__hint {
  font-size: 0.85rem;
  color: #6c757d;
  line-height: 1.4;
}

.sidebar-text-tab__privacy {
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: underline;
  width: fit-content;
}

.sidebar-text-tab__error {
  margin: 0;
  color: #c0392b;
}

.sidebar-text-tab__success {
  margin: 0;
  color: var(--color-primary-dark, #2e7d32);
}

.sidebar-text-tab__actions {
  display: flex;
  gap: 0.75rem;
}

.sidebar-text-tab__save {
  background: var(--color-primary);
  color: #fff;
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.sidebar-text-tab__save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
