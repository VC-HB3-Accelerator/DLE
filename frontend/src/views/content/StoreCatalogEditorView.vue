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
    <div class="store-hub page-with-close">
      <PageCloseButton :fallback="{ name: 'crm' }" />
      <StoreAdminNav />

      <div v-if="!isEditor" class="store-hub__forbidden">
        <h1>{{ t('store.editor.title') }}</h1>
        <p>{{ t('store.editor.forbidden') }}</p>
      </div>

      <div v-else class="store-hub__wrap">
        <header class="store-hub__header">
          <h1>{{ t('store.editor.title') }}</h1>
          <div class="store-hub__header-actions">
            <router-link class="btn btn-secondary" :to="{ name: 'content-store-sections' }">
              {{ t('store.editor.sectionsManage') }}
            </router-link>
            <button type="button" class="btn btn-secondary" @click="showImport = true">
              {{ t('store.import.open') }}
            </button>
            <router-link class="btn btn-primary" :to="{ name: 'content-store-product-new' }">
              {{ t('store.editor.createCard') }}
            </router-link>
          </div>
        </header>

        <ImportStoreProductsModal
          v-if="showImport"
          @close="showImport = false"
          @imported="onImported"
        />

        <section class="store-hub__block">
          <div class="store-hub__block-head">
            <h2>{{ t('store.editor.sections') }}</h2>
            <router-link class="btn btn-primary" :to="{ name: 'content-store-section-new' }">
              {{ t('store.editor.sectionCreate') }}
            </router-link>
          </div>
          <p v-if="!sections.length" class="store-hub__muted">{{ t('store.editor.sectionsEmpty') }}</p>
          <ul v-else class="store-hub__list">
            <li v-for="s in sections" :key="s.id" class="store-hub__row">
              <div>
                <strong>{{ s.title }}</strong>
                <span class="store-hub__meta">
                  /store/s/{{ s.slug }}
                  · {{ s.active ? t('store.editor.published') : t('store.editor.draft') }}
                </span>
              </div>
              <div class="store-hub__row-actions">
                <a
                  class="btn btn-secondary"
                  :href="`/store/s/${s.slug}`"
                  target="_blank"
                  rel="noopener"
                >{{ t('store.editor.sectionOpenStore') }}</a>
                <router-link
                  class="btn btn-primary"
                  :to="{ name: 'content-store-section-edit', params: { id: s.id } }"
                >{{ t('store.editor.sectionEdit') }}</router-link>
              </div>
            </li>
          </ul>
        </section>

        <section class="store-hub__block">
          <div class="store-hub__block-head">
            <h2>{{ t('store.editor.cardsTitle') }}</h2>
            <router-link class="btn btn-primary" :to="{ name: 'content-store-product-new' }">
              {{ t('store.editor.createCard') }}
            </router-link>
          </div>
          <p v-if="loadError" class="store-hub__error">{{ loadError }}</p>
          <p v-else-if="loading" class="store-hub__muted">{{ t('store.common.loading') }}</p>
          <div v-else-if="!products.length" class="store-hub__empty">
            <p>{{ t('store.editor.empty') }}</p>
            <router-link class="btn btn-primary" :to="{ name: 'content-store-product-new' }">
              {{ t('store.editor.createCard') }}
            </router-link>
          </div>
          <ul v-else class="store-hub__list">
            <li v-for="p in products" :key="p.id" class="store-hub__row">
              <div>
                <strong>{{ p.title }}</strong>
                <span class="store-hub__meta">
                  {{ p.kind === 'service' ? t('store.editor.kindService') : t('store.editor.kindProduct') }}
                  · {{ formatUnits(p.price_units, p.pay_token_decimals) }} {{ p.pay_token_symbol }}
                  · {{ p.published ? t('store.editor.published') : t('store.editor.draft') }}
                </span>
              </div>
              <router-link
                class="btn btn-primary"
                :to="{ name: 'content-store-product-edit', params: { id: p.id } }"
              >{{ t('store.editor.editCard') }}</router-link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ethers } from 'ethers';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import StoreAdminNav from '../../components/store/StoreAdminNav.vue';
import ImportStoreProductsModal from '../../components/ImportStoreProductsModal.vue';
import { usePermissions } from '../../composables/usePermissions';
import { fetchStoreProducts, fetchStoreSections } from '../../services/storeService';

defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});
defineEmits(['auth-action-completed']);

const { t } = useI18n();
const { isEditor } = usePermissions();

const products = ref([]);
const sections = ref([]);
const loading = ref(false);
const loadError = ref('');
const showImport = ref(false);

function formatUnits(units, decimals) {
  try {
    return ethers.formatUnits(String(units || '0'), Number(decimals || 0));
  } catch {
    return String(units || '0');
  }
}

async function loadAll() {
  loading.value = true;
  loadError.value = '';
  try {
    const [list, secs] = await Promise.all([
      fetchStoreProducts(),
      fetchStoreSections().catch(() => []),
    ]);
    products.value = Array.isArray(list) ? list : [];
    sections.value = Array.isArray(secs) ? secs : [];
  } catch (e) {
    loadError.value = e?.response?.data?.error || e?.message || t('store.common.loadError');
  } finally {
    loading.value = false;
  }
}

async function onImported() {
  showImport.value = false;
  await loadAll();
}

onMounted(() => {
  if (isEditor.value) loadAll();
});
</script>

<style scoped>
.store-hub { max-width: 960px; margin: 0 auto; padding: 1.25rem 1.5rem 2.5rem; }
.store-hub__forbidden { text-align: center; padding: 2rem; }
.store-hub__header {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.store-hub__header h1 { margin: 0; font-size: 1.4rem; }
.store-hub__header-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.store-hub__block {
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 12px;
  padding: 1rem 1.1rem 1.25rem;
  margin-bottom: 1.25rem;
}
.store-hub__block-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}
.store-hub__block-head h2 { margin: 0; font-size: 1.1rem; }
.store-hub__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.65rem; }
.store-hub__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent);
}
.store-hub__row-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.store-hub__meta { display: block; margin-top: 0.2rem; opacity: 0.7; font-size: 0.88rem; }
.store-hub__muted, .store-hub__empty { opacity: 0.75; }
.store-hub__error { color: #b42318; }
.store-hub__empty { display: grid; gap: 0.75rem; justify-items: start; }
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
.btn-primary { background: var(--color-primary, #1a5fff); color: #fff; }
.btn-secondary {
  background: color-mix(in srgb, currentColor 10%, transparent);
  color: inherit;
}
</style>
