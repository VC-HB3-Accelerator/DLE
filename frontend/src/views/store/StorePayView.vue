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
    <div class="store-pay page-with-close">
      <PageCloseButton :fallback="cartTo" />

      <header class="store-pay__header">
        <h1>{{ t('store.storefront.payTitle') }}</h1>
        <router-link class="btn btn-secondary" :to="cartTo">
          {{ t('store.storefront.cart') }}
          <span v-if="cartCount" class="store-pay__badge">{{ cartCount }}</span>
        </router-link>
      </header>

      <p v-if="error" class="store-pay__error">{{ error }}</p>
      <p v-else-if="loading" class="store-pay__muted">{{ t('store.common.loading') }}</p>

      <section v-else-if="checkout" class="store-pay__card">
        <p class="store-pay__status">
          {{ t('store.storefront.status') }}:
          <strong>{{ statusLabel(checkout.status) }}</strong>
        </p>

        <ul v-if="checkout.items?.length" class="store-pay__items">
          <li v-for="(it, idx) in checkout.items" :key="idx">
            <strong>{{ it.product_title || it.product_id }}</strong>
            <span>× {{ it.qty }}</span>
          </li>
        </ul>

        <div class="store-pay__amount">
          <span>{{ t('store.storefront.payExact') }}</span>
          <strong>
            {{ formatStoreAmount(checkout.amount_unique_units, checkout.pay_token_decimals) }}
            {{ checkout.pay_token_symbol }}
          </strong>
        </div>

        <dl class="store-pay__meta">
          <dt>{{ t('store.storefront.wallet') }}</dt>
          <dd>{{ checkout.buyer }}</dd>
          <dt>{{ t('store.storefront.toTreasury') }}</dt>
          <dd>{{ checkout.treasury_address }}</dd>
          <dt v-if="checkout.tx_hash">{{ t('store.storefront.txHash') }}</dt>
          <dd v-if="checkout.tx_hash">{{ checkout.tx_hash }}</dd>
        </dl>

        <p v-if="nativePayBlocked" class="store-pay__error">{{ t('store.storefront.nativePayBlocked') }}</p>
        <p v-if="payMsg" class="store-pay__msg" :class="{ 'store-pay__error': payFailed }">{{ payMsg }}</p>

        <div class="store-pay__actions">
          <button
            v-if="checkout.status === 'awaiting_payment'"
            type="button"
            class="btn btn-primary"
            :disabled="nativePayBlocked || Boolean(busy)"
            @click="onPayWallet"
          >
            {{ busy === 'pay' ? t('store.storefront.paying') : t('store.storefront.payFromWallet') }}
          </button>
          <button
            v-if="checkout.status === 'awaiting_payment'"
            type="button"
            class="btn btn-secondary"
            :disabled="busy"
            @click="onCheck"
          >
            {{ busy === 'check' ? t('store.common.checking') : t('store.storefront.checkPayment') }}
          </button>
          <router-link
            v-if="checkout.status === 'paid'"
            class="btn btn-primary"
            :to="afterPaidTo"
          >
            {{ t('store.storefront.paidContinue') }}
          </router-link>
        </div>
      </section>
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import { useAuthContext } from '../../composables/useAuth';
import {
  checkStoreCheckoutPayment,
  fetchStoreCheckout,
  onStoreCartChange,
  storeCartCount,
  storeCartRoute,
} from '../../services/storeService';
import { formatStoreAmount, isNativePayToken, transferErc20FromWallet } from '../../utils/storePayTransfer';

defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});
defineEmits(['auth-action-completed']);

const { t } = useI18n();
const route = useRoute();
const { userId } = useAuthContext();

const checkout = ref(null);
const loading = ref(false);
const error = ref('');
const busy = ref('');
const payMsg = ref('');
const payFailed = ref(false);
const cartCount = ref(storeCartCount());
let offCart = null;

const nativePayBlocked = computed(() => (
  Boolean(checkout.value && isNativePayToken(checkout.value.pay_token_address))
));

const afterPaidTo = computed(() => {
  const id = userId.value || checkout.value?.user_id;
  if (!id) return { name: 'storefront' };
  return { name: 'contact-orders', params: { id: String(id) } };
});
const cartTo = computed(() => storeCartRoute(userId.value));

function statusLabel(status) {
  const key = `store.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    checkout.value = await fetchStoreCheckout(route.params.id);
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.loadError');
  } finally {
    loading.value = false;
  }
}

async function onPayWallet() {
  if (!checkout.value) return;
  if (nativePayBlocked.value) {
    payFailed.value = true;
    payMsg.value = t('store.storefront.nativePayBlocked');
    return;
  }
  busy.value = 'pay';
  payMsg.value = '';
  payFailed.value = false;
  try {
    const { hash } = await transferErc20FromWallet({
      tokenAddress: checkout.value.pay_token_address,
      to: checkout.value.treasury_address,
      amountUnits: checkout.value.amount_unique_units,
      expectedFrom: checkout.value.buyer,
      chainId: checkout.value.chain_id,
    });
    payMsg.value = t('store.storefront.paySent');
    checkout.value = await checkStoreCheckoutPayment(checkout.value.id, { txHash: hash });
    if (checkout.value.status !== 'paid') {
      payMsg.value = t('store.storefront.paySentWaiting');
    }
  } catch (e) {
    payFailed.value = true;
    payMsg.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busy.value = '';
  }
}

async function onCheck() {
  if (!checkout.value?.id) return;
  busy.value = 'check';
  payMsg.value = '';
  payFailed.value = false;
  try {
    checkout.value = await checkStoreCheckoutPayment(checkout.value.id);
    if (checkout.value.status === 'paid') {
      payMsg.value = t('store.storefront.paidOk');
    } else {
      payMsg.value = t('store.storefront.payNotFound');
      payFailed.value = true;
    }
  } catch (e) {
    payFailed.value = true;
    payMsg.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busy.value = '';
  }
}

onMounted(() => {
  load();
  offCart = onStoreCartChange(() => {
    cartCount.value = storeCartCount();
  });
});

onUnmounted(() => {
  if (offCart) offCart();
});
</script>

<style scoped>
.store-pay {
  max-width: 720px;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 2.5rem;
}
.store-pay__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.store-pay__header h1 {
  margin: 0;
  font-size: 1.4rem;
}
.store-pay__badge {
  margin-left: 0.35rem;
  background: color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 999px;
  padding: 0.05rem 0.45rem;
  font-size: 0.8rem;
}
.store-pay__card {
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 12px;
  padding: 1.1rem 1.2rem;
  display: grid;
  gap: 0.85rem;
}
.store-pay__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}
.store-pay__items li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}
.store-pay__amount {
  display: grid;
  gap: 0.25rem;
}
.store-pay__amount strong {
  font-size: 1.35rem;
}
.store-pay__meta {
  display: grid;
  grid-template-columns: minmax(110px, 32%) 1fr;
  gap: 0.35rem 0.75rem;
  margin: 0;
  font-size: 0.9rem;
}
.store-pay__meta dt { opacity: 0.7; }
.store-pay__meta dd {
  margin: 0;
  word-break: break-all;
}
.store-pay__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.store-pay__error { color: #b42318; }
.store-pay__warn,
.store-pay__muted,
.store-pay__msg { opacity: 0.85; margin: 0; }
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
</style>
