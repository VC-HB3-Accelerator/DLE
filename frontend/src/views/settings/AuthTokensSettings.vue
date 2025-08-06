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
  <div class="auth-tokens-settings">
    <h4>Токены аутентификации</h4>
    <div v-if="authTokens.length > 0" class="tokens-list">
      <div v-for="(token, index) in authTokens" :key="token.address + token.network" class="token-entry">
        <span><strong>Название:</strong> {{ token.name }}</span>
        <span><strong>Адрес:</strong> {{ token.address }}</span>
        <span><strong>Сеть:</strong> {{ getNetworkLabel(token.network) }}</span>
        <span><strong>Мин. баланс:</strong> {{ token.minBalance }}</span>
        <button 
          class="btn btn-sm" 
          :class="isAdmin ? 'btn-danger' : 'btn-secondary'" 
          @click="isAdmin ? removeToken(index) : null"
          :disabled="!isAdmin"
        >
          Удалить
        </button>
      </div>
    </div>
    <p v-else>Нет добавленных токенов аутентификации.</p>
    <div class="add-token-form">
      <h5>Добавить новый токен:</h5>
      <div class="form-group">
        <label>Название:</label>
        <input 
          type="text" 
          v-model="newToken.name" 
          class="form-control" 
          placeholder="test2"
          :disabled="!isAdmin"
        >
      </div>
      <div class="form-group">
        <label>Адрес:</label>
        <input 
          type="text" 
          v-model="newToken.address" 
          class="form-control" 
          placeholder="0x..."
          :disabled="!isAdmin"
        >
      </div>
      <div class="form-group">
        <label>Сеть:</label>
        <select v-model="newToken.network" class="form-control" :disabled="!isAdmin">
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
        <input 
          type="number" 
          v-model.number="newToken.minBalance" 
          class="form-control" 
          placeholder="0"
          :disabled="!isAdmin"
        >
      </div>
      <button 
        class="btn" 
        :class="isAdmin ? 'btn-secondary' : 'btn-secondary'" 
        @click="isAdmin ? addToken() : null"
        :disabled="!isAdmin"
      >
        Добавить токен
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue';
import useBlockchainNetworks from '@/composables/useBlockchainNetworks';
import api from '@/api/axios';
import { useAuthContext } from '@/composables/useAuth';
const props = defineProps({
  authTokens: { type: Array, required: true }
});
const emit = defineEmits(['update']);
const newToken = reactive({ name: '', address: '', network: '', minBalance: 0 });

const { networkGroups, networks } = useBlockchainNetworks();
const { isAdmin } = useAuthContext();

async function addToken() {
  if (!newToken.name || !newToken.address || !newToken.network) {
    alert('Все поля обязательны');
    return;
  }
  try {
    await api.post('/settings/auth-token', {
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
  
  console.log('[AuthTokensSettings] Удаление токена:', token);
  console.log('[AuthTokensSettings] URL:', `/settings/auth-token/${token.address}/${token.network}`);
  
  try {
    const response = await api.delete(`/settings/auth-token/${token.address}/${token.network}`);
    console.log('[AuthTokensSettings] Успешное удаление:', response.data);
    emit('update');
  } catch (e) {
    console.error('[AuthTokensSettings] Ошибка при удалении токена:', e);
    console.error('[AuthTokensSettings] Response:', e.response);
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

/* Стили для неактивных кнопок */
.btn[disabled], .btn:disabled {
  background: #e0e0e0 !important;
  color: #aaa !important;
  border-color: #ccc !important;
  cursor: not-allowed !important;
  opacity: 1 !important;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

/* Стили для неактивных полей формы */
.form-control[disabled], .form-control:disabled {
  background-color: #f8f9fa !important;
  color: #6c757d !important;
  border-color: #dee2e6 !important;
  cursor: not-allowed !important;
  opacity: 1 !important;
}

.form-control {
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}
</style> 