<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="store-settings page-with-close">
      <PageCloseButton :fallback="{ name: 'content-store' }" />

      <div v-if="!isEditor" class="store-settings__forbidden">
        <h1>{{ t('store.editor.settingsTitle') }}</h1>
        <p>{{ t('store.editor.forbidden') }}</p>
      </div>

      <div v-else class="store-settings__wrap">
        <header class="store-settings__header">
          <div>
            <router-link class="store-settings__back" :to="{ name: 'content-store' }">
              ← {{ t('store.editor.backToCatalog') }}
            </router-link>
            <h1>{{ t('store.editor.settingsTitle') }}</h1>
          </div>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="saving"
            @click="onSave"
          >
            {{ saving ? t('store.common.saving') : t('store.editor.saveSettings') }}
          </button>
        </header>

        <p v-if="loadError" class="store-settings__error">{{ loadError }}</p>
        <p v-else-if="loading" class="store-settings__muted">{{ t('store.common.loading') }}</p>

        <form v-else class="store-settings__form" @submit.prevent="onSave">
          <label>
            <span>{{ t('store.editor.primaryDle') }}</span>
            <input v-model="settings.primary_dle_address" type="text">
          </label>
          <label>
            <span>{{ t('store.editor.primaryChain') }}</span>
            <input v-model.number="settings.primary_chain_id" type="number">
          </label>
          <label>
            <span>{{ t('store.editor.treasury') }}</span>
            <input v-model="settings.treasury_address" type="text">
          </label>
          <div class="store-settings__row-actions">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="pulling || !settings.primary_dle_address || !settings.primary_chain_id"
              @click="onPullTreasury"
            >
              {{ pulling ? t('store.common.loading') : t('store.editor.pullTreasury') }}
            </button>
          </div>
          <label>
            <span>{{ t('store.editor.ttl') }}</span>
            <input v-model.number="settings.order_ttl_minutes" type="number" min="5" max="1440">
          </label>

          <p v-if="msg" class="store-settings__msg" :class="{ 'store-settings__error': isError }">{{ msg }}</p>

          <div class="store-settings__actions">
            <router-link class="btn btn-secondary" :to="{ name: 'content-store' }">
              {{ t('store.common.cancel') }}
            </router-link>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? t('store.common.saving') : t('store.editor.saveSettings') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import { usePermissions } from '../../composables/usePermissions';
import { fetchStoreSettings, pullStoreTreasuryFromModule, saveStoreSettings } from '../../services/storeService';

defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});
defineEmits(['auth-action-completed']);

const { t } = useI18n();
const { isEditor } = usePermissions();

const loading = ref(false);
const saving = ref(false);
const pulling = ref(false);
const loadError = ref('');
const msg = ref('');
const isError = ref(false);

const settings = reactive({
  primary_dle_address: '',
  primary_chain_id: null,
  treasury_address: '',
  order_ttl_minutes: 60,
});

async function loadPage() {
  loading.value = true;
  loadError.value = '';
  msg.value = '';
  try {
    const s = await fetchStoreSettings();
    settings.primary_dle_address = s?.primary_dle_address || '';
    settings.primary_chain_id = s?.primary_chain_id ?? null;
    settings.treasury_address = s?.treasury_address || '';
    settings.order_ttl_minutes = s?.order_ttl_minutes ?? 60;
  } catch (e) {
    loadError.value = e?.response?.data?.error || e?.message || t('store.common.loadError');
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  saving.value = true;
  msg.value = '';
  isError.value = false;
  try {
    await saveStoreSettings({ ...settings });
    msg.value = t('store.editor.settingsSaved');
  } catch (e) {
    isError.value = true;
    msg.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    saving.value = false;
  }
}

async function onPullTreasury() {
  pulling.value = true;
  msg.value = '';
  isError.value = false;
  try {
    const data = await pullStoreTreasuryFromModule();
    if (data?.treasury_address) {
      settings.treasury_address = data.treasury_address;
      msg.value = t('store.editor.pullTreasuryOk');
    } else {
      isError.value = true;
      msg.value = t('store.editor.pullTreasuryFail');
    }
  } catch (e) {
    isError.value = true;
    msg.value = e?.response?.data?.error || e?.message || t('store.editor.pullTreasuryFail');
  } finally {
    pulling.value = false;
  }
}

onMounted(() => {
  if (isEditor.value) loadPage();
});

watch(isEditor, (ok) => {
  if (ok) loadPage();
});
</script>

<style scoped>
.store-settings {
  max-width: 640px;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 2.5rem;
}
.store-settings__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.store-settings__header h1 {
  margin: 0.35rem 0 0;
  font-size: 1.35rem;
}
.store-settings__back {
  font-size: 0.9rem;
  opacity: 0.8;
  text-decoration: none;
  color: inherit;
}
.store-settings__form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.store-settings__row-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.store-settings label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
}
.store-settings input {
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
  background: transparent;
  color: inherit;
  font: inherit;
}
.store-settings__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.store-settings__error { color: #b42318; }
.store-settings__msg,
.store-settings__muted { opacity: 0.85; }
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  border: 0;
  cursor: pointer;
  border-radius: 8px;
  padding: 0.45rem 0.85rem;
  font: inherit;
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primary { background: var(--color-primary, #1a5fff); color: #fff; }
.btn-secondary {
  background: color-mix(in srgb, currentColor 10%, transparent);
  color: inherit;
}
</style>
