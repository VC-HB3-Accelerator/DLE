<template>
  <div class="card">
    <div class="card-header">
      <h5>Управление токенами доступа</h5>
    </div>
    <div class="card-body">
      <div v-if="!isConnected" class="alert alert-warning">
        Подключите ваш кошелек для управления токенами
      </div>
      <div v-else-if="loading" class="alert alert-info">
        Загрузка...
      </div>
      <div v-else>
        <h6>Создать новый токен</h6>
        <form @submit.prevent="createToken" class="mb-4">
          <div class="mb-3">
            <label for="walletAddress" class="form-label">Адрес кошелька</label>
            <input
              type="text"
              class="form-control"
              id="walletAddress"
              v-model="newToken.walletAddress"
              placeholder="0x..."
              required
            />
          </div>
          <div class="mb-3">
            <label for="role" class="form-label">Роль</label>
            <select class="form-select" id="role" v-model="newToken.role" required>
              <option value="USER">Пользователь</option>
              <option value="ADMIN">Администратор</option>
            </select>
          </div>
          <div class="mb-3">
            <label for="expiresAt" class="form-label">Срок действия (дни)</label>
            <input
              type="number"
              class="form-control"
              id="expiresAt"
              v-model="newToken.expiresInDays"
              min="1"
              max="365"
              required
            />
          </div>
          <button type="submit" class="btn btn-primary">Создать токен</button>
        </form>

        <h6>Активные токены</h6>
        <div v-if="tokens.length === 0" class="alert alert-info">
          Нет активных токенов
        </div>
        <div v-else class="table-responsive">
          <table class="table table-striped">
            <thead>
              <tr>
                <th>ID</th>
                <th>Адрес</th>
                <th>Роль</th>
                <th>Истекает</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="token in tokens" :key="token.id">
                <td>{{ token.id }}</td>
                <td>{{ shortenAddress(token.walletAddress) }}</td>
                <td>{{ token.role }}</td>
                <td>{{ formatDate(token.expiresAt) }}</td>
                <td>
                  <button
                    @click="revokeToken(token.id)"
                    class="btn btn-sm btn-danger"
                  >
                    Отозвать
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useEthereum } from './useEthereum';
import axios from 'axios';

const { address, isConnected } = useEthereum();
const loading = ref(false);
const tokens = ref([]);
const newToken = ref({
  walletAddress: '',
  role: 'USER',
  expiresInDays: 30
});

// Сокращение адреса кошелька
function shortenAddress(addr) {
  if (!addr) return '';
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
}

// Форматирование даты
function formatDate(timestamp) {
  if (!timestamp) return 'Н/Д';
  return new Date(timestamp).toLocaleString();
}

// Загрузка токенов
async function loadTokens() {
  if (!isConnected.value || !address.value) return;
  
  loading.value = true;
  
  try {
    const response = await axios.get('/api/access/tokens', {
      headers: {
        'x-wallet-address': address.value
      }
    });
    
    tokens.value = response.data;
  } catch (err) {
    console.error('Ошибка загрузки токенов:', err);
    alert('Ошибка загрузки токенов: ' + (err.response?.data?.error || err.message));
  } finally {
    loading.value = false;
  }
}

// Создание токена
async function createToken() {
  if (!isConnected.value || !address.value) return;
  
  loading.value = true;
  
  try {
    await axios.post('/api/access/tokens', 
      {
        walletAddress: newToken.value.walletAddress,
        role: newToken.value.role,
        expiresInDays: parseInt(newToken.value.expiresInDays)
      },
      {
        headers: {
          'x-wallet-address': address.value
        }
      }
    );
    
    // Сбрасываем форму
    newToken.value = {
      walletAddress: '',
      role: 'USER',
      expiresInDays: 30
    };
    
    // Перезагружаем список токенов
    await loadTokens();
    
    alert('Токен успешно создан');
  } catch (err) {
    console.error('Ошибка создания токена:', err);
    alert('Ошибка создания токена: ' + (err.response?.data?.error || err.message));
  } finally {
    loading.value = false;
  }
}

// Отзыв токена
async function revokeToken(tokenId) {
  if (!isConnected.value || !address.value) return;
  
  if (!confirm('Вы уверены, что хотите отозвать этот токен?')) {
    return;
  }
  
  loading.value = true;
  
  try {
    await axios.delete(`/api/access/tokens/${tokenId}`, {
      headers: {
        'x-wallet-address': address.value
      }
    });
    
    // Перезагружаем список токенов
    await loadTokens();
    
    alert('Токен успешно отозван');
  } catch (err) {
    console.error('Ошибка отзыва токена:', err);
    alert('Ошибка отзыва токена: ' + (err.response?.data?.error || err.message));
  } finally {
    loading.value = false;
  }
}

// Загружаем токены при монтировании компонента
onMounted(() => {
  if (isConnected.value && address.value) {
    loadTokens();
  }
});
</script> 