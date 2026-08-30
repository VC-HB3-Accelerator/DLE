<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="store-cart-panel" :class="{ 'is-embedded': embedded }">
    <header class="store-cart-panel__header">
      <h2 v-if="embedded">{{ t('store.storefront.cart') }}</h2>
      <h1 v-else>{{ t('store.storefront.cart') }}</h1>
      <button type="button" class="btn btn-secondary" @click="reload">
        {{ t('store.common.refresh') }}
      </button>
    </header>

    <p v-if="!canPayWallet" class="store-cart-panel__warn">{{ t('store.storefront.walletOnly') }}</p>
    <p v-if="error" class="store-cart-panel__error">{{ error }}</p>
    <p v-else-if="!items.length" class="store-cart-panel__empty">
      {{ t('store.storefront.cartEmpty') }}
      <router-link class="btn btn-primary" :to="{ name: 'storefront' }">
        {{ t('store.storefront.toStore') }}
      </router-link>
    </p>

    <template v-else>
      <ul class="store-cart-panel__list">
        <li v-for="it in items" :key="it.productId" class="store-cart-panel__row">
          <div class="store-cart-panel__info">
            <router-link
              class="store-cart-panel__title"
              :to="{ name: 'store-product', params: { id: it.productId } }"
            >
              {{ it.title || it.productId }}
            </router-link>
            <p class="store-cart-panel__meta">
              {{ lineUnit(it) }} {{ it.payToken || '—' }}
              · {{ t('store.storefront.lineTotal') }}:
              <strong>{{ lineTotal(it) }} {{ it.payToken || '' }}</strong>
            </p>
          </div>
          <label class="store-cart-panel__qty">
            {{ t('store.storefront.qty') }}
            <input
              v-model.number="it.qty"
              type="number"
              min="1"
              :max="it.maxQty || 99"
              @change="onQty(it)"
            >
          </label>
          <button type="button" class="btn btn-secondary" @click="remove(it.productId)">
            {{ t('store.storefront.remove') }}
          </button>
        </li>
      </ul>

      <p v-if="mixedPay" class="store-cart-panel__error">{{ t('store.storefront.mixedPay') }}</p>

      <div class="store-cart-panel__summary">
        <div>
          <span>{{ t('store.storefront.cartTotal') }}</span>
          <strong v-if="!mixedPay">{{ totalHuman }} {{ totalSymbol }}</strong>
          <strong v-else>—</strong>
        </div>
        <p class="store-cart-panel__hint">{{ t('store.storefront.cartPayHint') }}</p>
      </div>

      <div class="store-cart-panel__actions">
        <router-link class="btn btn-secondary" :to="{ name: 'storefront' }">
          {{ t('store.storefront.continueShopping') }}
        </router-link>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="busy || mixedPay || !canPayWallet"
          @click="checkout"
        >
          {{ busy ? t('store.common.saving') : t('store.storefront.createOrder') }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthContext } from '@/composables/useAuth';
import {
  createStoreCheckout,
  fetchStoreCatalogProduct,
  readStoreCart,
  writeStoreCart,
} from '@/services/storeService';
import { formatStoreAmount } from '@/utils/storePayTransfer';

defineProps({
  embedded: { type: Boolean, default: false },
});

const { t } = useI18n();
const router = useRouter();
const { address, authType } = useAuthContext();

const items = ref([]);
const error = ref('');
const busy = ref(false);

const canPayWallet = computed(() => (
  String(authType?.value || '').toLowerCase() === 'wallet' && Boolean(address?.value)
));

const mixedPay = computed(() => {
  const tokens = [...new Set(
    items.value.map((i) => String(i.payTokenAddress || i.payToken || '').toLowerCase()).filter(Boolean)
  )];
  return tokens.length > 1;
});

const totalSymbol = computed(() => items.value[0]?.payToken || '');

const totalHuman = computed(() => {
  if (!items.value.length || mixedPay.value) return '—';
  try {
    let sum = 0n;
    let decimals = Number(items.value[0]?.decimals || 0);
    for (const it of items.value) {
      const unit = BigInt(String(it.priceUnits || '0'));
      sum += unit * BigInt(Number(it.qty || 1));
      decimals = Number(it.decimals || decimals);
    }
    return formatStoreAmount(sum.toString(), decimals);
  } catch {
    return '—';
  }
});

function lineUnit(it) {
  if (!it.priceUnits) return '—';
  return formatStoreAmount(it.priceUnits, it.decimals || 0);
}

function lineTotal(it) {
  if (!it.priceUnits) return '—';
  try {
    const total = BigInt(String(it.priceUnits)) * BigInt(Number(it.qty || 1));
    return formatStoreAmount(total.toString(), it.decimals || 0);
  } catch {
    return '—';
  }
}

function persist() {
  writeStoreCart(items.value);
}

function onQty(it) {
  const cap = Math.max(1, Math.min(99, Number(it.maxQty) || 99));
  it.qty = Math.max(1, Math.min(cap, Number(it.qty) || 1));
  persist();
}

function remove(productId) {
  items.value = items.value.filter((i) => String(i.productId) !== String(productId));
  persist();
}

async function enrichMissingPrices() {
  const next = [];
  for (const it of items.value) {
    if (it.priceUnits) {
      next.push(it);
      continue;
    }
    try {
      const p = await fetchStoreCatalogProduct(it.productId);
      next.push({
        ...it,
        title: it.title || p.title,
        payToken: p.pay_token_symbol || it.payToken,
        payTokenAddress: p.pay_token_address || it.payTokenAddress,
        priceUnits: String(p.price_units || '0'),
        decimals: Number(p.pay_token_decimals || 0),
        maxQty: Number(p.max_qty || 99),
      });
    } catch {
      next.push(it);
    }
  }
  items.value = next;
  persist();
}

async function reload() {
  items.value = readStoreCart();
  await enrichMissingPrices();
}

async function checkout() {
  error.value = '';
  if (!canPayWallet.value) {
    error.value = t('store.storefront.walletOnly');
    return;
  }
  busy.value = true;
  try {
    const payload = items.value.map((i) => ({
      productId: i.productId,
      qty: Number(i.qty || 1),
    }));
    const c = await createStoreCheckout(payload);
    writeStoreCart([]);
    items.value = [];
    await router.push({ name: 'store-pay', params: { id: c.id } });
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busy.value = false;
  }
}

onMounted(reload);
</script>

<style scoped>
.store-cart-panel.is-embedded {
  max-width: none;
  padding: 0;
  margin: 0;
}
.store-cart-panel:not(.is-embedded) {
  max-width: 820px;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 2.5rem;
}
.store-cart-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}
.store-cart-panel__header h1,
.store-cart-panel__header h2 {
  margin: 0;
  font-size: 1.4rem;
}
.store-cart-panel__header h2 {
  font-size: 1.2rem;
}
.store-cart-panel__list {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
  display: grid;
  gap: 0.85rem;
}
.store-cart-panel__row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.75rem;
  align-items: center;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
}
.store-cart-panel__title {
  color: inherit;
  text-decoration: none;
  font-weight: 600;
}
.store-cart-panel__meta {
  margin: 0.3rem 0 0;
  opacity: 0.75;
  font-size: 0.88rem;
}
.store-cart-panel__qty {
  display: grid;
  gap: 0.25rem;
  font-size: 0.85rem;
}
.store-cart-panel__qty input {
  width: 4.5rem;
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  border-radius: 8px;
  padding: 0.4rem 0.5rem;
  background: transparent;
  color: inherit;
  font: inherit;
}
.store-cart-panel__summary {
  display: grid;
  gap: 0.35rem;
  padding: 0.85rem 0;
  margin-bottom: 0.5rem;
}
.store-cart-panel__summary > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 1.1rem;
}
.store-cart-panel__hint {
  margin: 0;
  opacity: 0.7;
  font-size: 0.88rem;
}
.store-cart-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}
.store-cart-panel__empty {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  opacity: 0.85;
}
.store-cart-panel__error { color: #b42318; }
.store-cart-panel__warn { opacity: 0.85; }
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
@media (max-width: 640px) {
  .store-cart-panel__row {
    grid-template-columns: 1fr;
  }
}
</style>
