<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <div class="rpc-providers-settings">
    <h4>RPC Провайдеры</h4>
    <div v-if="Array.isArray(rpcConfigs) && rpcConfigs.length > 0" class="rpc-list">
      <div v-for="(rpc, index) in rpcConfigs" :key="rpc.networkId" class="rpc-entry">
        <span><strong>ID Сети:</strong> {{ rpc.networkId }}</span>
        <span><strong>URL:</strong> {{ rpc.rpcUrlDisplay || rpc.rpcUrl }}</span>
        <span v-if="rpc.chainId"><strong>Chain ID:</strong> {{ rpc.chainId }}</span>
        <button class="btn btn-info btn-sm" @click="testRpc(rpc)" :disabled="testingRpc && testingRpcId === rpc.networkId">
          <i class="fas" :class="testingRpc && testingRpcId === rpc.networkId ? 'fa-spinner fa-spin' : 'fa-check-circle'"></i>
          {{ testingRpc && testingRpcId === rpc.networkId ? 'Проверка...' : 'Тест' }}
        </button>
        <button class="btn btn-danger btn-sm" @click="removeRpc(index)">Удалить</button>
      </div>
    </div>
    <p v-else>Нет добавленных RPC конфигураций.</p>
    <div class="add-rpc-form">
      <h5>Добавить новую RPC конфигурацию:</h5>
      <div class="form-group">
        <label>ID Сети:</label>
        <select v-model="networkEntry.networkId" class="form-control">
          <optgroup v-for="(group, groupIndex) in networkGroups" :key="groupIndex" :label="group.label">
            <option v-for="option in group.options" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </optgroup>
        </select>
        <div v-if="networkEntry.networkId === 'custom'" class="mt-2">
          <label>Пользовательский ID:</label>
          <input type="text" v-model="networkEntry.customNetworkId" class="form-control" placeholder="Введите ID сети">
          <label class="mt-2">Chain ID:</label>
          <input type="number" v-model.number="networkEntry.customChainId" class="form-control" placeholder="Например, 1 для Ethereum">
          <small>Chain ID - уникальный идентификатор блокчейн-сети (целое число)</small>
        </div>
      </div>
      <div class="form-group">
        <label>RPC URL:</label>
        <input type="text" v-model="networkEntry.rpcUrl" class="form-control" placeholder="https://...">
      </div>
      <button class="btn btn-secondary" @click="addRpc">Добавить RPC</button>
    </div>
  </div>
</template>

<script setup>
import { ref, toRefs } from 'vue';
import useBlockchainNetworks from '@/composables/useBlockchainNetworks';
import api from '@/api/axios';
const props = defineProps({
  rpcConfigs: { type: Array, required: true, default: () => [] }
});
const emit = defineEmits(['update', 'test']);

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
    alert(`Ошибка: RPC конфигурация для сети с ID '${networkId}' уже существует.`);
    return;
  }
  try {
    await api.post('/settings/rpc', { networkId, rpcUrl, chainId });
    emit('update'); // сигнал родителю перезагрузить список
    resetNetworkEntry();
  } catch (e) {
    alert('Ошибка при добавлении RPC: ' + (e.response?.data?.error || e.message));
  }
}

async function removeRpc(index) {
  const rpc = props.rpcConfigs[index];
  if (!rpc) return;
  if (!confirm(`Удалить RPC для сети ${rpc.networkId}?`)) return;
  try {
    await api.delete(`/api/settings/rpc/${rpc.networkId}`);
    emit('update');
  } catch (e) {
    alert('Ошибка при удалении RPC: ' + (e.response?.data?.error || e.message));
  }
}

async function testRpc(rpc) {
  if (!rpc.networkId || !rpc.rpcUrl) {
    alert('Для теста RPC нужно указать и ID сети, и URL');
    return;
  }
  const result = await testRpcConnection(rpc.networkId, rpc.rpcUrl);
  if (result.success) {
    alert(result.message);
  } else {
    alert(`Ошибка при подключении к ${rpc.networkId}: ${result.error}`);
  }
}
</script>

<style scoped>
.rpc-list { margin-bottom: 1rem; }
.rpc-entry { display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem; }
.add-rpc-form { margin-top: 1rem; }
.suggestion {
  background-color: rgba(76, 175, 80, 0.1);
  border-left: 3px solid var(--color-primary, #4caf50);
  padding: 6px 10px;
  margin-top: 8px;
  border-radius: 0 4px 4px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--color-primary, #4caf50);
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.875rem;
}
.btn-link:hover {
  color: var(--color-primary-dark, #388e3c);
  text-decoration: none;
}
.mt-2 { margin-top: 10px; }
</style> 