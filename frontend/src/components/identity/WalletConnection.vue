<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <div class="wallet-connection">
    <div v-if="!isConnected" class="connect-section">
      <p>Подключите свой кошелек для доступа к расширенным функциям</p>
      <button :disabled="isLoading" class="wallet-btn" @click="connectWallet">
        <span class="wallet-icon">💳</span>
        {{ isLoading ? 'Подключение...' : 'Подключить кошелек' }}
      </button>
    </div>
    <div v-else class="status-section">
      <p>Кошелек подключен</p>
      <p class="address">{{ formatAddress(address) }}</p>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup>
  import { ref, computed } from 'vue';
  import { useAuthContext } from '@/composables/useAuth';

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[WalletConnection] Clearing wallet connection data');
    // Очищаем данные при выходе из системы
    // WalletConnection не нуждается в очистке данных
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[WalletConnection] Refreshing wallet connection data');
    // WalletConnection не нуждается в обновлении данных
  });
});
  import { connectWithWallet } from '@/services/wallet';

  const emit = defineEmits(['close']);
  const { linkIdentity } = useAuthContext();

  const isLoading = ref(false);
  const error = ref('');
  const address = ref('');

  const isConnected = computed(() => !!address.value);

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const connectWallet = async () => {
    if (isLoading.value) return;

    try {
      isLoading.value = true;
      error.value = '';

      // Подключаем кошелек
      const result = await connectWithWallet();

      if (result.success) {
        address.value = result.address;

        // Связываем кошелек с текущим пользователем
        await linkIdentity('wallet', result.address);
        emit('close');
      } else {
        error.value = result.error || 'Не удалось подключить кошелек';
      }
    } catch (err) {
      // console.error('Error connecting wallet:', err);
      
      // Улучшенная обработка ошибок MetaMask
      let errorMessage = 'Произошла ошибка при подключении кошелька';
      
      if (err.message && err.message.includes('MetaMask extension not found')) {
        errorMessage = 'Расширение MetaMask не найдено. Пожалуйста, установите MetaMask и обновите страницу.';
      } else if (err.message && err.message.includes('Failed to connect to MetaMask')) {
        errorMessage = 'Не удалось подключиться к MetaMask. Проверьте, что расширение установлено и активно.';
      } else if (err.message && err.message.includes('Браузерный кошелек не установлен')) {
        errorMessage = 'Браузерный кошелек не установлен. Пожалуйста, установите MetaMask.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      error.value = errorMessage;
    } finally {
      isLoading.value = false;
    }
  };
</script>
