<template>
  <div class="auth-tokens-settings">
    <h4>Токены аутентификации</h4>
    <div v-if="authTokens.length > 0" class="tokens-list">
      <div v-for="(token, index) in authTokens" :key="token.address + token.network" class="token-entry">
        <span><strong>Название:</strong> {{ token.name }}</span>
        <span><strong>Адрес:</strong> {{ token.address }}</span>
        <span><strong>Сеть:</strong> {{ getNetworkLabel(token.network) }}</span>
        <span><strong>Мин. баланс:</strong> {{ token.minBalance }}</span>
        <button class="btn btn-danger btn-sm" @click="removeToken(index)">Удалить</button>
      </div>
    </div>
    <p v-else>Нет добавленных токенов аутентификации.</p>
    <div class="add-token-form">
      <h5>Добавить новый токен:</h5>
      <div class="form-group">
        <label>Название:</label>
        <input type="text" v-model="newToken.name" class="form-control" placeholder="test2">
      </div>
      <div class="form-group">
        <label>Адрес:</label>
        <input type="text" v-model="newToken.address" class="form-control" placeholder="0x...">
      </div>
      <div class="form-group">
        <label>Сеть:</label>
        <select v-model="newToken.network" class="form-control">
          <option value="">-- Выберите сеть --</option>
          <optgroup v-for="(group, groupIndex) in networkGroups" :key="groupIndex" :label="group.label">
            <option v-for="option in group.options" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </optgroup>
        </select>
      </div>
      <div class="form-group">
        <label>Мин. баланс:</label>
        <input type="number" v-model.number="newToken.minBalance" class="form-control" placeholder="0">
      </div>
      <button class="btn btn-secondary" @click="addToken">Добавить токен</button>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue';
import useBlockchainNetworks from '@/composables/useBlockchainNetworks';
import api from '@/api/axios';
const props = defineProps({
  authTokens: { type: Array, required: true }
});
const emit = defineEmits(['update']);
const newToken = reactive({ name: '', address: '', network: '', minBalance: 0 });

const { networkGroups, networks } = useBlockchainNetworks();

async function addToken() {
  if (!newToken.name || !newToken.address || !newToken.network) {
    alert('Все поля обязательны');
    return;
  }
  try {
    await api.post('/api/settings/auth-token', {
      ...newToken,
      minBalance: Number(newToken.minBalance) || 0
    });
    emit('update');
    newToken.name = '';
    newToken.address = '';
    newToken.network = '';
    newToken.minBalance = 0;
  } catch (e) {
    alert('Ошибка при добавлении токена: ' + (e.response?.data?.error || e.message));
  }
}

async function removeToken(index) {
  const token = props.authTokens[index];
  if (!token) return;
  if (!confirm(`Удалить токен ${token.name} (${token.address})?`)) return;
  try {
    await api.delete(`/api/settings/auth-token/${token.address}/${token.network}`);
    emit('update');
  } catch (e) {
    alert('Ошибка при удалении токена: ' + (e.response?.data?.error || e.message));
  }
}

function getNetworkLabel(networkId) {
  const found = networks.value.find(n => n.value === networkId);
  return found ? found.label : networkId;
}
</script>

<style scoped>
.tokens-list { margin-bottom: 1rem; }
.token-entry { display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem; }
.add-token-form { margin-top: 1rem; }
</style> 