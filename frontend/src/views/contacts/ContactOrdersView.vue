<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <section class="contact-orders">
    <header class="contact-orders__bar">
      <h2>{{ t('store.cabinet.title') }}</h2>
    </header>
    <p v-if="askError" class="contact-orders__error">{{ askError }}</p>
    <p v-if="actionError" class="contact-orders__error">{{ actionError }}</p>
    <p v-if="error" class="contact-orders__error">{{ error }}</p>
    <p v-else-if="loading" class="contact-orders__muted">{{ t('store.common.loading') }}</p>
    <p v-else-if="!visibleOrders.length" class="contact-orders__muted">{{ t('store.cabinet.empty') }}</p>
    <ul v-else class="contact-orders__list">
      <li v-for="o in visibleOrders" :key="o.id" class="contact-orders__card">
        <div class="contact-orders__row">
          <router-link
            class="contact-orders__cover-link"
            :to="{ name: 'store-product', params: { id: o.product_id } }"
          >
            <img
              v-if="imageCover(o)"
              :src="imageCover(o).url"
              :alt="o.product_title || o.product_id"
              class="contact-orders__cover"
            >
            <div
              v-else-if="coverOf(o)?.media_type === 'video'"
              class="contact-orders__cover contact-orders__cover--video"
            >
              {{ t('store.storefront.video') }}
            </div>
            <div v-else class="contact-orders__cover contact-orders__cover--empty" />
          </router-link>
          <div class="contact-orders__main">
            <h3 class="contact-orders__title">{{ o.product_title || o.product_id }}</h3>
            <p v-if="priceLine(o)" class="contact-orders__price">
              {{ priceLine(o) }}
              <span v-if="Number(o.qty) > 1">{{ t('store.cabinet.qty', { n: o.qty }) }}</span>
            </p>
            <p v-if="buyerBadge(o)" class="contact-orders__badge">{{ buyerBadge(o) }}</p>
            <p v-if="showEditorMeta" class="contact-orders__meta">
              {{ statusLabel(o.status) }}
              · {{ t('store.cabinet.qty', { n: o.qty }) }}
              · {{ formatStoreAmount(o.amount_unique_units || o.price_units, o.pay_token_decimals) }}
              {{ o.pay_token_symbol }}
            </p>
            <div class="contact-orders__actions">
              <router-link
                class="btn btn-secondary"
                :to="{ name: 'store-product', params: { id: o.product_id } }"
              >
                {{ t('store.storefront.openCard') }}
              </router-link>
              <button
                type="button"
                class="btn btn-secondary"
                :disabled="asking"
                @click="onAskChat([o.product_id])"
              >
                {{ t('store.cabinet.ask') }}
              </button>
              <router-link
                v-if="canPay(o)"
                class="btn btn-primary"
                :to="{ name: 'store-pay', params: { id: o.checkout_id } }"
              >
                {{ t('store.crm.openPay') }}
              </router-link>
              <button
                v-if="isAwaiting(o)"
                type="button"
                class="btn btn-secondary"
                :disabled="busyId === o.id"
                @click="onCheckPay(o)"
              >
                {{ t('store.storefront.checkPayment') }}
              </button>
              <button
                v-if="isAwaiting(o)"
                type="button"
                class="btn btn-secondary"
                :disabled="busyId === o.id"
                @click="onCancel(o)"
              >
                {{ t('store.crm.cancelOrder') }}
              </button>
            </div>
          </div>
        </div>
        <form
          v-if="canReview(o)"
          class="contact-orders__review"
          @submit.prevent="onSaveReview(o)"
        >
          <p class="contact-orders__rate-hint">{{ t('store.cabinet.rateHint') }}</p>
          <div
            class="contact-orders__stars"
            role="group"
            :aria-label="t('store.cabinet.rateHint')"
            @mouseleave="hoverStars[o.product_id] = 0"
          >
            <button
              v-for="n in 5"
              :key="n"
              type="button"
              class="contact-orders__star"
              :class="{ 'is-on': litStar(o) >= n }"
              :aria-label="t('store.cabinet.rateN', { n })"
              @mouseenter="hoverStars[o.product_id] = n"
              @click="setStar(o, n)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.4l2.47 6.64 7.03.37-5.4 4.46 1.72 6.83L12 16.9l-5.82 3.8 1.72-6.83-5.4-4.46 7.03-.37L12 2.4z" />
              </svg>
            </button>
          </div>
          <textarea
            v-model="draft[o.product_id].body"
            rows="3"
            :placeholder="t('store.cabinet.commentPlaceholder')"
          />
          <button type="submit" class="btn btn-primary" :disabled="busyId === o.product_id">
            {{ t('store.cabinet.saveReview') }}
          </button>
          <p v-if="draft[o.product_id].msg" class="contact-orders__msg">{{ draft[o.product_id].msg }}</p>
        </form>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import {
  cancelStoreOrder,
  checkStorePayment,
  fetchContactStoreOrders,
  fetchMyStoreOrders,
  saveStoreReview,
} from '@/services/storeService';
import { formatStoreAmount } from '@/utils/storePayTransfer';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { userId, address } = useAuthContext();
const { canViewCrm } = usePermissions();

const orders = ref([]);
const loading = ref(false);
const error = ref('');
const askError = ref('');
const actionError = ref('');
const asking = ref(false);
const busyId = ref('');
const draft = reactive({});
const hoverStars = reactive({});

const PAID = ['paid', 'fulfillment_proposed', 'fulfilled', 'refund_proposed', 'refunded'];
const BUYER_BADGE = ['awaiting_payment', 'expired', 'refunded'];
const HIDDEN_STATUSES = ['cancelled'];

const isOwn = computed(() => String(userId.value || '') === String(route.params.id || ''));
const showEditorMeta = computed(() => !isOwn.value && canViewCrm.value);
const visibleOrders = computed(() =>
  (orders.value || []).filter((o) => !HIDDEN_STATUSES.includes(String(o.status || '')))
);

function statusLabel(status) {
  const key = `store.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

function buyerBadge(order) {
  if (!isOwn.value) return '';
  const status = String(order.status || '');
  if (!BUYER_BADGE.includes(status)) return '';
  return t(`store.cabinet.buyerStatus.${status}`);
}

function coverOf(order) {
  return order?.cover || null;
}

function imageCover(order) {
  const cover = coverOf(order);
  return cover?.media_type === 'image' && cover?.url ? cover : null;
}

function priceLine(order) {
  const raw = formatStoreAmount(order.amount_unique_units || order.price_units, order.pay_token_decimals);
  const trimmed = String(raw).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
  const symbol = String(order.pay_token_symbol || '').trim();
  return [trimmed, symbol].filter(Boolean).join(' ');
}

function isAwaiting(order) {
  return String(order.status || '') === 'awaiting_payment';
}

function canPay(order) {
  return isAwaiting(order) && Boolean(order.checkout_id);
}

function canReview(order) {
  return PAID.includes(String(order.status || ''));
}

function starOf(order) {
  return Number(draft[order.product_id]?.stars || 0);
}

function litStar(order) {
  const hover = Number(hoverStars[order.product_id] || 0);
  return hover || starOf(order);
}

function setStar(order, n) {
  ensureDraft(order);
  draft[order.product_id].stars = n;
}

function ensureDraft(order) {
  if (draft[order.product_id]) return;
  draft[order.product_id] = {
    stars: Number(order.my_review?.stars || 0),
    body: order.my_review?.body || '',
    msg: '',
  };
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const id = String(route.params.id || '');
    const mine = String(userId.value || '') === id;
    const list = (!mine && canViewCrm.value)
      ? await fetchContactStoreOrders(id)
      : await fetchMyStoreOrders();
    orders.value = Array.isArray(list) ? list : [];
    for (const o of orders.value) ensureDraft(o);
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t('store.common.loadError');
  } finally {
    loading.value = false;
  }
}

async function onSaveReview(order) {
  ensureDraft(order);
  const item = draft[order.product_id];
  busyId.value = order.product_id;
  item.msg = '';
  try {
    await saveStoreReview(order.product_id, { stars: item.stars, body: item.body });
    item.msg = t('store.cabinet.reviewSaved');
    await load();
  } catch (e) {
    item.msg = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busyId.value = '';
  }
}

async function onAskChat(productIds) {
  const ids = [...new Set((productIds || []).filter(Boolean))];
  if (!ids.length) return;
  asking.value = true;
  askError.value = '';
  try {
    await router.push({
      name: 'contact-details',
      params: { id: route.params.id },
      query: { storeAsk: ids.join(',') },
    });
  } catch (e) {
    askError.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    asking.value = false;
  }
}

async function onCheckPay(order) {
  busyId.value = order.id;
  actionError.value = '';
  try {
    await checkStorePayment(order.id);
    await load();
  } catch (e) {
    actionError.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busyId.value = '';
  }
}

async function onCancel(order) {
  if (!window.confirm(t('store.crm.cancelConfirm'))) return;
  busyId.value = order.id;
  actionError.value = '';
  try {
    await cancelStoreOrder(order.id);
    await load();
  } catch (e) {
    actionError.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    busyId.value = '';
  }
}

onMounted(load);

void address;
</script>

<style scoped>
.contact-orders {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.contact-orders__bar {
  display: flex;
  align-items: center;
}
.contact-orders__bar h2 {
  margin: 0;
}
.contact-orders__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.contact-orders__card {
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 14px;
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.contact-orders__row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
.contact-orders__cover-link {
  flex: 0 0 5.5rem;
  width: 5.5rem;
  height: 5.5rem;
  border-radius: 12px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
}
.contact-orders__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background:
    linear-gradient(145deg,
      color-mix(in srgb, currentColor 10%, transparent),
      color-mix(in srgb, currentColor 4%, transparent));
}
.contact-orders__cover--empty,
.contact-orders__cover--video {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  opacity: 0.7;
}
.contact-orders__main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.contact-orders__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  line-height: 1.3;
}
.contact-orders__price {
  margin: 0;
  font-weight: 600;
  font-size: 0.95rem;
}
.contact-orders__price span {
  font-weight: 500;
  opacity: 0.7;
  margin-left: 0.35rem;
}
.contact-orders__badge {
  margin: 0;
  align-self: flex-start;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.contact-orders__meta {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.75;
}
.contact-orders__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.2rem;
}
.contact-orders__review {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.15rem;
  border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent);
}
.contact-orders__rate-hint {
  margin: 0;
  font-weight: 650;
  font-size: 0.95rem;
}
.contact-orders__review textarea {
  width: 100%;
  resize: vertical;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
  padding: 0.55rem 0.7rem;
  font: inherit;
  background: color-mix(in srgb, currentColor 4%, transparent);
}
.contact-orders__stars {
  display: flex;
  gap: 0.2rem;
}
.contact-orders__star {
  border: 0;
  background: transparent;
  padding: 0;
  width: 2.1rem;
  height: 2.1rem;
  cursor: pointer;
  color: #d9c48a;
  transition: transform 0.12s ease, color 0.12s ease, filter 0.12s ease;
}
.contact-orders__star svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
  filter: grayscale(0.35) saturate(0.7);
}
.contact-orders__star.is-on {
  color: #f5c518;
  transform: scale(1.08);
  filter: drop-shadow(0 1px 4px rgba(245, 197, 24, 0.55));
}
.contact-orders__star.is-on svg {
  filter: none;
}
.contact-orders__star:hover {
  transform: scale(1.14);
}
.contact-orders__error {
  color: #b42318;
  margin: 0;
}
.contact-orders__muted,
.contact-orders__msg {
  margin: 0;
}
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
@media (max-width: 520px) {
  .contact-orders__cover-link {
    flex-basis: 4.5rem;
    width: 4.5rem;
    height: 4.5rem;
  }
}
</style>
