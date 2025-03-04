<template>
  <div class="access-control">
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    <div v-else-if="loading" class="loading-message">Загрузка...</div>
    <div v-else>
      <div v-if="!isConnected" class="alert alert-warning">
        Подключите ваш кошелек для проверки доступа
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
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const address = ref('');
const isConnected = ref(true);
const loading = ref(false);
const error = ref(null);
const accessInfo = ref({
  hasAccess: false,
  token: '',
  role: '',
  expiresAt: null,
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
        'x-wallet-address': address.value,
      },
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
watch(
  () => address.value,
  () => {
    checkAccess();
  }
);

// Проверяем доступ при монтировании компонента
onMounted(() => {
  if (isConnected.value && address.value) {
    checkAccess();
  }
});

async function loadTokens() {
  try {
    console.log('Загрузка токенов...');
    loading.value = true;

    // Добавляем withCredentials для передачи куки с сессией
    const response = await axios.get('/api/access/tokens', {
      withCredentials: true,
    });

    console.log('Ответ API:', response.data);

    if (response.data && response.data.length > 0) {
      // Если есть токены, берем первый активный
      const activeToken = response.data.find((token) => {
        const expiresAt = new Date(token.expires_at);
        return expiresAt > new Date();
      });

      if (activeToken) {
        accessInfo.value = {
          hasAccess: true,
          token: activeToken.id,
          role: activeToken.role,
          expiresAt: activeToken.expires_at,
        };
      } else {
        accessInfo.value = { hasAccess: false };
      }
    } else {
      accessInfo.value = { hasAccess: false };
    }
  } catch (error) {
    console.error('Ошибка при загрузке токенов:', error);
    error.value = 'Ошибка при проверке доступа: ' + (error.response?.data?.error || error.message);
    accessInfo.value = { hasAccess: false };
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  console.log('Компонент AccessControl загружен');
  console.log('isAdmin:', authStore.isAdmin);
  await loadTokens();
});
</script>

<style scoped>
.access-control {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.alert {
  padding: 10px 15px;
  margin-bottom: 10px;
  border-radius: 4px;
}

.alert-warning {
  background-color: #fff3cd;
  border: 1px solid #ffeeba;
  color: #856404;
}

.alert-info {
  background-color: #d1ecf1;
  border: 1px solid #bee5eb;
  color: #0c5460;
}

.alert-danger {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.alert-success {
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.error-message {
  color: #721c24;
  background-color: #f8d7da;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
}

.loading-message {
  color: #0c5460;
  background-color: #d1ecf1;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
}
</style>
