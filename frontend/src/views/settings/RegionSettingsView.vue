<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="region-settings">
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
            class="btn btn-ghost btn-sm region-settings__remove"
            :disabled="isSaving"
            @click="removeRow(index)"
          >
            {{ t('settings.regions.remove') }}
          </button>
        </div>

        <label class="region-settings__field">
          <span class="form-label">{{ t('settings.regions.buttonLabel') }}</span>
          <input
            v-model="row.label"
            type="text"
            class="form-control"
            :placeholder="row.isPrimary ? t('settings.regions.primaryLabelPlaceholder') : t('settings.regions.buttonLabelPlaceholder')"
            :disabled="isSaving"
          />
          <span class="form-hint">
            {{ row.isPrimary ? t('settings.regions.primaryLabelHint') : t('settings.regions.buttonLabelHint') }}
          </span>
        </label>

        <label class="region-settings__field">
          <span class="form-label">{{ t('settings.regions.serverUrl') }}</span>
          <input
            v-model="row.url"
            type="url"
            class="form-control"
            :placeholder="t('settings.regions.urlPlaceholder')"
            :disabled="isSaving || row.isPrimary"
            :readonly="row.isPrimary"
          />
          <span class="form-hint">
            {{ row.isPrimary ? t('settings.regions.primaryUrlHint') : t('settings.regions.urlHint') }}
          </span>
        </label>
      </div>

      <button
        type="button"
        class="btn btn-outline-primary region-settings__add"
        :disabled="isSaving"
        @click="addRow"
      >
        {{ t('settings.regions.add') }}
      </button>

      <p v-if="saveError" class="alert alert-danger">{{ saveError }}</p>
      <p v-if="saveSuccess" class="alert alert-success">{{ saveSuccess }}</p>

      <div class="form-actions">
        <button
          type="submit"
          class="btn btn-primary"
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
import { useI18n } from 'vue-i18n';
import { useAuthContext } from '@/composables/useAuth';
import { fetchRegionUrls, saveRegionUrls } from '@/services/regionUrlsService';

const PRIMARY_ID = 'local';

const { t } = useI18n();
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
}

.region-settings__intro {
  margin: 0 0 var(--spacing-xl);
  color: var(--color-text-light);
  line-height: 1.5;
  max-width: 720px;
}

.region-settings__form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 720px;
}

.region-settings__row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-white);
}

.region-settings__row--primary {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, white);
}

.region-settings__row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.region-settings__row-title {
  font-weight: 600;
  color: var(--color-primary);
}

.region-settings__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.region-settings__add {
  align-self: flex-start;
}

.region-settings__remove {
  color: var(--color-danger);
  padding: 0;
  height: auto;
  min-height: 0;
}

@media (max-width: 768px) {
  .region-settings,
  .settings-panel {
    max-width: 100%;
    box-sizing: border-box;
  }
}
</style>
