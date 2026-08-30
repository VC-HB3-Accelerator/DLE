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
    <div class="store-product-edit page-with-close">
      <PageCloseButton :fallback="{ name: 'content-store' }" />

      <div v-if="!isEditor" class="store-product-edit__forbidden">
        <h1>{{ pageTitle }}</h1>
        <p>{{ t('store.editor.forbidden') }}</p>
      </div>

      <div v-else class="store-product-edit__wrap">
        <header class="store-product-edit__header">
          <h1>{{ pageTitle }}</h1>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="savingProduct || loading"
            @click="onSubmitProduct"
          >
            {{ savingProduct ? t('store.common.saving') : t('store.editor.saveAndClose') }}
          </button>
        </header>

        <p v-if="loadError" class="store-product-edit__error">{{ loadError }}</p>
        <p v-else-if="loading" class="store-product-edit__muted">{{ t('store.common.loading') }}</p>

        <form v-else class="store-product-edit__form" @submit.prevent="onSubmitProduct">
          <label>
            <span>{{ t('store.editor.fieldTitle') }}</span>
            <input v-model="form.title" required maxlength="200">
          </label>
          <label>
            <span>{{ t('store.editor.fieldSummary') }}</span>
            <input v-model="form.summary" maxlength="500" :placeholder="t('store.editor.fieldSummaryHint')">
          </label>
          <label>
            <span>{{ t('store.editor.fieldDescription') }}</span>
            <textarea v-model="form.description" rows="4" />
          </label>
          <label>
            <span>{{ t('store.editor.fieldFeatures') }}</span>
            <textarea v-model="form.features" rows="4" :placeholder="t('store.editor.fieldFeaturesHint')" />
          </label>
          <label>
            <span>{{ t('store.editor.fieldBenefit') }}</span>
            <textarea v-model="form.benefit_note" rows="2" :placeholder="t('store.editor.fieldBenefitHint')" />
          </label>

          <div class="store-product-edit__attrs">
            <div class="store-product-edit__attrs-head">
              <span>{{ t('store.editor.fieldAttributes') }}</span>
              <button type="button" class="btn btn-secondary" @click="addAttribute">
                {{ t('store.editor.addAttribute') }}
              </button>
            </div>
            <div v-for="(attr, idx) in form.attributes" :key="idx" class="store-product-edit__attr-row">
              <input v-model="attr.label" :placeholder="t('store.editor.attrLabel')">
              <input v-model="attr.value" :placeholder="t('store.editor.attrValue')">
              <button type="button" class="btn btn-secondary" @click="removeAttribute(idx)">
                {{ t('store.editor.mediaRemove') }}
              </button>
            </div>
          </div>

          <div class="store-product-edit__row">
            <label>
              <span>{{ t('store.editor.fieldKind') }}</span>
              <select v-model="form.kind">
                <option value="product">{{ t('store.editor.kindProduct') }}</option>
                <option value="service">{{ t('store.editor.kindService') }}</option>
              </select>
            </label>
            <label class="store-product-edit__check">
              <input v-model="form.published" type="checkbox">
              <span>{{ t('store.editor.published') }}</span>
            </label>
          </div>

          <section class="store-product-edit__block">
            <h2>{{ t('store.editor.payToken') }}</h2>
            <p class="store-product-edit__hint">{{ t('store.editor.tokenFromTreasury') }}</p>
            <p v-if="bookSettings?.treasury_address" class="store-product-edit__hint">
              {{ t('store.editor.tokenFromSettings', {
                chain: bookSettings.primary_chain_id,
                treasury: shortAddr(bookSettings.treasury_address),
              }) }}
              <router-link :to="{ name: 'content-store-settings' }">{{ t('store.editor.openSettings') }}</router-link>
            </p>
            <p v-if="!settingsReady" class="store-product-edit__hint">
              {{ t('store.editor.tokenNeedSettings') }}
              <router-link :to="{ name: 'content-store-settings' }">{{ t('store.editor.openSettings') }}</router-link>
            </p>
            <button type="button" class="btn btn-secondary" :disabled="loadingTokens || !settingsReady" @click="reloadTreasuryTokens">
              {{ loadingTokens ? t('store.common.loading') : t('store.editor.tokenReload') }}
            </button>
            <p v-if="tokensError" class="store-product-edit__error">{{ tokensError }}</p>
            <p v-else-if="settingsReady && !loadingTokens && !payTokenOptions.length" class="store-product-edit__hint">
              {{ t('store.editor.tokenEmpty') }}
            </p>
            <ul v-else-if="payTokenOptions.length" class="store-product-edit__token-picks">
              <li v-for="tok in payTokenOptions" :key="`chip-${tok.address}`">
                <button
                  type="button"
                  class="store-product-edit__token-chip"
                  :class="{ 'is-selected': isSameAddr(form.pay_token_address, tok.address) }"
                  @click="selectPayToken(tok)"
                >
                  <strong>{{ tok.symbol || 'TOKEN' }}</strong>
                  <span>{{ shortAddr(tok.address) }}</span>
                  <span>{{ t('store.editor.balanceShort') }} {{ tok.balance_human ?? '—' }}</span>
                </button>
              </li>
            </ul>

            <label>
              <span>{{ t('store.editor.payToken') }}</span>
              <select v-model="form.pay_token_address" required @change="onPayTokenPick">
                <option disabled value="">{{ t('store.editor.pickToken') }}</option>
                <option v-for="tok in payTokenOptions" :key="`pay-${tok.address}`" :value="tok.address">
                  {{ tok.symbol || 'TOKEN' }} · {{ shortAddr(tok.address) }}
                  · {{ t('store.editor.balanceShort') }} {{ tok.balance_human ?? '—' }}
                </option>
              </select>
            </label>
            <div class="store-product-edit__paste-row">
              <label>
                <span>{{ t('store.editor.tokenPaste') }}</span>
                <input v-model="payPaste" type="text" placeholder="0x…">
              </label>
              <button type="button" class="btn btn-secondary" :disabled="resolvingPay" @click="resolvePayPaste">
                {{ resolvingPay ? t('store.editor.tokenChecking') : t('store.editor.tokenCheck') }}
              </button>
            </div>
            <p
              v-if="payTokenHint"
              class="store-product-edit__hint"
              :class="{ 'store-product-edit__error': payTokenWarn }"
            >{{ payTokenHint }}</p>
            <div class="store-product-edit__row">
              <label>
                <span>{{ t('store.editor.paySymbol') }}</span>
                <input v-model="form.pay_token_symbol" readonly>
              </label>
              <label>
                <span>{{ t('store.editor.payDecimals') }}</span>
                <input v-model.number="form.pay_token_decimals" type="number" min="0" max="18" required readonly>
              </label>
            </div>
            <label>
              <span>{{ t('store.editor.priceHuman') }}</span>
              <input v-model="form.price_human" required>
            </label>
          </section>

          <section class="store-product-edit__block">
            <label class="store-product-edit__check">
              <input v-model="form.receipt_enabled" type="checkbox">
              <span>{{ t('store.editor.receiptEnabled') }}</span>
            </label>
            <template v-if="form.receipt_enabled">
              <label>
                <span>{{ t('store.editor.receiptStandard') }}</span>
                <select v-model="form.receipt_standard">
                  <option value="erc20">{{ t('store.editor.receiptStandardErc20') }}</option>
                  <option value="erc721">{{ t('store.editor.receiptStandardErc721') }}</option>
                  <option value="erc1155">{{ t('store.editor.receiptStandardErc1155') }}</option>
                </select>
              </label>
              <label v-if="form.receipt_standard === 'erc1155'">
                <span>{{ t('store.editor.receiptErc1155Id') }}</span>
                <input v-model="form.receipt_erc1155_token_id" required>
              </label>
              <label>
                <span>{{ t('store.editor.receiptToken') }}</span>
                <select
                  v-if="form.receipt_standard === 'erc20'"
                  v-model="form.license_token_address"
                  required
                  @change="onLicenseTokenPick"
                >
                  <option disabled value="">{{ t('store.editor.pickToken') }}</option>
                  <option v-for="tok in payTokenOptions" :key="`lic-${tok.address}`" :value="tok.address">
                    {{ tok.symbol || 'TOKEN' }} · {{ shortAddr(tok.address) }}
                    · {{ t('store.editor.balanceShort') }} {{ tok.balance_human ?? '—' }}
                  </option>
                </select>
                <input
                  v-else
                  v-model="form.license_token_address"
                  required
                  :placeholder="t('store.editor.tokenPaste')"
                >
              </label>
              <div class="store-product-edit__paste-row">
                <label>
                  <span>{{ t('store.editor.tokenPaste') }}</span>
                  <input v-model="licensePaste" type="text" placeholder="0x…">
                </label>
                <button type="button" class="btn btn-secondary" :disabled="resolvingLicense" @click="resolveLicensePaste">
                  {{ resolvingLicense ? t('store.editor.tokenChecking') : t('store.editor.tokenCheck') }}
                </button>
              </div>
              <p
                v-if="licenseTokenHint"
                class="store-product-edit__hint"
                :class="{ 'store-product-edit__error': licenseTokenWarn }"
              >{{ licenseTokenHint }}</p>
              <div v-if="form.receipt_standard === 'erc20'" class="store-product-edit__row">
                <label>
                  <span>{{ t('store.editor.licenseSymbol') }}</span>
                  <input v-model="form.license_token_symbol" readonly>
                </label>
                <label>
                  <span>{{ t('store.editor.licenseDecimals') }}</span>
                  <input v-model.number="form.license_token_decimals" type="number" min="0" max="18" readonly>
                </label>
              </div>
              <p class="store-product-edit__hint">{{ t('store.editor.receiptOnePerUnit') }}</p>
            </template>
          </section>

          <div class="store-product-edit__row">
            <label>
              <span>{{ t('store.editor.maxQty') }}</span>
              <input v-model.number="form.max_qty" type="number" min="1" max="99" required>
            </label>
            <label>
              <span>{{ t('store.editor.maxPayments') }}</span>
              <input v-model.number="form.max_payments_per_wallet" type="number" min="1" required>
            </label>
          </div>

          <label>
            <span>{{ t('store.editor.sections') }}</span>
            <select v-model="form.section_ids" multiple class="store-product-edit__multi">
              <option v-for="s in sections" :key="s.id" :value="s.id">{{ s.title }} ({{ s.slug }})</option>
            </select>
          </label>
          <p v-if="!sections.length" class="store-product-edit__hint">
            {{ t('store.editor.sectionsEmpty') }}
            <router-link :to="{ name: 'content-store-section-new' }">{{ t('store.editor.sectionCreate') }}</router-link>
          </p>

          <div class="store-product-edit__media">
            <span>{{ t('store.editor.media') }}</span>
            <div class="store-product-edit__media-actions">
              <button type="button" class="btn btn-primary" @click="openMediaPicker">
                {{ t('store.editor.mediaAdd') }}
              </button>
            </div>
            <p v-if="!selectedMedia.length" class="store-product-edit__hint">{{ t('store.editor.mediaEmpty') }}</p>
            <ul v-else class="store-product-edit__media-list">
              <li v-for="m in selectedMedia" :key="m.id" class="store-product-edit__media-item">
                <img v-if="m.media_type === 'image' && m.url" :src="m.url" alt="">
                <span v-else class="store-product-edit__media-file">{{ m.file_name || m.id }}</span>
                <button type="button" class="btn btn-secondary" @click="removeMedia(m.id)">
                  {{ t('store.editor.mediaRemove') }}
                </button>
              </li>
            </ul>
          </div>

          <p v-if="formError" class="store-product-edit__error">{{ formError }}</p>
          <div class="store-product-edit__actions">
            <router-link class="btn btn-secondary" :to="{ name: 'content-store' }">
              {{ t('store.common.cancel') }}
            </router-link>
            <button type="submit" class="btn btn-primary" :disabled="savingProduct">
              {{ savingProduct ? t('store.common.saving') : t('store.editor.saveAndClose') }}
            </button>
          </div>
        </form>

        <ContentMediaPickerModal
          :open="mediaPickerOpen"
          kind="any"
          @cancel="mediaPickerOpen = false"
          @device="onMediaDevice"
          @select="onMediaSelect"
        />
        <input
          ref="mediaFileInput"
          type="file"
          class="store-product-edit__file"
          accept="image/*,video/*"
          @change="onMediaFilePicked"
        >
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ethers } from 'ethers';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import ContentMediaPickerModal from '../../components/content/ContentMediaPickerModal.vue';
import { usePermissions } from '../../composables/usePermissions';
import { uploadContentMedia } from '../../composables/useChunkedMediaUpload';
import { isNativePayToken } from '../../utils/storePayTransfer';
import {
  createStoreProduct,
  fetchStoreProduct,
  fetchStoreSections,
  fetchStoreSettings,
  fetchTreasuryTokens,
  resolveStoreToken,
  updateStoreProduct,
} from '../../services/storeService';

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
const { isEditor } = usePermissions();

const loading = ref(false);
const loadError = ref('');
const sections = ref([]);
const treasuryTokens = ref([]);
const loadingTokens = ref(false);
const tokensError = ref('');
const savingProduct = ref(false);
const formError = ref('');
const payPaste = ref('');
const licensePaste = ref('');
const resolvingPay = ref(false);
const resolvingLicense = ref(false);
const payTokenHint = ref('');
const licenseTokenHint = ref('');
const payTokenWarn = ref(false);
const licenseTokenWarn = ref(false);
const selectedMedia = ref([]);
const mediaPickerOpen = ref(false);
const mediaFileInput = ref(null);
const settingsReady = ref(false);
const bookSettings = ref(null);
const editingId = ref(null);

const form = reactive({
  title: '',
  summary: '',
  description: '',
  features: '',
  benefit_note: '',
  attributes: [],
  kind: 'product',
  published: false,
  pay_token_address: '',
  pay_token_symbol: '',
  pay_token_decimals: null,
  price_human: '',
  license_token_address: '',
  license_token_symbol: '',
  license_token_decimals: 18,
  license_amount_human: '1',
  receipt_enabled: false,
  receipt_standard: 'erc20',
  receipt_erc1155_token_id: '',
  max_qty: 1,
  max_payments_per_wallet: 1,
  section_ids: [],
});

const pageTitle = computed(() => (
  editingId.value ? t('store.editor.editTitle') : t('store.editor.createTitle')
));

const payTokenOptions = computed(() => (
  (treasuryTokens.value || []).filter((tok) => !isNativePayToken(tok.address))
));

function formatUnits(units, decimals) {
  try {
    return ethers.formatUnits(String(units || '0'), Number(decimals || 0));
  } catch {
    return String(units || '0');
  }
}

function checksumOrEmpty(addr) {
  try {
    if (!addr || isNativePayToken(addr)) return '';
    return ethers.getAddress(addr);
  } catch {
    return String(addr || '');
  }
}

function shortAddr(addr) {
  const s = String(addr || '');
  if (s.length < 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function isSameAddr(a, b) {
  try {
    if (!a || !b) return false;
    return ethers.getAddress(a) === ethers.getAddress(b);
  } catch {
    return String(a || '').toLowerCase() === String(b || '').toLowerCase();
  }
}

function selectPayToken(tok) {
  if (!tok?.address || isNativePayToken(tok.address)) return;
  form.pay_token_address = checksumOrEmpty(tok.address);
  onPayTokenPick();
}

function applyTokenMeta(kind, address) {
  const tok = treasuryTokens.value.find((t) => String(t.address).toLowerCase() === String(address).toLowerCase());
  if (!tok) return;
  if (kind === 'pay') {
    form.pay_token_symbol = tok.symbol || form.pay_token_symbol;
    form.pay_token_decimals = Number(tok.decimals);
    payTokenHint.value = t('store.editor.tokenInTreasury', {
      balance: tok.balance_human ?? '—',
      symbol: tok.symbol || '',
    });
    payTokenWarn.value = false;
  } else {
    form.license_token_symbol = tok.symbol || form.license_token_symbol;
    form.license_token_decimals = Number(tok.decimals);
    licenseTokenHint.value = t('store.editor.tokenInTreasury', {
      balance: tok.balance_human ?? '—',
      symbol: tok.symbol || '',
    });
    licenseTokenWarn.value = false;
  }
}

function onPayTokenPick() {
  applyTokenMeta('pay', form.pay_token_address);
}

function onLicenseTokenPick() {
  applyTokenMeta('license', form.license_token_address);
}

function upsertTreasuryToken(token) {
  if (!token?.address) return;
  const idx = treasuryTokens.value.findIndex(
    (t) => String(t.address).toLowerCase() === String(token.address).toLowerCase()
  );
  const row = {
    address: token.address,
    symbol: token.symbol || '',
    decimals: Number(token.decimals),
    balance_human: token.balance_human,
    in_treasury: Boolean(token.in_treasury),
    is_active: true,
  };
  if (idx >= 0) treasuryTokens.value.splice(idx, 1, row);
  else treasuryTokens.value = [row, ...treasuryTokens.value];
}

async function resolvePayPaste() {
  resolvingPay.value = true;
  payTokenHint.value = '';
  payTokenWarn.value = false;
  try {
    const token = await resolveStoreToken(payPaste.value.trim());
    if (isNativePayToken(token.address)) {
      payTokenHint.value = t('store.editor.payTokenMustBeErc20');
      payTokenWarn.value = true;
      return;
    }
    upsertTreasuryToken(token);
    form.pay_token_address = checksumOrEmpty(token.address);
    form.pay_token_symbol = token.symbol || '';
    form.pay_token_decimals = Number(token.decimals);
    if (token.in_treasury) {
      payTokenHint.value = t('store.editor.tokenInTreasury', {
        balance: token.balance_human ?? '—',
        symbol: token.symbol || '',
      });
    } else {
      payTokenHint.value = t('store.editor.tokenNotInTreasury');
      payTokenWarn.value = true;
    }
  } catch (e) {
    payTokenHint.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
    payTokenWarn.value = true;
  } finally {
    resolvingPay.value = false;
  }
}

async function resolveLicensePaste() {
  resolvingLicense.value = true;
  licenseTokenHint.value = '';
  licenseTokenWarn.value = false;
  try {
    const token = await resolveStoreToken(licensePaste.value.trim() || form.license_token_address, {
      standard: form.receipt_standard,
      receipt_erc1155_token_id: form.receipt_erc1155_token_id || undefined,
    });
    if (form.receipt_standard === 'erc20') upsertTreasuryToken(token);
    form.license_token_address = token.address;
    form.license_token_symbol = token.symbol || '';
    form.license_token_decimals = Number(token.decimals || 0);
    const bal = token.balance_human ?? token.treasury_balance_units ?? '—';
    const supply = token.total_supply_human ?? token.total_supply_units ?? '—';
    if (token.in_treasury || BigInt(token.treasury_balance_units || '0') > 0n) {
      licenseTokenHint.value = `${t('store.editor.tokenInTreasury', {
        balance: bal,
        symbol: token.symbol || '',
      })} · ${t('store.editor.totalSupply', { supply })}`;
      licenseTokenWarn.value = false;
    } else {
      licenseTokenHint.value = t('store.editor.tokenNotInTreasury');
      licenseTokenWarn.value = true;
    }
  } catch (e) {
    licenseTokenHint.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
    licenseTokenWarn.value = true;
  } finally {
    resolvingLicense.value = false;
  }
}

function resetForm() {
  form.title = '';
  form.summary = '';
  form.description = '';
  form.features = '';
  form.benefit_note = '';
  form.attributes = [];
  form.kind = 'product';
  form.published = false;
  form.pay_token_address = '';
  form.pay_token_symbol = '';
  form.pay_token_decimals = null;
  form.price_human = '';
  form.license_token_address = '';
  form.license_token_symbol = '';
  form.license_token_decimals = 18;
  form.license_amount_human = '1';
  form.receipt_enabled = false;
  form.receipt_standard = 'erc20';
  form.receipt_erc1155_token_id = '';
  form.max_qty = 1;
  form.max_payments_per_wallet = 1;
  form.section_ids = [];
  selectedMedia.value = [];
  payPaste.value = '';
  licensePaste.value = '';
  payTokenHint.value = '';
  licenseTokenHint.value = '';
  payTokenWarn.value = false;
  licenseTokenWarn.value = false;
  formError.value = '';
}

function fillForm(p) {
  form.title = p.title || '';
  form.summary = p.summary || '';
  form.description = p.description || '';
  form.features = p.features || '';
  form.benefit_note = p.benefit_note || '';
  form.attributes = Array.isArray(p.attributes)
    ? p.attributes.map((a) => ({ label: a.label || '', value: a.value || '' }))
    : [];
  form.kind = p.kind || 'product';
  form.published = Boolean(p.published);
  form.pay_token_address = checksumOrEmpty(p.pay_token_address);
  form.pay_token_symbol = form.pay_token_address ? (p.pay_token_symbol || '') : '';
  form.pay_token_decimals = form.pay_token_address ? Number(p.pay_token_decimals || 0) : null;
  form.price_human = formatUnits(p.price_units, p.pay_token_decimals);
  form.license_token_address = p.license_token_address || '';
  form.license_token_symbol = p.license_token_symbol || '';
  form.license_token_decimals = Number(p.license_token_decimals || 0);
  form.license_amount_human = p.license_amount_units
    ? formatUnits(p.license_amount_units, p.license_token_decimals)
    : '1';
  form.receipt_enabled = Boolean(p.receipt_enabled ?? p.license_token_address);
  form.receipt_standard = p.receipt_standard || 'erc20';
  form.receipt_erc1155_token_id = p.receipt_erc1155_token_id || '';
  form.max_qty = Number(p.max_qty || 1);
  form.max_payments_per_wallet = Number(p.max_payments_per_wallet || 1);
  form.section_ids = Array.isArray(p.section_ids) ? [...p.section_ids] : [];
  selectedMedia.value = Array.isArray(p.media)
    ? p.media.map((m) => ({
      id: m.id || m.content_media_id,
      url: m.url || '',
      file_name: m.file_name || String(m.id || m.content_media_id),
      media_type: m.media_type || 'file',
    }))
    : (Array.isArray(p.media_ids)
      ? p.media_ids.map((id) => ({ id, file_name: String(id), media_type: 'file' }))
      : []);
  if (isNativePayToken(p.pay_token_address)) {
    payTokenHint.value = t('store.editor.payTokenMustBeErc20');
    payTokenWarn.value = true;
  } else {
    applyTokenMeta('pay', form.pay_token_address);
  }
  applyTokenMeta('license', form.license_token_address);
}

function addAttribute() {
  form.attributes.push({ label: '', value: '' });
}

function removeAttribute(idx) {
  form.attributes.splice(idx, 1);
}

function openMediaPicker() {
  mediaPickerOpen.value = true;
}

function onMediaDevice() {
  mediaPickerOpen.value = false;
  nextTick(() => mediaFileInput.value?.click());
}

function onMediaSelect(item) {
  mediaPickerOpen.value = false;
  if (!item?.id) return;
  if (selectedMedia.value.some((m) => Number(m.id) === Number(item.id))) return;
  selectedMedia.value.push({
    id: item.id,
    url: item.url || '',
    file_name: item.file_name || String(item.id),
    media_type: item.media_type || 'file',
  });
}

function removeMedia(id) {
  selectedMedia.value = selectedMedia.value.filter((m) => Number(m.id) !== Number(id));
}

async function onMediaFilePicked(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    const data = await uploadContentMedia(file);
    if (!data?.id) throw new Error(t('store.common.saveError'));
    onMediaSelect({
      id: data.id,
      url: data.url,
      file_name: data.file_name || file.name,
      media_type: data.type || data.media_type || (file.type.startsWith('video/') ? 'video' : 'image'),
    });
  } catch (e) {
    formError.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  }
}

function buildPayload() {
  const payload = {
    title: form.title.trim(),
    summary: form.summary,
    description: form.description,
    features: form.features,
    benefit_note: form.benefit_note,
    attributes: form.attributes,
    kind: form.kind,
    published: form.published,
    pay_token_address: form.pay_token_address.trim(),
    pay_token_symbol: form.pay_token_symbol.trim(),
    pay_token_decimals: Number(form.pay_token_decimals),
    price_units: ethers.parseUnits(String(form.price_human || '0'), Number(form.pay_token_decimals)).toString(),
    receipt_enabled: Boolean(form.receipt_enabled),
    max_qty: Number(form.max_qty || 1),
    max_payments_per_wallet: Number(form.max_payments_per_wallet),
    section_ids: Array.isArray(form.section_ids) ? form.section_ids : [],
    media_ids: selectedMedia.value.map((m) => Number(m.id)).filter((n) => Number.isFinite(n) && n > 0),
  };
  if (payload.receipt_enabled) {
    payload.receipt_standard = form.receipt_standard || 'erc20';
    payload.license_token_address = form.license_token_address.trim();
    payload.license_token_symbol = form.license_token_symbol.trim();
    payload.license_token_decimals = Number(form.license_token_decimals || 0);
    if (payload.receipt_standard === 'erc20') {
      payload.license_amount_units = ethers.parseUnits('1', Number(form.license_token_decimals || 0)).toString();
    } else {
      payload.license_amount_units = '1';
      if (payload.receipt_standard === 'erc1155') {
        payload.receipt_erc1155_token_id = String(form.receipt_erc1155_token_id || '');
      }
    }
  } else {
    payload.receipt_standard = null;
    payload.license_token_address = null;
    payload.license_token_decimals = 0;
    payload.license_token_symbol = '';
    payload.license_amount_units = null;
  }
  return payload;
}

async function reloadTreasuryTokens() {
  loadingTokens.value = true;
  tokensError.value = '';
  try {
    const list = await fetchTreasuryTokens();
    treasuryTokens.value = Array.isArray(list) ? list.filter((tok) => !isNativePayToken(tok.address)) : [];
  } catch (e) {
    treasuryTokens.value = [];
    tokensError.value = e?.response?.data?.error || e?.message || t('store.editor.tokenLoadError');
  } finally {
    loadingTokens.value = false;
  }
}

async function loadPage() {
  loading.value = true;
  loadError.value = '';
  resetForm();
  editingId.value = route.name === 'content-store-product-edit' ? route.params.id : null;
  try {
    const [settings, secs] = await Promise.all([
      fetchStoreSettings(),
      fetchStoreSections().catch(() => []),
    ]);
    bookSettings.value = settings || null;
    settingsReady.value = Boolean(settings?.treasury_address && settings?.primary_chain_id);
    sections.value = Array.isArray(secs) ? secs : [];
    await reloadTreasuryTokens();
    if (editingId.value) {
      const p = await fetchStoreProduct(editingId.value);
      fillForm(p);
    }
  } catch (e) {
    loadError.value = e?.response?.data?.error || e?.message || t('store.common.loadError');
  } finally {
    loading.value = false;
  }
}

async function onSubmitProduct() {
  savingProduct.value = true;
  formError.value = '';
  try {
    const payload = buildPayload();
    if (isNativePayToken(payload.pay_token_address)) {
      formError.value = t('store.editor.payTokenMustBeErc20');
      return;
    }
    if (payload.published && payload.receipt_enabled && payload.license_token_address) {
      try {
        const token = await resolveStoreToken(payload.license_token_address, {
          standard: payload.receipt_standard || 'erc20',
          receipt_erc1155_token_id: payload.receipt_erc1155_token_id,
        });
        const bal = BigInt(String(token?.treasury_balance_units || '0'));
        const need = BigInt(Math.max(1, Number(payload.max_qty || 1)));
        if (bal < need) {
          const ok = window.confirm(t('store.editor.publishBalanceWarn', {
            balance: token?.balance_human ?? String(bal),
            symbol: token?.symbol || '',
            need: String(need),
          }));
          if (!ok) return;
        }
      } catch (_) {
        /* сеть недоступна — не блокируем сохранение */
      }
    }
    if (editingId.value) await updateStoreProduct(editingId.value, payload);
    else await createStoreProduct(payload);
    await router.push({ name: 'content-store' });
  } catch (e) {
    formError.value = e?.response?.data?.error || e?.message || t('store.common.saveError');
  } finally {
    savingProduct.value = false;
  }
}

onMounted(() => {
  if (isEditor.value) loadPage();
});

watch(isEditor, (ok) => {
  if (ok) loadPage();
});

watch(() => route.fullPath, () => {
  if (isEditor.value) loadPage();
});
</script>

<style scoped>
.store-product-edit {
  max-width: 760px;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 2.5rem;
}
.store-product-edit__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.store-product-edit__header h1 {
  margin: 0;
  font-size: 1.35rem;
}
.store-product-edit__form,
.store-product-edit__block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.store-product-edit__block {
  padding: 0.85rem 0 1rem;
  border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent);
}
.store-product-edit__token-picks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.store-product-edit__token-chip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  width: 100%;
  text-align: left;
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.store-product-edit__token-chip.is-selected {
  border-color: var(--color-primary, #1a5fff);
  background: color-mix(in srgb, var(--color-primary, #1a5fff) 12%, transparent);
}
.store-product-edit__block h2 {
  margin: 0;
  font-size: 1.05rem;
}
.store-product-edit__row {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}
.store-product-edit label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
}
.store-product-edit input,
.store-product-edit textarea,
.store-product-edit select {
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
  background: transparent;
  color: inherit;
  font: inherit;
}
.store-product-edit__multi {
  min-height: 6rem;
}
.store-product-edit__paste-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  align-items: end;
}
.store-product-edit__check {
  flex-direction: row !important;
  align-items: center;
  gap: 0.5rem;
}
.store-product-edit__hint,
.store-product-edit__muted {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.75;
}
.store-product-edit__attrs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.store-product-edit__attrs-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
.store-product-edit__attr-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.4rem;
}
.store-product-edit__media {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.store-product-edit__media-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.store-product-edit__media-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.store-product-edit__media-item img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 8px;
}
.store-product-edit__media-file { flex: 1; font-size: 0.9rem; }
.store-product-edit__file { display: none; }
.store-product-edit__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.store-product-edit__error { color: #b42318; }
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
