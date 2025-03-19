<template>
  <div class="wallet-connection">
    <button 
      @click="connectWallet" 
      :disabled="isLoading"
      class="wallet-btn"
    >
      {{ isAuthenticated ? 'Подключено' : 'Подключить кошелек' }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { connectWithWallet } from '../../services/wallet';

// Определяем props
const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false
  }
});

// Определяем состояние
const isLoading = ref(false);

const emit = defineEmits(['connect']);

// Метод подключения кошелька
const connectWallet = async () => {
  if (isLoading.value) return;
  
  try {
    isLoading.value = true;
    // Получаем адрес кошелька
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const address = accounts[0];
    
    // Получаем nonce
    const nonceResponse = await api.get(`/api/auth/nonce?address=${address}`);
    const nonce = nonceResponse.data.nonce;
    
    // Подписываем сообщение
    const message = `${window.location.host} wants you to sign in with your Ethereum account:\n${address.slice(0, 42)}...`;
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address]
    });
    
    emit('connect', { address, signature, message });
  } catch (error) {
    console.error('Error connecting wallet:', error);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.wallet-connection {
  margin: 10px 0;
}

.wallet-btn {
  padding: 10px 20px;
  background-color: #4a5568;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.wallet-btn:hover:not(:disabled) {
  background-color: #2d3748;
}

.wallet-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style> 