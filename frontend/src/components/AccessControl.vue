<template>
  <div class="access-control">
    <div v-if="!isConnected" class="alert alert-warning">
      Подключите ваш кошелек для проверки доступа
    </div>
    <div v-else-if="loading" class="alert alert-info">
      Проверка доступа...
    </div>
    <div v-else-if="error" class="alert alert-danger">
      {{ error }}
    </div>
    <div v-else-if="accessInfo.hasAccess" class="alert alert-success">
      <strong>Доступ разрешен!</strong>
      <div>Токен: {{ accessInfo.token }}</div>
      <div>Роль: {{ accessInfo.role }}</div>
      <div>Истекает: {{ formatDate(accessInfo.expiresAt) }}</div>
    </div>
    <div v-else class="alert alert-danger">
      <strong>Доступ запрещен!</strong>
      <p>У вас нет активного токена доступа.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useEthereum } from '../composables/useEthereum';
import axios from 'axios';

const { address, isConnected } = useEthereum();
const loading = ref(false);
const error = ref(null);
const accessInfo = ref({
  hasAccess: false,
  token: '',
  role: '',
  expiresAt: null
});

// Форматирование даты
function formatDate(timestamp) {
  if (!timestamp) return 'Н/Д';
  return new Date(timestamp).toLocaleString();
}

// Проверка доступа
async function checkAccess() {
  if (!isConnected.value || !address.value) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    const response = await axios.get('/access/check', {
      headers: {
        'x-wallet-address': address.value
      }
    });
    
    accessInfo.value = response.data;
  } catch (err) {
    console.error('Ошибка проверки доступа:', err);
    error.value = err.response?.data?.error || 'Ошибка проверки доступа';
    accessInfo.value = { hasAccess: false };
  } finally {
    loading.value = false;
  }
}

// Проверяем доступ при изменении адреса
watch(() => address.value, () => {
  checkAccess();
});

// Проверяем доступ при монтировании компонента
onMounted(() => {
  if (isConnected.value && address.value) {
    checkAccess();
  }
});
</script> 