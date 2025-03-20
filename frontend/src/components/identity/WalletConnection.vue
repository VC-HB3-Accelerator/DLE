<template>
  <div class="wallet-connection">
    <button 
      @click="connectWallet" 
      :disabled="isLoading"
      class="wallet-btn"
    >
      {{ isConnected ? 'Подключено' : 'Подключить кошелек' }}
    </button>
  </div>
</template>

<script setup>
import { ref, inject, computed } from 'vue';
import { connectWithWallet } from '../../services/wallet';
import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';
import axios from 'axios';

// Определяем props
const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false
  }
});

// Определяем состояние
const isLoading = ref(false);
const auth = inject('auth');
const isConnecting = ref(false);
const address = ref('');

// Вычисляемое свойство для статуса подключения
const isConnected = computed(() => auth.isAuthenticated.value);

const emit = defineEmits(['connect']);

// Метод подключения кошелька
const connectWallet = async () => {
  if (isLoading.value) return;
  
  try {
    isLoading.value = true;
    const result = await connectWithWallet();
    await auth.checkAuth();
    console.log('Wallet connected, auth state:', auth.isAuthenticated.value);
    emit('connect', result);
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