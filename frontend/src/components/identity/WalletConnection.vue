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
      console.error('Error connecting wallet:', err);
      error.value = err.message || 'Произошла ошибка при подключении кошелька';
    } finally {
      isLoading.value = false;
    }
  };
</script>
