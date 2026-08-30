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
    <div class="store-crm page-with-close">
      <PageCloseButton :fallback="{ name: 'crm' }" />
      <StoreAdminNav />
      <header class="store-crm__header">
        <h1>{{ t('store.crm.title') }}</h1>
        <div class="store-crm__header-actions">
          <button type="button" class="btn btn-secondary" :disabled="loading" @click="exportCsv">
            {{ t('store.crm.exportCsv') }}
          </button>
          <button type="button" class="btn btn-secondary" :disabled="loading" @click="loadAll">
            {{ t('store.common.refresh') }}
          </button>
        </div>
      </header>

      <section v-if="!loading" class="store-crm__activity">
        <h2>{{ t('store.crm.activityTitle') }}</h2>
        <p v-if="!activity.length" class="store-crm__muted">{{ t('store.crm.activityEmpty') }}</p>
        <ul v-else class="store-crm__activity-list">
          <li v-for="ev in activity" :key="ev.id" class="store-crm__activity-item">
            <div>
              <strong>{{ activityLabel(ev) }}</strong>
              <span class="store-crm__meta">{{ formatDate(ev.created_at) }}</span>
              <span v-if="ev.buyer" class="store-crm__meta">{{ ev.buyer }}</span>
            </div>
            <router-link
              v-if="activityTo(ev)"
              class="btn btn-secondary"
              :to="activityTo(ev)"
            >
              {{ t('store.crm.activityOpen') }}
            </router-link>
          </li>
        </ul>
      </section>

      <nav class="store-crm__tabs">
        <button
          type="button"
          class="store-crm__tab"
          :class="{ 'store-crm__tab--active': tab === 'orders' }"
          @click="tab = 'orders'"
        >
          {{ t('store.crm.ordersTab') }} ({{ orders.length }})
        </button>
        <button
          type="button"
          class="store-crm__tab"
          :class="{ 'store-crm__tab--active': tab === 'checkouts' }"
          @click="tab = 'checkouts'"
        >
          {{ t('store.crm.checkouts') }} ({{ checkouts.length }})
        </button>
      </nav>

      <div v-if="tab === 'orders'" class="store-crm__filters">
        <label>
          <span>{{ t('store.crm.filterStatus') }}</span>
          <select v-model="filterStatus" @change="loadAll">
            <option value="">{{ t('store.crm.filterAll') }}</option>
            <option v-for="s in statusOptions" :key="s" :value="s">{{ statusLabel(s) }}</option>
          </select>
        </label>
        <label class="store-crm__search">
          <span>{{ t('store.crm.search') }}</span>
          <input
            v-model="filterQ"
            type="search"
            :placeholder="t('store.crm.searchPlaceholder')"
            @keyup.enter="loadAll"
          >
        </label>
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="loadAll">
          {{ t('store.crm.applyFilters') }}
        </button>
      </div>

      <p v-if="error" class="store-crm__error">{{ error }}</p>
      <p v-else-if="loading" class="store-crm__muted">{{ t('store.common.loading') }}</p>

      <template v-else-if="tab === 'orders'">
        <p v-if="!orders.length" class="store-crm__muted">{{ t('store.crm.empty') }}</p>
        <ul v-else class="store-crm__list">
          <li v-for="o in orders" :key="o.id" class="store-crm__item">
            <div class="store-crm__main">
              <div class="store-crm__title-row">
                <strong>{{ o.product_title || o.product_id }}</strong>
                <span class="store-crm__pill">{{ statusLabel(o.status) }}</span>
              </div>
              <span class="store-crm__meta">{{ formatDate(o.created_at) }}</span>
              <span class="store-crm__meta">{{ t('store.crm.buyer') }}: {{ o.buyer }}</span>
              <span class="store-crm__meta">
                {{ t('store.crm.amount') }}:
                {{ formatUnits(o.amount_unique_units || o.price_units, o.pay_token_decimals) }}
                {{ o.pay_token_symbol }}
                <template v-if="o.qty && o.qty > 1"> · ×{{ o.qty }}</template>
              </span>
              <span v-if="o.tx_hash" class="store-crm__meta">
                {{ t('store.storefront.txHash') }}: {{ o.tx_hash }}
              </span>
              <span v-if="o.receipt_standard" class="store-crm__meta">
                {{ t('store.crm.receiptStandard', { standard: o.receipt_standard }) }}
              </span>
              <span v-else-if="!o.license_token_address" class="store-crm__meta">
                {{ t('store.crm.noReceipt') }}
              </span>
              <span v-if="o.fulfillment_proposal_id" class="store-crm__meta">
                {{ t('store.crm.proposalId') }}: {{ o.fulfillment_proposal_id }}
              </span>
              <span v-if="o.treasury_balances" class="store-crm__meta">
                {{ t('store.crm.treasuryBalances') }}:
                {{ o.treasury_balances.pay_token_symbol || t('store.editor.payToken') }}
                {{ o.treasury_balances.pay ?? '—' }}
                ·
                {{ o.treasury_balances.license_token_symbol || t('store.editor.receiptToken') }}
                {{ o.treasury_balances.license ?? '—' }}
              </span>
            </div>
            <div class="store-crm__actions">
              <button
                v-if="o.status === 'awaiting_payment'"
                type="button"
                class="btn btn-secondary"
                :disabled="busyId === o.id"
                @click="onCheckPay(o)"
              >
                {{ t('store.crm.checkPayment') }}
              </button>
              <button
                v-if="o.status === 'awaiting_payment'"
                type="button"
                class="btn btn-secondary"
                :disabled="busyId === o.id"
                @click="onCancel(o)"
              >
                {{ t('store.crm.cancelOrder') }}
              </button>
              <button
                v-if="o.status === 'paid' && o.license_token_address"
                type="button"
                class="btn btn-primary"
                :disabled="busyId === o.id"
                @click="onFulfill(o)"
              >
                {{ t('store.crm.createFulfillment') }}
              </button>
              <button
                v-if="o.status === 'paid' && !o.license_token_address"
                type="button"
                class="btn btn-primary"
                :disabled="busyId === o.id"
                @click="onMarkFulfilled(o)"
              >
                {{ t('store.crm.markServed') }}
              </button>
              <button
                v-if="o.status === 'fulfillment_proposed'"
                type="button"
                class="btn btn-primary"
                :disabled="busyId === o.id"
                @click="onMarkFulfilled(o)"
              >
                {{ t('store.crm.markFulfilled') }}
              </button>
              <a
                v-if="o.fulfillment_proposal_id && settingsDle"
                class="btn btn-secondary"
                :href="proposalHref(o.fulfillment_proposal_id)"
              >
                {{ t('store.crm.openProposal') }}
              </a>
              <button
                v-if="o.status === 'paid' || o.status === 'fulfillment_proposed'"
                type="button"
                class="btn btn-secondary"
                :disabled="busyId === o.id"
                @click="onRefund(o)"
              >
                {{ t('store.crm.createRefund') }}
              </button>
              <button
                v-if="o.status === 'refund_proposed'"
                type="button"
                class="btn btn-primary"
                :disabled="busyId === o.id"
                @click="onMarkRefunded(o)"
              >
                {{ t('store.crm.markRefunded') }}
              </button>
            </div>
          </li>
        </ul>
      </template>

      <template v-else>
        <p v-if="!checkouts.length" class="store-crm__muted">{{ t('store.crm.checkoutsEmpty') }}</p>
        <ul v-else class="store-crm__list">
          <li v-for="c in checkouts" :key="c.id" class="store-crm__item store-crm__item--col">
            <div class="store-crm__main">
              <div class="store-crm__title-row">
                <strong>{{ checkoutTitle(c) }}</strong>
                <span class="store-crm__pill">{{ statusLabel(c.status) }}</span>
              </div>
              <span class="store-crm__meta">{{ formatDate(c.created_at) }}</span>
              <span class="store-crm__meta">{{ t('store.crm.buyer') }}: {{ c.buyer }}</span>
              <span class="store-crm__meta">
                {{ t('store.crm.amount') }}:
                {{ formatUnits(c.amount_unique_units, c.pay_token_decimals) }}
                {{ c.pay_token_symbol }}
              </span>
              <span v-if="c.tx_hash" class="store-crm__meta">
                {{ t('store.storefront.txHash') }}: {{ c.tx_hash }}
              </span>
              <button
                type="button"
                class="store-crm__linkish"
                @click="toggleCheckout(c.id)"
              >
                {{ expanded[c.id] ? t('store.crm.hideItems') : t('store.crm.showItems') }}
                ({{ (c.items || []).length }})
              </button>
              <ul v-if="expanded[c.id]" class="store-crm__items">
                <li v-for="it in (c.items || [])" :key="it.id || it.order_id">
                  {{ it.product_title || it.product_id }}
                  · ×{{ it.qty || 1 }}
                  <template v-if="it.receipt_enabled"> · {{ t('store.crm.hasReceipt') }}</template>
                </li>
              </ul>
            </div>
            <div class="store-crm__actions">
              <router-link
                v-if="c.status === 'awaiting_payment'"
                class="btn btn-secondary"
                :to="{ name: 'store-pay', params: { id: c.id } }"
              >
                {{ t('store.crm.openPay') }}
              </router-link>
              <button
                v-if="c.status === 'awaiting_payment'"
                type="button"
                class="btn btn-secondary"
                :disabled="busyId === c.id"
                @click="onCheckCheckout(c)"
              >
                {{ t('store.crm.checkPayment') }}
              </button>
            </div>
          </li>
        </ul>
      </template>
    </div>
  </BaseLayout>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ethers } from 'ethers';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import StoreAdminNav from '../../components/store/StoreAdminNav.vue';
import {
  cancelStoreOrder,
  checkStoreCheckoutPayment,
  checkStorePayment,
  fetchStoreActivity,
  fetchStoreCheckoutsCrm,
  fetchStoreOrders,
  fetchStoreSettings,
  markStoreOrderFulfilled,
  markStoreOrderRefunded,
  prepareStoreFulfillment,
  prepareStoreRefund,
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
const orders = ref([]);
const checkouts = ref([]);
const activity = ref([]);
const tab = ref('orders');
const loading = ref(false);
const error = ref('');
const busyId = ref('');
const filterStatus = ref('');
const filterQ = ref('');
const expanded = reactive({});
const settingsDle = ref('');

const statusOptions = [
  'awaiting_payment',
  'paid',
  'fulfillment_proposed',
  'fulfilled',
  'refund_proposed',
  'refunded',
  'expired',
  'cancelled',
];

function formatUnits(units, decimals) {
  try {
    return ethers.formatUnits(String(units || '0'), Number(decimals || 0));
  } catch {
    return String(units || '0');
  }
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function statusLabel(status) {
  const key = `store.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

function checkoutTitle(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  if (!items.length) return c.id;
  if (items.length === 1) return items[0].product_title || items[0].product_id;
  return t('store.crm.checkoutItems', { count: items.length });
}

function toggleCheckout(id) {
  expanded[id] = !expanded[id];
}

function proposalHref(proposalId) {
  const q = new URLSearchParams();
  if (settingsDle.value) q.set('address', settingsDle.value);
  if (proposalId) q.set('proposalId', String(proposalId));
  return `/management/proposals?${q.toString()}`;
}

function activityLabel(ev) {
  const key = `store.crm.activityKind.${ev.kind}`;
  const label = t(key);
  return label === key ? ev.kind : label;
}

function activityTo(ev) {
  const id = ev?.contact_id;
  if (!id) return null;
  if (ev.kind === 'store_ask') {
    return { name: 'contact-details', params: { id: String(id) } };
  }
  return { name: 'contact-orders', params: { id: String(id) } };
}

async function loadAll() {
  loading.value = true;
  error.value = '';
  try {
    const params = {};
    if (filterStatus.value) params.status = filterStatus.value;
    if (filterQ.value.trim()) params.q = filterQ.value.trim();
    const [o, c, s, ev] = await Promise.all([
      fetchStoreOrders(params),
      fetchStoreCheckoutsCrm().catch(() => []),
      fetchStoreSettings().catch(() => null),
      fetchStoreActivity().catch(() => []),
    ]);
    orders.value = Array.isArray(o) ? o : [];
    checkouts.value = Array.isArray(c) ? c : [];
    settingsDle.value = s?.primary_dle_address || '';
    activity.value = Array.isArray(ev) ? ev : [];
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.loadError');
  } finally {
    loading.value = false;
  }
}

function goPrefill(prefill) {
  const q = prefill?.query || prefill || {};
  const op = q.op || 'transferFunds';
  router.push({
    name: 'management-treasury-bridge-op',
    query: {
      op,
      moduleType: q.moduleType || 'treasury',
      address: q.address || q.dleAddress || '',
      chainId: q.chainId || '',
      token: q.token || q.tokenAddress || '',
      decimals: q.decimals ?? '',
      recipient: q.recipient || '',
      amount: q.amount || q.amountHuman || '',
      tokenId: q.tokenId || '',
      proposalRef: q.proposalRef || '',
      description: q.description || '',
      orderId: q.orderId || '',
      returnTo: '/crm/store',
    },
  });
}

async function onFulfill(order) {
  busyId.value = order.id;
  error.value = '';
  try {
    const standard = String(order.receipt_standard || 'erc20').toLowerCase();
    const body = {};
    if (standard === 'erc721') {
      const qty = Math.max(1, Number(order.qty || 1));
      const raw = window.prompt(t('store.crm.nftTokenIdsPrompt', { count: qty }), '');
      if (raw == null) return;
      body.tokenIds = String(raw).split(/[\s,;]+/).filter(Boolean);
    } else if (standard === 'erc1155') {
      const hint = order.receipt_erc1155_token_id != null
        ? String(order.receipt_erc1155_token_id)
        : '';
      const raw = window.prompt(t('store.crm.nftTokenIdPrompt'), hint);
      if (raw == null) return;
      if (String(raw).trim()) body.erc1155TokenId = String(raw).trim();
    }
    const data = await prepareStoreFulfillment(order.id, body);
    const list = Array.isArray(data?.prefills) && data.prefills.length
      ? data.prefills
      : [data?.prefill || data].filter(Boolean);
    if (list.length > 1) {
      window.alert(t('store.crm.nftMultiPrefill', { count: list.length }));
    }
    goPrefill(list[0]);
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busyId.value = '';
  }
}

async function onRefund(order) {
  busyId.value = order.id;
  try {
    const data = await prepareStoreRefund(order.id);
    goPrefill(data?.prefill || data);
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busyId.value = '';
  }
}

async function onCheckPay(order) {
  busyId.value = order.id;
  error.value = '';
  try {
    const hint = window.prompt(t('store.crm.txHashOptional'), order.tx_hash || '') || '';
    await checkStorePayment(order.id, { txHash: hint.trim() || undefined });
    await loadAll();
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busyId.value = '';
  }
}

async function onCheckCheckout(c) {
  busyId.value = c.id;
  error.value = '';
  try {
    const hint = window.prompt(t('store.crm.txHashOptional'), c.tx_hash || '') || '';
    await checkStoreCheckoutPayment(c.id, { txHash: hint.trim() || undefined });
    await loadAll();
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busyId.value = '';
  }
}

async function onCancel(order) {
  if (!window.confirm(t('store.crm.cancelConfirm'))) return;
  busyId.value = order.id;
  try {
    await cancelStoreOrder(order.id);
    await loadAll();
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busyId.value = '';
  }
}

async function onMarkFulfilled(order) {
  busyId.value = order.id;
  try {
    await markStoreOrderFulfilled(order.id);
    await loadAll();
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busyId.value = '';
  }
}

async function onMarkRefunded(order) {
  busyId.value = order.id;
  try {
    await markStoreOrderRefunded(order.id);
    await loadAll();
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busyId.value = '';
  }
}

function exportCsv() {
  const list = orders.value || [];
  const headers = [
    'id', 'status', 'product_title', 'buyer', 'qty', 'amount', 'symbol',
    'tx_hash', 'receipt_standard', 'fulfillment_proposal_id', 'created_at',
  ];
  const lines = [headers.join(',')];
  for (const o of list) {
    const row = [
      o.id,
      o.status,
      JSON.stringify(o.product_title || ''),
      o.buyer,
      o.qty || 1,
      formatUnits(o.amount_unique_units || o.price_units, o.pay_token_decimals),
      o.pay_token_symbol || '',
      o.tx_hash || '',
      o.receipt_standard || '',
      o.fulfillment_proposal_id || '',
      o.created_at || '',
    ];
    lines.push(row.join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `store-orders-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(loadAll);
</script>

<style scoped>
.store-crm {
  padding: 1.25rem 1.5rem 2.5rem;
  max-width: 980px;
  margin: 0 auto;
}
.store-crm__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.store-crm__header h1 {
  margin: 0;
  font-size: 1.35rem;
}
.store-crm__header-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.store-crm__activity {
  margin: 0 0 1.25rem;
}
.store-crm__activity h2 {
  margin: 0 0 0.6rem;
  font-size: 1.05rem;
}
.store-crm__activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.store-crm__activity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 10px;
  padding: 0.65rem 0.8rem;
}
.store-crm__tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
  flex-wrap: wrap;
}
.store-crm__tab {
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  background: transparent;
  color: inherit;
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  font: inherit;
}
.store-crm__tab--active {
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.store-crm__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;
  margin-bottom: 1rem;
}
.store-crm__filters label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
}
.store-crm__filters select,
.store-crm__filters input {
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  border-radius: 8px;
  padding: 0.4rem 0.55rem;
  background: transparent;
  color: inherit;
  font: inherit;
  min-width: 160px;
}
.store-crm__search {
  flex: 1;
  min-width: 200px;
}
.store-crm__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.store-crm__item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  padding: 0.95rem 1rem;
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 12px;
}
.store-crm__item--col {
  flex-wrap: wrap;
}
.store-crm__main {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
  flex: 1;
}
.store-crm__title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}
.store-crm__pill {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.store-crm__meta {
  font-size: 0.85rem;
  opacity: 0.85;
  word-break: break-all;
}
.store-crm__actions {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex-shrink: 0;
}
.store-crm__linkish {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
  font: inherit;
  padding: 0;
  opacity: 0.9;
}
.store-crm__items {
  margin: 0.35rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.85rem;
  opacity: 0.9;
}
.store-crm__error { color: #b42318; }
.store-crm__muted { opacity: 0.75; }
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  border: 0;
  cursor: pointer;
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  font: inherit;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primary { background: var(--color-primary, #1a5fff); color: #fff; }
.btn-secondary {
  background: color-mix(in srgb, currentColor 12%, transparent);
  color: inherit;
}
@media (max-width: 720px) {
  .store-crm__item {
    flex-direction: column;
  }
  .store-crm__actions {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
