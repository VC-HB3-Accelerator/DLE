<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="region-settings settings-panel">
    <button class="close-btn" type="button" @click="router.push('/settings')">×</button>
    <h2>{{ t('settings.regions.pageTitle') }}</h2>
    <p class="region-settings__intro">{{ t('settings.regions.intro') }}</p>

    <form class="region-settings__form" @submit.prevent="handleSave">
      <div
        v-for="(row, index) in rows"
        :key="row.key"
        class="region-settings__row"
        :class="{ 'region-settings__row--primary': row.isPrimary }"
      >
        <div class="region-settings__row-header">
          <span class="region-settings__row-title">
            <template v-if="row.isPrimary">
              {{ t('settings.regions.currentServer') }}
            </template>
            <template v-else>
              {{ row.label.trim() || t('settings.regions.newServer', { n: index }) }}
            </template>
          </span>
          <button
            v-if="!row.isPrimary"
            type="button"
            class="region-settings__remove"
            :disabled="isSaving"
            @click="removeRow(index)"
          >
            {{ t('settings.regions.remove') }}
          </button>
        </div>

        <label class="region-settings__field">
          <span class="region-settings__label">{{ t('settings.regions.buttonLabel') }}</span>
          <input
            v-model="row.label"
            type="text"
            class="region-settings__input"
            :placeholder="row.isPrimary ? t('settings.regions.primaryLabelPlaceholder') : t('settings.regions.buttonLabelPlaceholder')"
            :disabled="isSaving"
          />
          <span class="region-settings__hint">
            {{ row.isPrimary ? t('settings.regions.primaryLabelHint') : t('settings.regions.buttonLabelHint') }}
          </span>
        </label>

        <label class="region-settings__field">
          <span class="region-settings__label">{{ t('settings.regions.serverUrl') }}</span>
          <input
            v-model="row.url"
            type="url"
            class="region-settings__input"
            :placeholder="t('settings.regions.urlPlaceholder')"
            :disabled="isSaving || row.isPrimary"
            :readonly="row.isPrimary"
          />
          <span class="region-settings__hint">
            {{ row.isPrimary ? t('settings.regions.primaryUrlHint') : t('settings.regions.urlHint') }}
          </span>
        </label>
      </div>

      <button
        type="button"
        class="region-settings__add"
        :disabled="isSaving"
        @click="addRow"
      >
        {{ t('settings.regions.add') }}
      </button>

      <p v-if="saveError" class="region-settings__error">{{ saveError }}</p>
      <p v-if="saveSuccess" class="region-settings__success">{{ saveSuccess }}</p>

      <div class="region-settings__actions">
        <button
          type="submit"
          class="region-settings__save"
          :disabled="isSaving"
        >
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
import { fetchRegionUrls, saveRegionUrls } from '@/services/regionUrlsService';

const PRIMARY_ID = 'local';

const { t } = useI18n();
const router = useRouter();
const { checkAuth, checkUserAccessLevel, address, isAuthenticated } = useAuthContext();

const rows = ref([]);
const isSaving = ref(false);
const saveError = ref('');
const saveSuccess = ref('');

function createRow(data = {}) {
  return {
    key: data.id || `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    id: data.id || '',
    label: data.label || '',
    url: data.url || '',
    isPrimary: Boolean(data.isPrimary || data.id === PRIMARY_ID),
  };
}

function addRow() {
  rows.value.push(createRow());
}

function removeRow(index) {
  if (rows.value[index]?.isPrimary) {
    return;
  }
  rows.value.splice(index, 1);
}

function formatSaveError(error) {
  const data = error.response?.data;
  if (typeof data?.error === 'string') {
    return data.error;
  }
  if (data?.error?.message) {
    return data.error.message;
  }
  if (data?.message) {
    return data.message;
  }
  return error.message || t('settings.regions.saveError');
}

async function loadSettings() {
  try {
    const data = await fetchRegionUrls();
    const list = data.regions?.length ? data.regions : [];
    rows.value = list.map((item) => createRow(item));
  } catch (error) {
    console.error('[RegionSettingsView] load failed:', error);
    rows.value = [];
  }
}

async function handleSave() {
  if (isSaving.value) {
    return;
  }

  isSaving.value = true;
  saveError.value = '';
  saveSuccess.value = '';

  try {
    const payload = rows.value
      .map(({ id, label, url, isPrimary }) => ({
        id: id || undefined,
        label: label.trim(),
        url: url.trim(),
        isPrimary: Boolean(isPrimary),
      }))
      .filter((row, index) => {
        if (row.isPrimary) {
          return true;
        }
        return row.label || row.url;
      });
    const saved = await saveRegionUrls({ regions: payload });
    rows.value = saved.regions?.length
      ? saved.regions.map((item) => createRow(item))
      : [];
    saveSuccess.value = t('settings.regions.saved');
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
    if (authenticated) {
      loadSettings();
    }
  }
);

onMounted(initPage);
</script>

<style scoped>
.region-settings {
  position: relative;
  padding: var(--block-padding, 1.5rem);
  background-color: var(--color-light, #f8f9fa);
  border-radius: var(--radius-md, 12px);
  margin-top: var(--spacing-lg, 1.5rem);
}

.region-settings__intro {
  margin: 0 0 1.5rem;
  color: #6c757d;
  line-height: 1.5;
  max-width: 720px;
}

.region-settings__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 720px;
}

.region-settings__row {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  background: #fff;
}

.region-settings__row--primary {
  border-color: var(--color-primary, #409eff);
  background: #f8fbff;
}

.region-settings__row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.region-settings__row-title {
  font-weight: 600;
  color: var(--color-primary);
}

.region-settings__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.region-settings__label {
  font-weight: 600;
  color: var(--color-primary);
}

.region-settings__input {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 0.65rem 0.85rem;
  font-size: 0.95rem;
}

.region-settings__input:disabled {
  background: #f5f7fa;
  cursor: not-allowed;
}

.region-settings__hint {
  font-size: 0.85rem;
  color: #909399;
}

.region-settings__add {
  align-self: flex-start;
  background: transparent;
  color: var(--color-primary);
  border: 1px dashed var(--color-primary);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-weight: 500;
}

.region-settings__add:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.region-settings__remove {
  background: transparent;
  color: #c0392b;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
}

.region-settings__remove:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.region-settings__error {
  color: #c0392b;
  margin: 0;
}

.region-settings__success {
  color: #27ae60;
  margin: 0;
}

.region-settings__actions {
  display: flex;
  gap: 0.75rem;
}

.region-settings__save {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.625rem 1.25rem;
  cursor: pointer;
  font-weight: 500;
}

.region-settings__save:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
  z-index: 10;
}

.close-btn:hover {
  color: #333;
}
</style>
