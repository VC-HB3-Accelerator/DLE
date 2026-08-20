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
  <div class="rpc-providers-settings">
    <div v-if="Array.isArray(rpcConfigs) && rpcConfigs.length > 0" class="rpc-list">
      <div class="rpc-list-head" aria-hidden="true">
        <span>{{ $t('settings.rpc.networkId') }}</span>
        <span>{{ $t('settings.rpc.url') }}</span>
        <span>{{ $t('settings.rpc.chainId') }}</span>
        <span></span>
      </div>
      <div v-for="(rpc, index) in rpcConfigs" :key="rpc.networkId" class="rpc-entry">
        <span class="rpc-cell" :title="String(rpc.networkId)">{{ rpc.networkId }}</span>
        <span class="rpc-cell rpc-cell--url" :title="rpc.rpcUrlDisplay || rpc.rpcUrl">{{ rpc.rpcUrlDisplay || rpc.rpcUrl }}</span>
        <span class="rpc-cell">{{ rpc.chainId || '—' }}</span>
        <div class="rpc-actions">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            @click="testRpc(rpc)"
            :disabled="testingRpc && testingRpcId === rpc.networkId"
          >
            {{ testingRpc && testingRpcId === rpc.networkId ? t('settings.rpc.testing') : t('settings.rpc.test') }}
          </button>
          <button type="button" class="btn btn-danger btn-sm" @click="removeRpc(index)">
            {{ $t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
    <p v-else class="empty-hint">{{ $t('settings.rpc.empty') }}</p>
    <div class="add-rpc-form">
      <h5>{{ $t('settings.rpc.addTitle') }}</h5>
      <div class="form-group">
        <label class="form-label">{{ $t('settings.rpc.networkId') }}</label>
        <select v-model="networkEntry.networkId" class="form-control">
          <optgroup v-for="(group, groupIndex) in networkGroups" :key="groupIndex" :label="group.label">
            <option v-for="option in group.options" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </optgroup>
        </select>
        <div v-if="networkEntry.networkId === 'custom'" class="mt-2">
          <label class="form-label">{{ $t('settings.rpc.customId') }}</label>
          <input type="text" v-model="networkEntry.customNetworkId" class="form-control" :placeholder="$t('settings.rpc.customIdPlaceholder')">
          <label class="form-label mt-2">{{ $t('settings.rpc.chainIdLabel') }}</label>
          <input type="number" v-model.number="networkEntry.customChainId" class="form-control" :placeholder="$t('settings.rpc.chainIdPlaceholder')">
          <small class="form-help">{{ $t('settings.rpc.chainIdHelp') }}</small>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">{{ $t('settings.rpc.rpcUrlLabel') }}</label>
        <input type="text" v-model="networkEntry.rpcUrl" class="form-control" placeholder="https://...">
      </div>
      <button type="button" class="btn btn-secondary" @click="addRpc">{{ $t('settings.rpc.addButton') }}</button>
    </div>

    <RpcTestModal
      :show="showTestModal"
      :result="testResult"
      @close="showTestModal = false"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import useBlockchainNetworks from '@/composables/useBlockchainNetworks';
import api from '@/api/axios';
import RpcTestModal from '@/components/RpcTestModal.vue';

const { t } = useI18n();
const props = defineProps({
  rpcConfigs: { type: Array, required: true, default: () => [] }
});
const emit = defineEmits(['update', 'test']);

const showTestModal = ref(false);
const testResult = ref({});

const {
  networkGroups,
  networkEntry,
  validateAndPrepareNetworkConfig,
  resetNetworkEntry,
  testRpcConnection,
  testingRpc,
  testingRpcId
} = useBlockchainNetworks();

async function addRpc() {
  const result = validateAndPrepareNetworkConfig();
  if (!result.valid) {
    alert(result.error);
    return;
  }
  const { networkId, rpcUrl, chainId } = result.networkConfig;
  if (props.rpcConfigs.some(rpc => rpc.networkId === networkId)) {
    alert(t('settings.security.rpcExists', { networkId }));
    return;
  }
  try {
    await api.post('/settings/rpc', { networkId, rpcUrl, chainId });
    emit('update');
    resetNetworkEntry();
  } catch (e) {
    alert(t('settings.rpc.addError', { error: e.response?.data?.error || e.message }));
  }
}

async function removeRpc(index) {
  const rpc = props.rpcConfigs[index];
  if (!rpc) return;
  if (!confirm(t('settings.rpc.confirmDelete', { networkId: rpc.networkId }))) return;
  try {
    await api.delete(`/settings/rpc/${rpc.networkId}`);
    emit('update');
  } catch (e) {
    alert(t('settings.rpc.deleteError', { error: e.response?.data?.error || e.message }));
  }
}

async function testRpc(rpc) {
  if (!rpc.networkId || !rpc.rpcUrl) {
    alert(t('settings.rpc.testRequiresBoth'));
    return;
  }
  const result = await testRpcConnection(rpc.networkId, rpc.rpcUrl);
  testResult.value = {
    success: Boolean(result.success),
    networkId: rpc.networkId,
    blockNumber: result.blockNumber,
    message: result.message,
    error: result.error || ''
  };
  showTestModal.value = true;
}
</script>

<style scoped>
.rpc-providers-settings {
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: auto;
}

.rpc-list {
  margin-bottom: var(--spacing-lg, 20px);
  min-width: 720px;
}

.rpc-list-head,
.rpc-entry {
  display: grid;
  grid-template-columns: minmax(110px, 0.7fr) minmax(180px, 2fr) minmax(70px, 0.45fr) auto;
  gap: var(--spacing-md, 12px);
  align-items: center;
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
}

.rpc-list-head {
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: 600;
  color: var(--theme-text-muted, #666);
  border-bottom: 1px solid var(--theme-border, #e9ecef);
  white-space: nowrap;
}

.rpc-entry {
  border-bottom: 1px solid var(--theme-border, #e9ecef);
}

.rpc-cell {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--font-size-sm, 0.875rem);
}

.rpc-cell--url {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.rpc-actions {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: var(--spacing-sm, 8px);
  justify-self: end;
}

.empty-hint {
  margin: 0 0 var(--spacing-lg, 20px);
  color: var(--theme-text-muted, #666);
}

.add-rpc-form {
  margin-top: var(--spacing-lg, 20px);
  max-width: 640px;
}

.add-rpc-form h5 {
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

.form-help {
  display: block;
  margin-top: var(--spacing-xs, 6px);
  color: var(--theme-text-muted, #666);
  font-size: var(--font-size-sm, 0.875rem);
}

.mt-2 {
  margin-top: var(--spacing-sm, 10px);
}
</style>
