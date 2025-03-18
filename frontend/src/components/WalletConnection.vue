<template>
  <div class="wallet-connection">
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="!authStore.isAuthenticated">
      <button @click="connectWallet" class="connect-button" :disabled="loading">
        <div v-if="loading" class="spinner"></div>
        {{ loading ? 'Подключение...' : 'Подключить кошелек' }}
      </button>
    </div>
    <div v-else class="wallet-info">
      <span class="address">{{ formatAddress(authStore.user?.address) }}</span>
      <button @click="disconnectWallet" class="disconnect-btn">Выйти</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { connectWithWallet } from '../utils/wallet';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();
const loading = ref(false);
const error = ref('');
const isConnecting = ref(false);

const props = defineProps({
  onWalletAuth: {
    type: Function,
    required: true
  },
  isAuthenticated: {
    type: Boolean,
    required: true
  }
});

// Форматирование адреса кошелька
const formatAddress = (address) => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Функция для подключения кошелька
const connectWallet = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    await props.onWalletAuth();
  } catch (err) {
    console.error('Ошибка при подключении кошелька:', err);
    error.value = 'Ошибка подключения кошелька';
  } finally {
    loading.value = false;
  }
};

// Автоматическое подключение при загрузке компонента
onMounted(async () => {
  console.log('WalletConnection mounted, checking auth state...');
  
  // Проверяем аутентификацию на сервере
  const authState = await authStore.checkAuth();
  console.log('Auth state after check:', authState);
  
  // Если пользователь уже аутентифицирован, не нужно ничего делать
  if (authState.authenticated) {
    console.log('User is already authenticated, no need to reconnect');
    return;
  }
  
  // Проверяем, есть ли сохраненный адрес кошелька
  const savedAddress = localStorage.getItem('walletAddress');
  
  if (savedAddress && window.ethereum) {
    console.log('Found saved wallet address:', savedAddress);
    
    try {
      // Проверяем, разблокирован ли MetaMask, но не запрашиваем разрешение
      const accounts = await window.ethereum.request({ 
        method: 'eth_accounts' // Используем eth_accounts вместо eth_requestAccounts
      });
      
      if (accounts && accounts.length > 0) {
        console.log('MetaMask is unlocked, connected accounts:', accounts);
        
        // Если кошелек разблокирован и есть доступные аккаунты, проверяем совпадение адреса
        if (accounts[0].toLowerCase() === savedAddress.toLowerCase()) {
          console.log('Current account matches saved address');
          
          // Не вызываем handleConnectWallet() автоматически, 
          // просто показываем пользователю, что он может подключиться
        } else {
          console.log('Current account does not match saved address');
          localStorage.removeItem('walletAddress');
        }
      } else {
        console.log('MetaMask is locked or no accounts available');
      }
    } catch (error) {
      console.error('Error checking MetaMask state:', error);
    }
  }
});

// Функция для отключения кошелька
const disconnectWallet = async () => {
  try {
    // Сначала отключаем MetaMask
    if (window.ethereum) {
      try {
        // Просто очищаем слушатели событий
        window.ethereum.removeAllListeners();
      } catch (error) {
        console.error('Error disconnecting MetaMask:', error);
      }
    }
    
    // Затем выполняем выход из системы
    await authStore.disconnect(router);
  } catch (error) {
    console.error('Error disconnecting wallet:', error);
  }
};
</script>

<style scoped>
.wallet-connection {
  margin: 20px 0;
}

.connect-button {
  background-color: #1976d2;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.connect-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.error-message {
  color: #d32f2f;
  margin-bottom: 10px;
  padding: 10px;
  background-color: #ffebee;
  border-radius: 4px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

.wallet-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.address {
  font-family: monospace;
  font-weight: bold;
}

.disconnect-btn {
  background-color: #f44336;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
