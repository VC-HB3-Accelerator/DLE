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

      <p class="form-hint">{{ t('settings.sidebar.languages.hint') }}</p>

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
  margin: 0 0 var(--spacing-lg);
  color: var(--color-text-light);
  line-height: 1.5;
  max-width: 720px;
}

.sidebar-languages-tab__form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-width: 640px;
}

.sidebar-languages-tab__check {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-start;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
}

.sidebar-languages-tab__check input {
  margin-top: 0.2rem;
}

.sidebar-languages-tab__check span {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.sidebar-languages-tab__check small {
  color: var(--color-text-light);
  line-height: 1.4;
}

@media (max-width: 768px) {
  .sidebar-languages-tab, .settings-panel {
    max-width: 100%;
    box-sizing: border-box;
  }
}
</style>
