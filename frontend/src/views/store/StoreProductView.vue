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
    <div class="product-page page-with-close">
      <PageCloseButton :fallback="{ name: 'storefront' }" />

      <header class="product-page__top">
        <router-link
          class="product-page__icon-btn"
          :to="cartTo"
          :title="t('store.storefront.cart')"
          :aria-label="t('store.storefront.cart')"
        >
          <el-icon :size="18"><ShoppingCart /></el-icon>
          <span v-if="cartCount" class="product-page__badge">{{ cartCount }}</span>
        </router-link>
        <router-link
          v-if="ordersTo"
          class="product-page__icon-btn"
          :to="ordersTo"
          :title="t('store.cabinet.title')"
          :aria-label="t('store.cabinet.title')"
        >
          <el-icon :size="18"><User /></el-icon>
        </router-link>
      </header>

      <p v-if="error" class="product-page__error">{{ error }}</p>
      <p v-else-if="loading" class="product-page__muted">{{ t('store.common.loading') }}</p>

      <article v-else-if="product" class="product-page__card">
        <div class="product-page__gallery">
          <template v-if="product.media?.length">
            <div
              v-for="m in product.media"
              :key="m.id"
              class="product-page__media"
            >
              <img v-if="m.media_type === 'image' && m.url" :src="m.url" :alt="m.file_name || product.title">
              <video v-else-if="m.media_type === 'video' && m.url" :src="m.url" controls />
            </div>
          </template>
          <div v-else class="product-page__media product-page__media--empty">
            {{ t('store.storefront.noMedia') }}
          </div>
        </div>

        <div id="store-description" class="product-page__info">
          <p class="product-page__kind">{{ kindLabel }}</p>
          <h1>{{ product.title }}</h1>
          <p v-if="product.summary" class="product-page__summary">{{ product.summary }}</p>
          <p class="product-page__price">
            {{ formatStoreAmount(product.price_units, product.pay_token_decimals) }}
            {{ product.pay_token_symbol }}
          </p>
          <StoreRating :rating-avg="product.rating_avg" :review-count="product.review_count" />
          <p
            v-if="product.receipt_enabled || product.license_token_address"
            class="product-page__hint"
          >
            {{ t('store.storefront.receiptHint', {
              amount: formatStoreAmount(product.license_amount_units || '1', product.license_token_decimals || 0),
              symbol: product.license_token_symbol || 'TOKEN',
            }) }}
          </p>
          <p v-if="product.benefit_note" class="product-page__benefit">{{ product.benefit_note }}</p>

          <label class="product-page__qty">
            {{ t('store.storefront.qty') }}
            <input v-model.number="qty" type="number" min="1" :max="maxQty">
          </label>

          <section v-if="product.description" class="product-page__section">
            <h2>{{ t('store.product.description') }}</h2>
            <p class="product-page__text">{{ product.description }}</p>
          </section>

          <section v-if="product.features" class="product-page__section">
            <h2>{{ t('store.product.features') }}</h2>
            <pre class="product-page__features">{{ product.features }}</pre>
          </section>

          <section v-if="product.attributes?.length" class="product-page__section">
            <h2>{{ t('store.product.attributes') }}</h2>
            <dl class="product-page__attrs">
              <template v-for="(attr, idx) in product.attributes" :key="idx">
                <dt>{{ attr.label }}</dt>
                <dd>{{ attr.value }}</dd>
              </template>
            </dl>
          </section>

          <p v-if="actionError" class="product-page__error">{{ actionError }}</p>
          <p v-if="!canPayWallet" class="product-page__warn">{{ t('store.storefront.walletOnly') }}</p>

          <div class="product-page__cta">
            <button type="button" class="btn btn-secondary" :disabled="busy" @click="onAddCart">
              {{ t('store.storefront.addToCart') }}
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="busy || !canPayWallet"
              @click="onBuy"
            >
              {{ busy ? t('store.common.saving') : t('store.storefront.buy') }}
            </button>
          </div>
        </div>
        <StoreReviewList
          class="product-page__reviews"
          :product-id="String(product.id)"
          :can-reply="canViewCrm"
        />
      </article>
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import StoreRating from '@/components/store/StoreRating.vue';
import StoreReviewList from '@/components/store/StoreReviewList.vue';
import { useAuthContext } from '../../composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import { ShoppingCart, User } from '@element-plus/icons-vue';
import {
  addToStoreCart,
  createStoreCheckout,
  fetchStoreCatalogProduct,
  onStoreCartChange,
  storeCartCount,
  storeCartRoute,
  storeOrdersRoute,
} from '../../services/storeService';
import { formatStoreAmount } from '../../utils/storePayTransfer';

defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});
defineEmits(['auth-action-completed']);

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { address, authType, userId } = useAuthContext();
const { canViewCrm } = usePermissions();

const product = ref(null);
const loading = ref(false);
const error = ref('');
const actionError = ref('');
const busy = ref(false);
const qty = ref(1);
const cartCount = ref(storeCartCount());
let offCart = null;

const canPayWallet = computed(() => (
  String(authType?.value || '').toLowerCase() === 'wallet' && Boolean(address?.value)
));
const cartTo = computed(() => storeCartRoute(userId.value));
const ordersTo = computed(() => storeOrdersRoute(userId.value));

const maxQty = computed(() => Math.max(1, Math.min(99, Number(product.value?.max_qty || 1))));

const kindLabel = computed(() => (
  product.value?.kind === 'service'
    ? t('store.editor.kindService')
    : t('store.editor.kindProduct')
));

function cartPayload() {
  return {
    productId: product.value.id,
    qty: Math.max(1, Math.min(maxQty.value, Number(qty.value) || 1)),
    title: product.value.title,
    payToken: product.value.pay_token_symbol || product.value.pay_token_address,
    payTokenAddress: product.value.pay_token_address,
    priceUnits: product.value.price_units,
    decimals: product.value.pay_token_decimals,
    maxQty: maxQty.value,
  };
}

function onAddCart() {
  actionError.value = '';
  addToStoreCart(cartPayload());
  cartCount.value = storeCartCount();
}

async function onBuy() {
  actionError.value = '';
  if (!canPayWallet.value) {
    actionError.value = t('store.storefront.walletOnly');
    return;
  }
  busy.value = true;
  try {
    const c = await createStoreCheckout([{
      productId: product.value.id,
      qty: Math.max(1, Math.min(maxQty.value, Number(qty.value) || 1)),
    }]);
    await router.push({ name: 'store-pay', params: { id: c.id } });
  } catch (e) {
    actionError.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busy.value = false;
  }
}

async function loadProduct() {
  loading.value = true;
  error.value = '';
  product.value = null;
  try {
    product.value = await fetchStoreCatalogProduct(route.params.id);
    qty.value = 1;
    const p = product.value;
    if (p) {
      const title = `${p.title} · ${t('store.storefront.title')}`;
      document.title = title;
      const description = String(p.summary || p.description || p.title || '').slice(0, 300);
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', `${window.location.origin}/store/${encodeURIComponent(p.id)}`);
    }
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.loadError');
  } finally {
    loading.value = false;
  }
}

async function scrollToHash() {
  const id = String(route.hash || '').replace(/^#/, '');
  if (id !== 'store-reviews' && id !== 'store-description') return;
  await nextTick();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(async () => {
  await loadProduct();
  await scrollToHash();
  offCart = onStoreCartChange(() => {
    cartCount.value = storeCartCount();
  });
  if (String(route.query.buy || '') === '1' && product.value && canPayWallet.value) {
    await onBuy();
  }
});

onUnmounted(() => {
  if (offCart) offCart();
});

watch(() => route.params.id, async () => {
  await loadProduct();
  await scrollToHash();
});
watch(() => route.hash, scrollToHash);
</script>

<style scoped>
.product-page {
  padding: 1.25rem 1.5rem 2.5rem;
  max-width: 1100px;
  margin: 0 auto;
}
.product-page__top {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.product-page__icon-btn {
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
.product-page__badge {
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
  background: color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 999px;
}
.product-page__card {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}
.product-page__reviews {
  grid-column: 1 / -1;
}
.product-page__gallery {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.product-page__media {
  border-radius: 12px;
  overflow: hidden;
  background: color-mix(in srgb, currentColor 8%, transparent);
  min-height: 180px;
}
.product-page__media img,
.product-page__media video {
  width: 100%;
  display: block;
  max-height: 420px;
  object-fit: contain;
  background: #111;
}
.product-page__media--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}
.product-page__info h1 {
  margin: 0.25rem 0 0.5rem;
  font-size: 1.6rem;
}
.product-page__kind,
.product-page__summary,
.product-page__hint,
.product-page__benefit,
.product-page__text,
.product-page__muted,
.product-page__warn {
  margin: 0.35rem 0;
  opacity: 0.8;
}
.product-page__price {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0.75rem 0 0.35rem;
}
.product-page__qty {
  display: grid;
  gap: 0.3rem;
  max-width: 8rem;
  margin: 0.75rem 0;
  font-size: 0.9rem;
}
.product-page__qty input {
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  border-radius: 8px;
  padding: 0.45rem 0.55rem;
  background: transparent;
  color: inherit;
  font: inherit;
}
.product-page__section { margin-top: 1rem; }
.product-page__section h2 {
  margin: 0 0 0.4rem;
  font-size: 1.05rem;
}
.product-page__features {
  margin: 0;
  white-space: pre-wrap;
  font: inherit;
  opacity: 0.9;
}
.product-page__attrs {
  display: grid;
  grid-template-columns: minmax(100px, 40%) 1fr;
  gap: 0.35rem 0.75rem;
  margin: 0;
}
.product-page__attrs dt { opacity: 0.7; }
.product-page__attrs dd { margin: 0; }
.product-page__cta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1.25rem;
}
.product-page__error { color: #b42318; }
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  border: 0;
  cursor: pointer;
  border-radius: 8px;
  padding: 0.5rem 0.95rem;
  font: inherit;
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primary { background: var(--color-primary, #1a5fff); color: #fff; }
.btn-secondary {
  background: color-mix(in srgb, currentColor 10%, transparent);
  color: inherit;
}
@media (max-width: 820px) {
  .product-page__card { grid-template-columns: 1fr; }
}
</style>
