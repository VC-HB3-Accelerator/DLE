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
    <div class="storefront page-with-close">
      <PageCloseButton fallback="/" />
      <header class="storefront__header">
        <h1>{{ sectionTitle || t('store.storefront.title') }}</h1>
        <div class="storefront__header-actions">
          <div class="storefront__view-toggle" role="group" :aria-label="t('store.storefront.viewMode')">
            <button
              type="button"
              class="btn btn-secondary"
              :class="{ 'btn--active': viewMode === 'tiles' }"
              :aria-pressed="viewMode === 'tiles'"
              @click="setViewMode('tiles')"
            >
              {{ t('store.storefront.viewTiles') }}
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              :class="{ 'btn--active': viewMode === 'list' }"
              :aria-pressed="viewMode === 'list'"
              @click="setViewMode('list')"
            >
              {{ t('store.storefront.viewList') }}
            </button>
          </div>
          <router-link class="btn btn-secondary" :to="{ name: 'store-cart' }">
            {{ t('store.storefront.cart') }}
            <span v-if="cartCount" class="storefront__badge">{{ cartCount }}</span>
          </router-link>
          <button type="button" class="btn btn-secondary" @click="loadCatalog">
            {{ t('store.common.refresh') }}
          </button>
        </div>
      </header>

      <nav v-if="sections.length" class="storefront__sections" aria-label="sections">
        <router-link
          class="storefront__chip"
          :class="{ 'storefront__chip--active': !route.params.slug }"
          :to="{ name: 'storefront' }"
        >
          {{ t('store.storefront.allSections') }}
        </router-link>
        <router-link
          v-for="s in sections"
          :key="s.id"
          class="storefront__chip"
          :class="{ 'storefront__chip--active': route.params.slug === s.slug }"
          :to="{ name: 'store-section', params: { slug: s.slug } }"
        >
          {{ s.title }}
        </router-link>
      </nav>

      <p v-if="error" class="storefront__error">{{ error }}</p>
      <p v-else-if="loading" class="storefront__muted">{{ t('store.common.loading') }}</p>
      <p v-else-if="!products.length" class="storefront__muted">{{ t('store.storefront.empty') }}</p>

      <ul
        v-else
        class="storefront__catalog"
        :class="viewMode === 'list' ? 'storefront__catalog--list' : 'storefront__catalog--tiles'"
      >
        <li v-for="p in products" :key="p.id" class="storefront__card">
          <button type="button" class="storefront__preview" @click="openProduct(p.id)">
            <img
              v-if="coverOf(p)?.media_type === 'image' && coverOf(p)?.url"
              :src="coverOf(p).url"
              :alt="p.title"
              class="storefront__cover"
            >
            <div v-else-if="coverOf(p)?.media_type === 'video'" class="storefront__cover storefront__cover--video">
              {{ t('store.storefront.video') }}
            </div>
            <div v-else class="storefront__cover storefront__cover--empty">
              {{ t('store.storefront.noMedia') }}
            </div>
          </button>
          <div class="storefront__body">
            <h2>{{ p.title }}</h2>
            <p class="storefront__desc">
              {{ p.summary || p.description || t('store.storefront.noDescription') }}
            </p>
            <p class="storefront__price">
              {{ formatUnits(p.price_units, p.pay_token_decimals) }} {{ p.pay_token_symbol }}
            </p>
            <p v-if="p.receipt_enabled || p.license_token_address" class="storefront__hint">
              {{ t('store.storefront.receiptHint', {
                amount: formatUnits(p.license_amount_units || '1', p.license_token_decimals || 0),
                symbol: p.license_token_symbol || 'TOKEN',
              }) }}
            </p>
            <div class="storefront__cta">
              <button type="button" class="btn btn-secondary" @click="openProduct(p.id)">
                {{ t('store.storefront.openCard') }}
              </button>
              <button type="button" class="btn btn-secondary" @click="addCart(p)">
                {{ t('store.storefront.addToCart') }}
              </button>
              <button type="button" class="btn btn-primary" :disabled="buyingId === p.id" @click="buyNow(p)">
                {{ buyingId === p.id ? t('store.common.saving') : t('store.storefront.buy') }}
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ethers } from 'ethers';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import { useAuthContext } from '../../composables/useAuth';
import {
  addToStoreCart,
  createStoreCheckout,
  fetchStoreCatalog,
  fetchStoreSections,
  onStoreCartChange,
  storeCartCount,
} from '../../services/storeService';

defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});
defineEmits(['auth-action-completed']);

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { authType, address } = useAuthContext();

const VIEW_KEY = 'dle_store_view_mode_v1';

function readViewMode() {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'list' ? 'list' : 'tiles';
  } catch {
    return 'tiles';
  }
}

const products = ref([]);
const sections = ref([]);
const loading = ref(false);
const error = ref('');
const buyingId = ref(null);
const cartCount = ref(storeCartCount());
const viewMode = ref(readViewMode());
let offCart = null;

function setViewMode(mode) {
  viewMode.value = mode === 'list' ? 'list' : 'tiles';
  try {
    localStorage.setItem(VIEW_KEY, viewMode.value);
  } catch {
    /* ignore */
  }
}

const canPayWallet = computed(() => (
  String(authType?.value || '').toLowerCase() === 'wallet' && Boolean(address?.value)
));

const sectionTitle = computed(() => {
  const slug = route.params.slug;
  if (!slug) return '';
  return sections.value.find((s) => s.slug === slug)?.title || '';
});

const sectionDescription = computed(() => {
  const slug = route.params.slug;
  if (!slug) return '';
  return sections.value.find((s) => s.slug === slug)?.description || '';
});

function applyStoreSeo() {
  const title = sectionTitle.value
    ? `${sectionTitle.value} · ${t('store.storefront.title')}`
    : t('store.storefront.title');
  const description = sectionDescription.value
    || t('store.storefront.title');
  document.title = title;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'description');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', String(description).slice(0, 300));
  const path = route.params.slug
    ? `/store/s/${encodeURIComponent(route.params.slug)}`
    : '/store';
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', `${window.location.origin}${path}`);
}

function formatUnits(units, decimals) {
  try {
    return ethers.formatUnits(String(units || '0'), Number(decimals || 0));
  } catch {
    return String(units || '0');
  }
}

function coverOf(product) {
  const list = Array.isArray(product?.media) ? product.media : [];
  return list[0] || null;
}

async function loadCatalog() {
  loading.value = true;
  error.value = '';
  try {
    const slug = route.params.slug || null;
    const [list, secs] = await Promise.all([
      fetchStoreCatalog(slug ? { section: slug } : {}),
      fetchStoreSections({ active: '1' }).catch(() => []),
    ]);
    products.value = Array.isArray(list) ? list : [];
    sections.value = Array.isArray(secs) ? secs : [];
    applyStoreSeo();
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.loadError');
  } finally {
    loading.value = false;
  }
}

function openProduct(id) {
  router.push({ name: 'store-product', params: { id } });
}

function addCart(p) {
  addToStoreCart({
    productId: p.id,
    qty: 1,
    title: p.title,
    payToken: p.pay_token_symbol || p.pay_token_address,
    payTokenAddress: p.pay_token_address,
    priceUnits: p.price_units,
    decimals: p.pay_token_decimals,
    maxQty: p.max_qty || 99,
  });
  cartCount.value = storeCartCount();
}

async function buyNow(p) {
  error.value = '';
  if (!canPayWallet.value) {
    error.value = t('store.storefront.walletOnly');
    router.push({ name: 'store-product', params: { id: p.id }, query: { buy: '1' } });
    return;
  }
  buyingId.value = p.id;
  try {
    const c = await createStoreCheckout([{ productId: p.id, qty: 1 }]);
    await router.push({ name: 'store-pay', params: { id: c.id } });
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    buyingId.value = null;
  }
}

watch(() => route.params.slug, loadCatalog);
onMounted(() => {
  loadCatalog();
  offCart = onStoreCartChange(() => {
    cartCount.value = storeCartCount();
  });
});
onUnmounted(() => {
  if (offCart) offCart();
});
</script>

<style scoped>
.storefront {
  padding: 1.25rem 1.5rem 2.5rem;
  max-width: 1100px;
  margin: 0 auto;
}
.storefront__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}
.storefront__header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
.storefront__view-toggle {
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
}
.storefront__badge {
  margin-left: 0.35rem;
  background: color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 999px;
  padding: 0.05rem 0.45rem;
  font-size: 0.8rem;
}
.storefront__header h1 {
  margin: 0;
  font-size: 1.4rem;
}
.storefront__sections {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}
.storefront__chip {
  text-decoration: none;
  color: inherit;
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  border-radius: 999px;
  padding: 0.35rem 0.8rem;
  font-size: 0.9rem;
}
.storefront__chip--active {
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.storefront__catalog {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1.25rem;
}
.storefront__catalog--tiles {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}
.storefront__catalog--list {
  grid-template-columns: 1fr;
}
.storefront__catalog--list .storefront__card {
  flex-direction: row;
  align-items: stretch;
}
.storefront__catalog--list .storefront__preview {
  flex: 0 0 180px;
  max-width: 180px;
}
.storefront__catalog--list .storefront__cover {
  height: 100%;
  min-height: 120px;
  aspect-ratio: auto;
}
.storefront__catalog--list .storefront__body {
  flex: 1;
  min-width: 0;
}
.storefront__card {
  display: flex;
  flex-direction: column;
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 12px;
  overflow: hidden;
  background: var(--theme-surface, transparent);
}
.storefront__preview {
  border: 0;
  padding: 0;
  cursor: pointer;
  background: transparent;
  display: block;
  width: 100%;
}
.storefront__cover {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  display: block;
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.storefront__cover--empty,
.storefront__cover--video {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  font-size: 0.9rem;
}
.storefront__body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  flex: 1;
}
.storefront__body h2 {
  margin: 0;
  font-size: 1.1rem;
}
.storefront__desc,
.storefront__hint,
.storefront__muted {
  opacity: 0.75;
  font-size: 0.9rem;
  margin: 0;
}
.storefront__price {
  font-weight: 600;
  margin: 0.2rem 0;
}
.storefront__cta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 0.5rem;
}
.storefront__error { color: #b42318; }
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
  font-weight: 400;
  line-height: 1.25;
  min-height: 2.25rem;
  box-sizing: border-box;
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primary { background: var(--color-primary, #1a5fff); color: #fff; }
.btn-secondary {
  background: color-mix(in srgb, currentColor 10%, transparent);
  color: inherit;
}
.btn--active {
  background: color-mix(in srgb, currentColor 18%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 22%, transparent);
}
@media (max-width: 640px) {
  .storefront__catalog--list .storefront__card {
    flex-direction: column;
  }
  .storefront__catalog--list .storefront__preview {
    flex: none;
    max-width: none;
  }
  .storefront__catalog--list .storefront__cover {
    aspect-ratio: 16 / 10;
    min-height: 0;
  }
}
</style>
