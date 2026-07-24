<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="sidebar-languages-tab">
    <p class="sidebar-languages-tab__intro">{{ t('settings.sidebar.languages.intro') }}</p>

    <form class="sidebar-languages-tab__form" @submit.prevent="handleSave">
      <label
        v-for="code in knownLocales"
        :key="code"
        class="sidebar-languages-tab__check"
      >
        <input
          type="checkbox"
          :checked="selected[code]"
          :disabled="isSaving || isLastSelected(code)"
          @change="toggleLocale(code, $event.target.checked)"
        />
        <span>
          <strong>{{ t(`locale.${code}`) }}</strong>
          <small>{{ code }}</small>
        </span>
      </label>

      <p class="sidebar-languages-tab__hint">{{ t('settings.sidebar.languages.hint') }}</p>

      <p v-if="saveError" class="sidebar-languages-tab__error">{{ saveError }}</p>
      <p v-if="saveSuccess" class="sidebar-languages-tab__success">{{ saveSuccess }}</p>

      <div class="sidebar-languages-tab__actions">
        <button type="submit" class="sidebar-languages-tab__save" :disabled="isSaving">
          {{ isSaving ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthContext } from '@/composables/useAuth';
import { SUPPORTED } from '@/locales';
import { fetchSidebarNav, saveSidebarLocales } from '@/services/sidebarNavService';

const { t } = useI18n();
const { checkAuth, checkUserAccessLevel, address, isAuthenticated } = useAuthContext();

const knownLocales = ref([...SUPPORTED]);
const selected = reactive({
  ru: true,
  en: true,
});
const isSaving = ref(false);
const saveError = ref('');
const saveSuccess = ref('');

const selectedCount = computed(() => knownLocales.value.filter((code) => selected[code]).length);

function isLastSelected(code) {
  return selected[code] && selectedCount.value <= 1;
}

function toggleLocale(code, checked) {
  if (!checked && selectedCount.value <= 1) {
    return;
  }
  selected[code] = Boolean(checked);
}

function applyLocales(list) {
  const enabled = new Set(Array.isArray(list) ? list : SUPPORTED);
  for (const code of knownLocales.value) {
    selected[code] = enabled.has(code);
  }
  if (selectedCount.value === 0) {
    selected.ru = true;
  }
}

function formatSaveError(error) {
  const data = error.response?.data;
  if (typeof data?.error === 'string') return data.error;
  if (data?.error?.message) return data.error.message;
  if (data?.message) return data.message;
  return error.message || t('settings.sidebar.languages.saveError');
}

async function loadSettings() {
  try {
    const data = await fetchSidebarNav();
    if (Array.isArray(data.knownLocales) && data.knownLocales.length) {
      knownLocales.value = data.knownLocales;
    }
    applyLocales(data.locales);
  } catch (error) {
    console.error('[SidebarLanguagesTab] load failed:', error);
    saveError.value = t('settings.sidebar.languages.loadError');
  }
}

async function handleSave() {
  isSaving.value = true;
  saveError.value = '';
  saveSuccess.value = '';
  try {
    const locales = knownLocales.value.filter((code) => selected[code]);
    const data = await saveSidebarLocales(locales);
    applyLocales(data.locales);
    saveSuccess.value = t('settings.sidebar.languages.saved');
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
.sidebar-languages-tab__intro {
  margin: 0 0 1.25rem;
  color: #6c757d;
  line-height: 1.5;
  max-width: 720px;
}

.sidebar-languages-tab__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 640px;
}

.sidebar-languages-tab__check {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.85rem 1rem;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 10px;
  cursor: pointer;
}

.sidebar-languages-tab__check input {
  margin-top: 0.2rem;
}

.sidebar-languages-tab__check span {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sidebar-languages-tab__check small {
  color: #6c757d;
  line-height: 1.4;
}

.sidebar-languages-tab__hint {
  margin: 0;
  color: #6c757d;
  font-size: 0.9rem;
  line-height: 1.45;
}

.sidebar-languages-tab__error {
  margin: 0;
  color: #c0392b;
}

.sidebar-languages-tab__success {
  margin: 0;
  color: var(--color-primary-dark, #2e7d32);
}

.sidebar-languages-tab__actions {
  display: flex;
  gap: 0.75rem;
}

.sidebar-languages-tab__save {
  background: var(--color-primary);
  color: #fff;
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.sidebar-languages-tab__save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
