<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="sidebar-buttons-tab">
    <p class="sidebar-buttons-tab__intro">{{ t('settings.sidebar.buttons.intro') }}</p>

    <form class="sidebar-buttons-tab__form" @submit.prevent="handleSave">
      <label class="sidebar-buttons-tab__check">
        <input v-model="buttons.repositories" type="checkbox" :disabled="isSaving" />
        <span>
          <strong>{{ t('settings.sidebar.buttons.repositories') }}</strong>
          <small>{{ t('settings.sidebar.buttons.repositoriesHint') }}</small>
        </span>
      </label>

      <label class="sidebar-buttons-tab__check">
        <input v-model="buttons.store" type="checkbox" :disabled="isSaving" />
        <span>
          <strong>{{ t('settings.sidebar.buttons.store') }}</strong>
          <small>{{ t('settings.sidebar.buttons.storeHint') }}</small>
        </span>
      </label>

      <div v-if="gitea" class="sidebar-buttons-tab__status">
        <span class="sidebar-buttons-tab__label">{{ t('settings.sidebar.buttons.giteaStatus') }}</span>
        <code>{{ giteaStateLabel }}</code>
        <span v-if="gitea.detail" class="sidebar-buttons-tab__hint">{{ gitea.detail }}</span>
      </div>

      <p v-if="saveError" class="alert alert-danger">{{ saveError }}</p>
      <p v-if="saveSuccess" class="alert alert-success">{{ saveSuccess }}</p>
      <p v-if="giteaWarning" class="alert alert-warning">{{ giteaWarning }}</p>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="isSaving">
          {{ isSaving ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthContext } from '@/composables/useAuth';
import { fetchSidebarNav, saveSidebarNav } from '@/services/sidebarNavService';

const { t } = useI18n();
const { checkAuth, checkUserAccessLevel, address, isAuthenticated } = useAuthContext();

const buttons = ref({ repositories: false, store: false });
const gitea = ref(null);
const isSaving = ref(false);
const saveError = ref('');
const saveSuccess = ref('');
const giteaWarning = ref('');

const giteaStateLabel = computed(() => {
  const state = gitea.value?.state || 'unknown';
  return t(`settings.sidebar.buttons.giteaStates.${state}`, state);
});

function formatSaveError(error) {
  const data = error.response?.data;
  if (typeof data?.error === 'string') return data.error;
  if (data?.error?.message) return data.error.message;
  if (data?.message) return data.message;
  return error.message || t('settings.sidebar.buttons.saveError');
}

async function loadSettings() {
  try {
    const data = await fetchSidebarNav();
    buttons.value = {
      repositories: Boolean(data.buttons?.repositories),
      store: Boolean(data.buttons?.store),
    };
    gitea.value = data.gitea || null;
  } catch (error) {
    console.error('[SidebarButtonsTab] load failed:', error);
    saveError.value = t('settings.sidebar.buttons.loadError');
  }
}

async function handleSave() {
  isSaving.value = true;
  saveError.value = '';
  saveSuccess.value = '';
  giteaWarning.value = '';
  try {
    const data = await saveSidebarNav({ ...buttons.value });
    buttons.value = {
      repositories: Boolean(data.buttons?.repositories),
      store: Boolean(data.buttons?.store),
    };
    gitea.value = data.gitea || null;
    saveSuccess.value = t('settings.sidebar.buttons.saved');
    if (data.giteaAction && !data.giteaAction.ok) {
      giteaWarning.value = data.giteaAction.message
        || t('settings.sidebar.buttons.giteaActionFailed');
    }
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
.sidebar-buttons-tab__intro {
  margin: 0 0 var(--spacing-lg);
  color: var(--color-text-light);
  line-height: 1.5;
  max-width: 720px;
}

.sidebar-buttons-tab__form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  max-width: 640px;
}

.sidebar-buttons-tab__check {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-start;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
}

.sidebar-buttons-tab__check.is-disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.sidebar-buttons-tab__check input {
  margin-top: 0.2rem;
}

.sidebar-buttons-tab__check span {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.sidebar-buttons-tab__check small {
  color: var(--color-text-light);
  line-height: 1.4;
}

.sidebar-buttons-tab__status {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.sidebar-buttons-tab__label {
  font-weight: 600;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.sidebar-buttons-tab__hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-light);
}

@media (max-width: 768px) {
  .sidebar-buttons-tab, .settings-panel {
    max-width: 100%;
    box-sizing: border-box;
  }
}
</style>
