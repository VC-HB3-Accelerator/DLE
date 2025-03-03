<template>
  <div class="card">
    <div class="card-header">
      <h5>Проверка доступа</h5>
    </div>
    <div class="card-body">
      <div v-if="!isConnected" class="alert alert-warning">
        Подключите ваш кошелек для проверки доступа
      </div>
      <div v-else>
        <div class="mb-3">
          <h6>Статус доступа:</h6>
          <div v-if="loading" class="alert alert-info">
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
        
        <div class="mb-3">
          <h6>Тестирование API:</h6>
          <div class="d-grid gap-2">
            <button 
              @click="testPublicAPI" 
              class="btn btn-primary mb-2"
            >
              Тест публичного API
            </button>
            <button 
              @click="testProtectedAPI" 
              class="btn btn-warning mb-2"
            >
              Тест защищенного API
            </button>
            <button 
              @click="testAdminAPI" 
              class="btn btn-danger"
            >
              Тест админского API
            </button>
          </div>
        </div>
        
        <div v-if="apiResult" class="mt-3">
          <h6>Результат запроса:</h6>
          <div :class="['alert', apiResult.success ? 'alert-success' : 'alert-danger']">
            <strong>{{ apiResult.message }}</strong>
            <div v-if="apiResult.data">
              <pre>{{ JSON.stringify(apiResult.data, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useEthereum } from './useEthereum';
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
const apiResult = ref(null);

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
    const response = await axios.get('/api/access/check', {
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

// Тест публичного API
async function testPublicAPI() {
  apiResult.value = null;
  
  try {
    const response = await axios.get('/api/public');
    apiResult.value = {
      success: true,
      message: 'Публичный API доступен',
      data: response.data
    };
  } catch (err) {
    apiResult.value = {
      success: false,
      message: 'Ошибка доступа к публичному API',
      data: err.response?.data
    };
  }
}

// Тест защищенного API
async function testProtectedAPI() {
  apiResult.value = null;
  
  try {
    const response = await axios.get('/api/protected', {
      headers: {
        'x-wallet-address': address.value
      }
    });
    apiResult.value = {
      success: true,
      message: 'Защищенный API доступен',
      data: response.data
    };
  } catch (err) {
    apiResult.value = {
      success: false,
      message: 'Ошибка доступа к защищенному API',
      data: err.response?.data
    };
  }
}

// Тест админского API
async function testAdminAPI() {
  apiResult.value = null;
  
  try {
    const response = await axios.get('/api/admin', {
      headers: {
        'x-wallet-address': address.value
      }
    });
    apiResult.value = {
      success: true,
      message: 'Админский API доступен',
      data: response.data
    };
  } catch (err) {
    apiResult.value = {
      success: false,
      message: 'Ошибка доступа к админскому API',
      data: err.response?.data
    };
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