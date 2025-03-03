<template>
  <button @click.stop.prevent="connect" class="auth-btn wallet-btn">
    <span class="auth-icon">💼</span> Подключить кошелек
  </button>
</template>

<script setup>
import { connectWallet } from '../services/wallet';
import { ref } from 'vue';

const error = ref('');

function connect() {
  console.log('Нажата кнопка "Подключить кошелек"');
  connectWallet((errorMessage) => {
    error.value = errorMessage;
    console.error('Ошибка при подключении кошелька:', errorMessage);
  });
}
</script>

<style scoped>
/* Стили для кнопки подключения кошелька */
.auth-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  border: none;
  width: 100%;
  font-weight: 500;
  transition: opacity 0.2s;
}

.auth-btn:hover {
  opacity: 0.9;
}

.auth-icon {
  margin-right: 0.75rem;
  font-size: 1.2rem;
}

.wallet-btn {
  background-color: #1976d2;
  color: white;
}
</style> 