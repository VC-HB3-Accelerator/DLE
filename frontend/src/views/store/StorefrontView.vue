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
        <CatalogLinkedFilters
          v-model="catalogFacets"
          class="storefront__header-filters"
          scope="store"
          hide-labels
          :only-used="!canCreateCard"
          :require-cascade="!canCreateCard"
          @change="onCatalogFacetsChange"
        />
        <div class="storefront__header-actions">
          <router-link
            v-if="canCreateCard"
            class="storefront__icon-btn"
            :to="{ name: 'content-store-product-new' }"
            :title="t('store.editor.createCard')"
            :aria-label="t('store.editor.createCard')"
          >
            <el-icon :size="18"><Plus /></el-icon>
          </router-link>
          <router-link
            class="storefront__icon-btn"
            :to="cartTo"
            :title="t('store.storefront.cart')"
            :aria-label="t('store.storefront.cart')"
          >
            <el-icon :size="18"><ShoppingCart /></el-icon>
            <span v-if="cartCount" class="storefront__badge">{{ cartCount }}</span>
          </router-link>
          <router-link
            v-if="ordersTo"
            class="storefront__icon-btn"
            :to="ordersTo"
            :title="t('store.cabinet.title')"
            :aria-label="t('store.cabinet.title')"
          >
            <el-icon :size="18"><User /></el-icon>
          </router-link>
          <div class="storefront__view-toggle" role="group" :aria-label="t('store.storefront.viewMode')">
            <button
              type="button"
              class="storefront__view-btn"
              :class="{ 'is-on': viewMode === 'tiles' }"
              :aria-pressed="viewMode === 'tiles'"
              :aria-label="t('store.storefront.viewTiles')"
              :title="t('store.storefront.viewTiles')"
              @click="setViewMode('tiles')"
            >
              <el-icon :size="18"><Grid /></el-icon>
            </button>
            <button
              type="button"
              class="storefront__view-btn"
              :class="{ 'is-on': viewMode === 'list' }"
              :aria-pressed="viewMode === 'list'"
              :aria-label="t('store.storefront.viewList')"
              :title="t('store.storefront.viewList')"
              @click="setViewMode('list')"
            >
              <el-icon :size="18"><List /></el-icon>
            </button>
          </div>
        </div>
      </header>

      <div
        v-if="canCreateCard && catalogHasSelection && !products.length && !loading"
        class="storefront__facet-empty"
      >
        <p>{{ t('catalogFilters.emptyEditorStore') }}</p>
        <router-link class="btn btn-primary" :to="createProductTo">
          {{ t('store.editor.createCard') }}
        </router-link>
      </div>

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
      <div v-else-if="!products.length" class="storefront__empty">
        <p class="storefront__muted">{{ t('store.storefront.empty') }}</p>
        <router-link
          v-if="canCreateCard"
          class="btn btn-primary"
          :to="{ name: 'content-store-product-new' }"
        >
          {{ t('store.editor.createCard') }}
        </router-link>
      </div>

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
            <video
              v-else-if="coverOf(p)?.media_type === 'video' && coverOf(p)?.url"
              class="storefront__cover"
              :src="videoPreviewSrc(coverOf(p).url)"
              muted
              playsinline
              preload="metadata"
              @loadedmetadata="onVideoPreviewMeta"
            />
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
              <div class="storefront__cta-actions">
                <button type="button" class="btn btn-secondary" @click="openDescription(p.id)">
                  {{ t('store.storefront.openDescription') }}
                </button>
                <button type="button" class="btn btn-secondary" @click="addCart(p)">
                  {{ t('store.storefront.addToCart') }}
                </button>
                <button type="button" class="btn btn-primary" :disabled="buyingId === p.id" @click="buyNow(p)">
                  {{ buyingId === p.id ? t('store.common.saving') : t('store.storefront.buy') }}
                </button>
              </div>
              <div class="storefront__cta-meta">
                <router-link
                  v-if="canEditCard"
                  class="storefront__gear"
                  :to="{ name: 'content-store-product-edit', params: { id: p.id } }"
                  :title="t('store.editor.editCard')"
                  :aria-label="t('store.editor.editCard')"
                >
                  <el-icon :size="18"><Setting /></el-icon>
                </router-link>
                <span
                  class="storefront__views"
                  :title="t('blog.views.label')"
                >
                  <BlogGlyph name="views" />
                  <span>{{ Number(p.views_count) || 0 }}</span>
                </span>
                <button
                  type="button"
                  class="btn btn-secondary storefront__reviews"
                  :title="ratingTitle(p)"
                  @click="openReviews(p.id)"
                >
                  <StoreRating
                    stars-only
                    :rating-avg="p.rating_avg"
                    :review-count="p.review_count"
                  />
                  <span>{{ t('store.storefront.reviews') }}</span>
                  <span v-if="Number(p.review_count) > 0" class="storefront__reviews-n">
                    {{ p.review_count }}
                  </span>
                </button>
              </div>
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
import StoreRating from '@/components/store/StoreRating.vue';
import BlogGlyph from '@/components/blog/BlogGlyph.vue';
import { Grid, List, Plus, Setting, ShoppingCart, User } from '@element-plus/icons-vue';
import { useAuthContext } from '../../composables/useAuth';
import { usePermissions } from '../../composables/usePermissions';
import { PERMISSIONS } from '../../composables/permissions';
import { canAccessPath, ensureScreenAccessLoaded } from '../../composables/useScreenAccess.js';
import {
  addToStoreCart,
  createStoreCheckout,
  fetchStoreCatalog,
  fetchStoreSections,
  onStoreCartChange,
  storeCartCount,
  storeCartRoute,
  storeOrdersRoute,
} from '../../services/storeService';
import CatalogLinkedFilters from '@/components/catalog/CatalogLinkedFilters.vue';
import {
  catalogSelectionFromQuery,
  catalogSelectionToQuery,
  catalogTermsPayloadFromSelection,
  emptyCatalogSelection,
} from '@/services/catalogFiltersService';

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
const { authType, address, userId } = useAuthContext();
const { hasPermission } = usePermissions();
const cartTo = computed(() => storeCartRoute(userId.value));
const ordersTo = computed(() => storeOrdersRoute(userId.value));
const canCreateCard = computed(() =>
  hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS) && canAccessPath('/content/store/product/new')
);
const canEditCard = computed(() =>
  hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS) && canAccessPath('/content/store/product/:id')
);

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
const catalogFacets = ref(catalogSelectionFromQuery(route.query, { sectionParam: 'catalog_section' }));
let offCart = null;

const catalogHasSelection = computed(() =>
  Object.values(catalogFacets.value || {}).some(Boolean)
);

const createProductTo = computed(() => ({
  name: 'content-store-product-new',
  query: catalogTermsPayloadFromSelection(catalogFacets.value),
}));

function onCatalogFacetsChange(next) {
  catalogFacets.value = { ...emptyCatalogSelection(), ...next };
  const query = catalogSelectionToQuery(catalogFacets.value, { ...route.query }, { sectionParam: 'catalog_section' });
  router.replace({ name: route.name, params: route.params, query }).catch(() => {});
  loadCatalog();
}

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

function videoPreviewSrc(url) {
  const src = String(url || '');
  if (!src) return '';
  return src.includes('#') ? src : `${src}#t=0.1`;
}

function onVideoPreviewMeta(e) {
  const el = e?.target;
  if (!el || typeof el.currentTime !== 'number') return;
  if (el.currentTime >= 0.05) return;
  try {
    el.currentTime = 0.1;
  } catch {
    /* ignore */
  }
}

function ratingTitle(product) {
  const count = Math.max(0, Number(product?.review_count) || 0);
  const avg = Number(product?.rating_avg);
  return t('store.storefront.ratingLabel', {
    avg: count && Number.isFinite(avg) ? avg.toFixed(1) : '—',
    count,
  });
}

async function loadCatalog() {
  loading.value = true;
  error.value = '';
  try {
    const slug = route.params.slug || null;
    const facets = catalogTermsPayloadFromSelection(catalogFacets.value);
    const catalogQuery = {};
    if (facets.section) catalogQuery.catalog_section = facets.section;
    for (const [k, v] of Object.entries(facets)) {
      if (k === 'section' || !v) continue;
      catalogQuery[k] = v;
    }
    const [list, secs] = await Promise.all([
      fetchStoreCatalog({
        ...(slug ? { section: slug } : {}),
        ...catalogQuery,
      }),
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

function openDescription(id) {
  router.push({ name: 'store-product', params: { id }, hash: '#store-description' });
}

function openReviews(id) {
  router.push({ name: 'store-product', params: { id }, hash: '#store-reviews' });
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
watch(
  () => route.query,
  () => {
    const next = catalogSelectionFromQuery(route.query, { sectionParam: 'catalog_section' });
    const cur = catalogFacets.value || {};
    const keys = new Set([...Object.keys(cur), ...Object.keys(next)]);
    const same = [...keys].every((k) => (cur[k] || '') === (next[k] || ''));
    if (!same) {
      catalogFacets.value = next;
      loadCatalog();
    }
  },
  { deep: true }
);
onMounted(async () => {
  await ensureScreenAccessLoaded();
  catalogFacets.value = catalogSelectionFromQuery(route.query, { sectionParam: 'catalog_section' });
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
  gap: 0.75rem;
  flex-wrap: wrap;
}
.storefront__header-filters {
  flex: 1 1 auto;
  min-width: 0;
}
.storefront__facet-empty {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-start;
  margin: 0 0 1rem;
  padding: 0.85rem 1rem;
  border: 1px dashed var(--color-border, #ddd);
  border-radius: var(--radius-sm, 6px);
}
.storefront__header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
.storefront__icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  text-decoration: none;
  color: inherit;
  border-radius: 8px;
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.storefront__icon-btn .storefront__badge {
  position: absolute;
  top: -0.2rem;
  right: -0.2rem;
  margin: 0;
  min-width: 1.05rem;
  height: 1.05rem;
  padding: 0 0.28rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  line-height: 1;
}
.storefront__view-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
  padding: 0.15rem;
  border-radius: 8px;
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.storefront__view-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.55;
}
.storefront__view-btn.is-on {
  opacity: 1;
  background: color-mix(in srgb, currentColor 14%, transparent);
}
.storefront__badge {
  margin-left: 0.35rem;
  background: color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 999px;
  padding: 0.05rem 0.45rem;
  font-size: 0.8rem;
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
  grid-template-columns: 1fr;
}
@media (min-width: 720px) {
  .storefront__catalog--tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1080px) {
  .storefront__catalog--tiles {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
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
  pointer-events: none;
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
.storefront__catalog--tiles .storefront__desc {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.storefront__price {
  font-weight: 600;
  margin: 0.2rem 0;
}
.storefront__cta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.5rem;
}
.storefront__cta-actions {
  display: flex;
  align-items: stretch;
  gap: 0.5rem;
  width: 100%;
}
.storefront__cta-actions .btn {
  flex: 1 1 0;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  height: 2.25rem;
  min-height: 2.25rem;
  padding: 0 0.5rem;
  font-size: 0.875rem;
}
.storefront__cta-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}
.storefront__gear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 2.25rem;
  width: 2.25rem;
  height: 2.25rem;
  text-decoration: none;
  color: inherit;
  border-radius: 8px;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.storefront__views {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  height: 2.25rem;
  padding: 0 0.35rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-light, #8a8a8a);
  line-height: 1;
}
.storefront__views :deep(svg) {
  width: 1.1rem;
  height: 1.1rem;
  flex-shrink: 0;
}
.storefront__reviews {
  gap: 0.4rem;
  padding-left: 0.65rem;
  padding-right: 0.75rem;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 2.25rem;
  height: auto;
  overflow: hidden;
}
.storefront__reviews-n {
  font-weight: 650;
  min-width: 1.1em;
}
.storefront__error { color: #b42318; }
.storefront__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.85rem;
}
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
