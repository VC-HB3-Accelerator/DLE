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
      <p>{{ t('identity.wallet.connectPrompt') }}</p>
      <button :disabled="isLoading" class="wallet-btn" @click="connectWallet">
        <span class="wallet-icon">💳</span>
        {{ isLoading ? t('identity.wallet.connecting') : t('auth.connectWallet') }}
      </button>
    </div>
    <div v-else class="status-section">
      <p>{{ t('identity.wallet.connected') }}</p>
      <p class="address">{{ formatAddress(address) }}</p>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { useAuthContext } from '@/composables/useAuth';
  import { connectWithWallet } from '@/services/wallet';

  const { t } = useI18n();
  const emit = defineEmits(['close']);
  const { linkIdentity } = useAuthContext();

  onMounted(() => {
    window.addEventListener('clear-application-data', () => {
      console.log('[WalletConnection] Clearing wallet connection data');
    });
    
    window.addEventListener('refresh-application-data', () => {
      console.log('[WalletConnection] Refreshing wallet connection data');
    });
  });

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

      const result = await connectWithWallet();

      if (result.success) {
        address.value = result.address;
        await linkIdentity('wallet', result.address);
        emit('close');
      } else {
        error.value = result.error || t('identity.wallet.connectFailed');
      }
    } catch (err) {
      let errorMessage = t('identity.wallet.genericError');
      
      if (err.message && err.message.includes('MetaMask extension not found')) {
        errorMessage = t('identity.wallet.metamaskNotFound');
      } else if (err.message && err.message.includes('Failed to connect to MetaMask')) {
        errorMessage = t('identity.wallet.metamaskConnectFailed');
      } else if (err.message && /browser wallet|браузерный кошелек/i.test(err.message)) {
        errorMessage = t('identity.wallet.browserWalletNotInstalled');
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      error.value = errorMessage;
    } finally {
      isLoading.value = false;
    }
  };
</script>
