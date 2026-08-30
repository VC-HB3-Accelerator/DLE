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
      <PageCloseButton :fallback="{ name: 'crm' }" />
      <StoreAdminNav />

      <div v-if="!isEditor" class="store-settings__forbidden">
        <h1>{{ t('store.editor.settingsTitle') }}</h1>
        <p>{{ t('store.editor.forbidden') }}</p>
      </div>

      <div v-else class="store-settings__wrap">
        <header class="store-settings__header">
          <h1>{{ t('store.editor.settingsTitle') }}</h1>
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
            <input v-model="settings.primary_dle_address" type="text" @blur="onBookBlur">
          </label>
          <div class="store-settings__row-actions">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="discovering || !settings.primary_dle_address"
              @click="onDiscoverBook"
            >
              {{ discovering ? t('store.common.loading') : t('store.editor.discoverBook') }}
            </button>
          </div>
          <p v-if="discoverError" class="store-settings__error">{{ discoverError }}</p>

          <label>
            <span>{{ t('store.editor.primaryChain') }}</span>
            <select
              v-model.number="settings.primary_chain_id"
              required
              :disabled="!bookNetworks.length"
              @change="onChainPick"
            >
              <option disabled :value="null">{{ t('store.editor.pickChain') }}</option>
              <option v-for="net in bookNetworks" :key="net.chain_id" :value="net.chain_id">
                {{ net.network_name }} ({{ net.chain_id }})
              </option>
            </select>
          </label>
          <label>
            <span>{{ t('store.editor.treasury') }}</span>
            <input v-model="settings.treasury_address" type="text" readonly>
          </label>

          <section class="store-settings__tokens">
            <h2>{{ t('store.editor.settingsPayTokens') }}</h2>
            <p class="store-settings__muted">{{ t('store.editor.settingsPayTokensHint') }}</p>
            <p v-if="tokensError" class="store-settings__error">{{ tokensError }}</p>
            <p v-else-if="loadingTokens" class="store-settings__muted">{{ t('store.common.loading') }}</p>
            <p v-else-if="!settings.treasury_address" class="store-settings__muted">
              {{ t('store.editor.tokenNeedSettings') }}
            </p>
            <p v-else-if="!payTokens.length" class="store-settings__muted">{{ t('store.editor.tokenEmpty') }}</p>
            <label v-else>
              <span>{{ t('store.editor.payToken') }}</span>
              <select v-model="previewToken">
                <option value="">{{ t('store.editor.pickToken') }}</option>
                <option v-for="tok in payTokens" :key="tok.address" :value="tok.address">
                  {{ tok.symbol || 'TOKEN' }} · {{ tok.address }}
                  · {{ t('store.editor.balanceShort') }} {{ tok.balance_human ?? '—' }}
                </option>
              </select>
            </label>
          </section>
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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import StoreAdminNav from '../../components/store/StoreAdminNav.vue';
import { usePermissions } from '../../composables/usePermissions';
import { isNativePayToken } from '../../utils/storePayTransfer';
import { fetchStoreSettings, fetchTreasuryTokens, discoverStoreBook, saveStoreSettings } from '../../services/storeService';

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
const discovering = ref(false);
const loadingTokens = ref(false);
const loadError = ref('');
const tokensError = ref('');
const discoverError = ref('');
const msg = ref('');
const isError = ref(false);
const treasuryTokens = ref([]);
const bookNetworks = ref([]);
const previewToken = ref('');

const settings = reactive({
  primary_dle_address: '',
  primary_chain_id: null,
  treasury_address: '',
  order_ttl_minutes: 60,
});

const payTokens = computed(() => (
  (treasuryTokens.value || []).filter((tok) => !isNativePayToken(tok.address))
));

async function reloadTreasuryTokens() {
  tokensError.value = '';
  previewToken.value = '';
  if (!settings.treasury_address || !settings.primary_chain_id) {
    treasuryTokens.value = [];
    return;
  }
  loadingTokens.value = true;
  try {
    const list = await fetchTreasuryTokens({
      treasury_address: settings.treasury_address,
      chain_id: settings.primary_chain_id,
    });
    treasuryTokens.value = Array.isArray(list) ? list : [];
    const first = payTokens.value[0];
    previewToken.value = first?.address || '';
  } catch (e) {
    treasuryTokens.value = [];
    tokensError.value = e?.response?.data?.error || e?.message || t('store.editor.tokenLoadError');
  } finally {
    loadingTokens.value = false;
  }
}

function applyNetwork(chainId) {
  const net = bookNetworks.value.find((n) => Number(n.chain_id) === Number(chainId));
  if (!net) return;
  settings.primary_chain_id = Number(net.chain_id);
  settings.treasury_address = net.treasury_address || '';
}

async function onDiscoverBook() {
  discovering.value = true;
  discoverError.value = '';
  msg.value = '';
  isError.value = false;
  bookNetworks.value = [];
  try {
    const data = await discoverStoreBook(settings.primary_dle_address.trim());
    bookNetworks.value = Array.isArray(data?.networks) ? data.networks : [];
    if (!bookNetworks.value.length) {
      discoverError.value = t('store.editor.discoverBookFail');
      return;
    }
    const keep = bookNetworks.value.find((n) => Number(n.chain_id) === Number(settings.primary_chain_id));
    const withTreasury = bookNetworks.value.find((n) => n.treasury_address);
    applyNetwork((keep || withTreasury || bookNetworks.value[0]).chain_id);
    msg.value = t('store.editor.discoverBookOk');
    await reloadTreasuryTokens();
  } catch (e) {
    isError.value = true;
    discoverError.value = e?.response?.data?.error || e?.message || t('store.editor.discoverBookFail');
  } finally {
    discovering.value = false;
  }
}

function onBookBlur() {
  if (settings.primary_dle_address && settings.primary_dle_address.length >= 42 && !bookNetworks.value.length) {
    onDiscoverBook();
  }
}

async function onChainPick() {
  applyNetwork(settings.primary_chain_id);
  await reloadTreasuryTokens();
}

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
    if (settings.primary_dle_address) {
      await onDiscoverBook();
    } else {
      await reloadTreasuryTokens();
    }
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
    await reloadTreasuryTokens();
  } catch (e) {
    isError.value = true;
    msg.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    saving.value = false;
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
  max-width: 960px;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 2.5rem;
}
.store-settings__wrap {
  max-width: 640px;
}
.store-settings__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.store-settings__header h1 {
  margin: 0;
  font-size: 1.35rem;
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
.store-settings__tokens {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding-top: 0.25rem;
}
.store-settings__tokens h2 {
  margin: 0;
  font-size: 1rem;
}
.store-settings__token-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.store-settings__token-list li {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
  border-radius: 8px;
  font-size: 0.85rem;
  word-break: break-all;
}
.store-settings label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
}
.store-settings input,
.store-settings select {
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
