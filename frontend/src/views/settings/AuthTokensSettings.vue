<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <div class="auth-tokens-settings">
    <div v-if="userAccessLevel && userAccessLevel.hasAccess" class="access-level-info">
      <div class="access-level-badge" :class="getLevelClass(userAccessLevel.level)">
        <UiGlyph name="shield" />
        <span class="access-level-text">{{ getLevelDescription(userAccessLevel.level) }}</span>
        <span class="token-count">{{ $t('settings.authTokens.tokenCount', userAccessLevel.tokenCount) }}</span>
      </div>
      <div class="access-level-description">
        {{ getAccessLevelDescription(userAccessLevel.level) }}
      </div>
    </div>

    <div v-if="authTokens.length > 0" class="tokens-list">
      <div class="tokens-list-head" aria-hidden="true">
        <span>{{ $t('settings.authTokens.name') }}</span>
        <span>{{ $t('settings.authTokens.address') }}</span>
        <span>{{ $t('settings.authTokens.network') }}</span>
        <span>{{ $t('settings.authTokens.minBalance') }}</span>
        <span>{{ $t('settings.authTokens.readOnly') }}</span>
        <span>{{ $t('settings.authTokens.editor') }}</span>
        <span></span>
      </div>
      <div
        v-for="(token, index) in authTokens"
        :key="token.address + token.network"
        class="token-entry"
      >
        <span class="token-cell" :title="token.name">{{ token.name }}</span>
        <span class="token-cell token-cell--mono" :title="token.address">{{ shortAddress(token.address) }}</span>
        <span class="token-cell" :title="getNetworkLabel(token.network)">{{ getNetworkLabel(token.network) }}</span>
        <span class="token-cell token-cell--num" :title="String(token.minBalance)">{{ formatMinBalance(token.minBalance) }}</span>
        <span class="token-cell token-cell--num">{{ token.readonlyThreshold ?? 1 }}</span>
        <span class="token-cell token-cell--num">{{ token.editorThreshold ?? 1 }}</span>
        <div class="token-actions">
          <button
            type="button"
            class="btn btn-sm"
            :class="canManageSettings ? 'btn-danger' : 'btn-outline'"
            @click="canManageSettings ? removeToken(index) : null"
            :disabled="!canManageSettings"
          >
            {{ $t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
    <p v-else class="empty-hint">{{ $t('settings.authTokens.empty') }}</p>

    <div class="add-token-form">
      <h5>{{ $t('settings.authTokens.addTitle') }}</h5>
      <div class="form-group">
        <label class="form-label">{{ $t('settings.authTokens.name') }}</label>
        <input
          type="text"
          v-model="newToken.name"
          class="form-control"
          placeholder="test2"
          :disabled="!canManageSettings"
        >
      </div>
      <div class="form-group">
        <label class="form-label">{{ $t('settings.authTokens.address') }}</label>
        <input
          type="text"
          v-model="newToken.address"
          class="form-control"
          placeholder="0x..."
          :disabled="!canManageSettings"
        >
      </div>
      <div class="form-group">
        <label class="form-label">{{ $t('settings.authTokens.network') }}</label>
        <select v-model="newToken.network" class="form-control" :disabled="!canManageSettings">
          <option value="">{{ $t('settings.authTokens.selectNetwork') }}</option>
          <option v-for="option in configuredNetworkOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">{{ $t('settings.authTokens.minBalance') }}</label>
        <input
          type="number"
          v-model.number="newToken.minBalance"
          class="form-control"
          placeholder="0"
          min="0"
          step="0.01"
          :disabled="!canManageSettings"
        >
        <small class="form-text">{{ $t('settings.authTokens.minBalanceHelp') }}</small>
      </div>

      <div class="access-settings">
        <h6>{{ $t('settings.authTokens.accessSettings') }}</h6>
        <div class="thresholds-row">
          <div class="form-group">
            <label class="form-label">{{ $t('settings.authTokens.readonlyThreshold') }}</label>
            <input
              type="number"
              v-model="newToken.readonlyThreshold"
              class="form-control"
              placeholder="1"
              min="1"
              :disabled="!canManageSettings"
            >
            <small class="form-text">{{ $t('settings.authTokens.readonlyThresholdHelp') }}</small>
          </div>
          <div class="form-group">
            <label class="form-label">{{ $t('settings.authTokens.editorThreshold') }}</label>
            <input
              type="number"
              v-model="newToken.editorThreshold"
              class="form-control"
              placeholder="1"
              min="1"
              :disabled="!canManageSettings"
            >
            <small class="form-text">{{ $t('settings.authTokens.editorThresholdHelp') }}</small>
          </div>
        </div>
      </div>
      <button
        type="button"
        class="btn"
        :class="canManageSettings ? 'btn-primary' : 'btn-outline'"
        @click="canManageSettings ? addToken() : null"
        :disabled="!canManageSettings"
      >
        {{ $t('settings.authTokens.addButton') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { reactive, onMounted, onUnmounted, computed } from 'vue';
import useBlockchainNetworks from '@/composables/useBlockchainNetworks';
import api from '@/api/axios';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import eventBus from '@/utils/eventBus';
import UiGlyph from '@/components/UiGlyph.vue';

const { t } = useI18n();
const props = defineProps({
  authTokens: { type: Array, required: true }
});
const emit = defineEmits(['update']);
const newToken = reactive({
  name: '',
  address: '',
  network: '',
  minBalance: 1,
  readonlyThreshold: 1,
  editorThreshold: 1
});

const { networkGroups, networks, fetchNetworks } = useBlockchainNetworks();
const { checkTokenBalances, address, checkAuth, userAccessLevel, checkUserAccessLevel } = useAuthContext();
const { canManageSettings, getLevelClass, getLevelDescription } = usePermissions();

const configuredNetworkOptions = computed(() =>
  (networks.value || []).map((n) => ({
    value: n.value,
    label: n.label || n.value,
  }))
);

function handleClear() {
  newToken.name = '';
  newToken.address = '';
  newToken.network = '';
  newToken.minBalance = 1;
  newToken.readonlyThreshold = 1;
  newToken.editorThreshold = 1;
}

function handleRefresh() {
  emit('update');
}

onMounted(() => {
  fetchNetworks();
  window.addEventListener('clear-application-data', handleClear);
  window.addEventListener('refresh-application-data', handleRefresh);
});

onUnmounted(() => {
  window.removeEventListener('clear-application-data', handleClear);
  window.removeEventListener('refresh-application-data', handleRefresh);
});

async function addToken() {
  if (!newToken.name || !newToken.address || !newToken.network) {
    alert(t('settings.authTokens.allFieldsRequired'));
    return;
  }

  if (Number(newToken.readonlyThreshold) > Number(newToken.editorThreshold)) {
    alert(t('settings.authTokens.thresholdInvalid'));
    return;
  }

  const tokenData = {
    name: newToken.name,
    address: newToken.address,
    network: newToken.network,
    minBalance: Number(newToken.minBalance) || 0,
    readonlyThreshold: newToken.readonlyThreshold !== null && newToken.readonlyThreshold !== undefined && newToken.readonlyThreshold !== '' ? Number(newToken.readonlyThreshold) : 1,
    editorThreshold: newToken.editorThreshold !== null && newToken.editorThreshold !== undefined && newToken.editorThreshold !== '' ? Number(newToken.editorThreshold) : 1
  };

  try {
    await api.post('/settings/auth-token', tokenData);

    try {
      if (address.value) {
        await checkTokenBalances(address.value);
        await checkUserAccessLevel(address.value);
      }
      await checkAuth();
      eventBus.emit('auth-settings-saved');
    } catch (balanceError) {
      console.error('[AuthTokensSettings] Ошибка при перепроверке баланса:', balanceError);
    }

    setTimeout(() => {
      emit('update');
    }, 100);

    handleClear();
  } catch (e) {
    alert(t('settings.authTokens.addError', { error: e.response?.data?.error || e.message }));
  }
}

async function removeToken(index) {
  const token = props.authTokens[index];
  if (!token) return;
  if (!confirm(t('settings.authTokens.confirmDelete', { name: token.name, address: token.address }))) return;

  try {
    await api.delete(`/settings/auth-token/${token.address}/${token.network}`);

    try {
      if (address.value) {
        await checkTokenBalances(address.value);
        await checkUserAccessLevel(address.value);
      }
      await checkAuth();
      eventBus.emit('auth-settings-saved');
    } catch (balanceError) {
      console.error('[AuthTokensSettings] Ошибка при перепроверке баланса:', balanceError);
    }

    setTimeout(() => {
      emit('update');
    }, 100);
  } catch (e) {
    console.error('[AuthTokensSettings] Ошибка при удалении токена:', e);
    alert(t('settings.authTokens.deleteError', { error: e.response?.data?.error || e.message }));
  }
}

function getNetworkLabel(networkId) {
  const fromRpc = networks.value.find((n) => n.value === networkId);
  if (fromRpc) return fromRpc.label;
  const found = networkGroups.value
    .flatMap((g) => g.options)
    .find((opt) => opt.value === networkId);
  return found ? found.label : networkId;
}

/** numeric(36,18) с бэка → «1», не «1.000000000000000000» */
function formatMinBalance(value) {
  if (value == null || value === '') return '0';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const trimmed = n.toFixed(18).replace(/\.?0+$/, '');
  return trimmed === '-0' ? '0' : trimmed;
}

function shortAddress(address) {
  const a = String(address || '');
  if (a.length < 14) return a;
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

function getAccessLevelDescription(level) {
  switch (level) {
    case 'readonly':
      return t('settings.authTokens.accessReadonly');
    case 'editor':
      return t('settings.authTokens.accessEditor');
    case 'user':
    default:
      return t('settings.authTokens.accessUser');
  }
}
</script>

<style scoped>
.auth-tokens-settings {
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: auto;
}

.tokens-list {
  margin-bottom: var(--spacing-lg, 20px);
  min-width: 720px;
}

.tokens-list-head,
.token-entry {
  display: grid;
  grid-template-columns:
    minmax(72px, 0.55fr)
    minmax(148px, 1.3fr)
    minmax(88px, 0.7fr)
    minmax(64px, 0.4fr)
    minmax(72px, 0.4fr)
    minmax(64px, 0.35fr)
    96px;
  gap: var(--spacing-sm, 8px) var(--spacing-md, 12px);
  align-items: center;
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
}

.tokens-list-head {
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: 600;
  color: var(--theme-text-muted, #666);
  border-bottom: 1px solid var(--theme-border, #e9ecef);
  white-space: nowrap;
}

.token-entry {
  border-bottom: 1px solid var(--theme-border, #e9ecef);
}

.token-cell {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--font-size-sm, 0.875rem);
}

.token-cell--mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.token-cell--num {
  font-variant-numeric: tabular-nums;
  text-align: right;
  overflow: visible;
  text-overflow: clip;
}

.token-actions {
  display: inline-flex;
  flex-wrap: nowrap;
  justify-self: stretch;
  justify-content: flex-end;
}

.token-actions .btn {
  white-space: nowrap;
}

.empty-hint {
  margin: 0 0 var(--spacing-lg, 20px);
  color: var(--theme-text-muted, #666);
}

.add-token-form {
  margin-top: var(--spacing-lg, 20px);
  max-width: 720px;
}

.add-token-form h5 {
  margin: 0 0 var(--spacing-md, 12px);
  white-space: nowrap;
}

.form-group {
  margin-bottom: var(--spacing-md, 15px);
}

.form-label {
  display: block;
  margin-bottom: var(--spacing-xs, 6px);
  white-space: nowrap;
}

.access-settings {
  margin: var(--spacing-lg, 20px) 0;
  padding: var(--spacing-md, 15px);
  background: transparent;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--theme-border, #e9ecef);
}

.access-settings h6 {
  margin: 0 0 var(--spacing-md, 12px);
  white-space: nowrap;
}

.thresholds-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md, 15px);
}

.form-text {
  display: block;
  margin-top: var(--spacing-xs, 6px);
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--theme-text-muted, #6c757d);
}

.access-level-info {
  margin-bottom: var(--spacing-lg, 20px);
  padding: var(--spacing-md, 15px);
  background-color: transparent;
  border-radius: var(--radius-lg, 8px);
  border-left: 3px solid var(--color-secondary, #2196f3);
}

.access-level-badge {
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
  border-radius: var(--radius-md, 6px);
  font-weight: 600;
  font-size: var(--font-size-sm, 0.875rem);
  margin-bottom: var(--spacing-sm, 8px);
  border: 1px solid var(--color-border, #dee2e6);
  white-space: nowrap;
  max-width: 100%;
}

.access-level-text,
.token-count {
  white-space: nowrap;
}

.access-readonly {
  background-color: color-mix(in srgb, var(--color-warning, #ffc107) 14%, white);
  color: var(--theme-text, #222);
  border-color: color-mix(in srgb, var(--color-warning, #ffc107) 35%, white);
}

.access-editor {
  background-color: color-mix(in srgb, var(--color-secondary, #2196f3) 12%, white);
  color: var(--theme-text, #222);
  border-color: color-mix(in srgb, var(--color-secondary, #2196f3) 30%, white);
}

.access-user {
  background-color: color-mix(in srgb, var(--color-danger, #dc3545) 10%, white);
  color: var(--theme-text, #222);
  border-color: color-mix(in srgb, var(--color-danger, #dc3545) 30%, white);
}

.token-count {
  font-weight: 400;
  opacity: 0.8;
}

.access-level-description {
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--color-text-light, #666);
  margin-top: var(--spacing-xs, 6px);
}

.form-control[disabled],
.form-control:disabled {
  background-color: #f8f9fa !important;
  color: #6c757d !important;
  border-color: #dee2e6 !important;
  cursor: not-allowed !important;
  opacity: 1 !important;
}

@media (max-width: 768px) {
  .thresholds-row {
    grid-template-columns: 1fr;
  }
}
</style>
