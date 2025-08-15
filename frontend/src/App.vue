<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <div id="app">
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner" />
    </div>

    <RouterView v-slot="{ Component }">
      <component 
        :is="Component" 
        :isAuthenticated="auth.isAuthenticated.value"
        :identities="auth.identities.value"
        :tokenBalances="tokenBalances"
        :isLoadingTokens="isLoadingTokens"
        :formattedLastUpdate="formattedLastUpdate" 
        @auth-action-completed="handleAuthActionCompleted"
      />
    </RouterView>
    
    <!-- Отладочная информация -->
    <div v-if="false" style="position: fixed; top: 10px; right: 10px; background: white; padding: 10px; border: 1px solid black; z-index: 9999;">
      <h4>Debug Info:</h4>
      <p>isAuthenticated: {{ auth.isAuthenticated.value }}</p>
      <p>tokenBalances: {{ JSON.stringify(tokenBalances) }}</p>
      <p>isLoadingTokens: {{ isLoadingTokens }}</p>
    </div>
  </div>
</template>

<script setup>
  import { ref, watch, onMounted, computed, onUnmounted } from 'vue';
  import { RouterView } from 'vue-router';
  import { useAuth, provideAuth } from './composables/useAuth';
  import { useTokenBalancesWebSocket } from './composables/useTokenBalancesWebSocket';
  import eventBus from './utils/eventBus';
  import wsClient from './utils/websocket';
  
  // Импорт стилей
  import './assets/styles/variables.css';
  import './assets/styles/base.css';
  import './assets/styles/layout.css';
  import './assets/styles/global.css';

  // Состояние загрузки
  const isLoading = ref(false);

  // Проверка наличия MetaMask
  const isMetaMaskAvailable = ref(false);

  // Использование composable для аутентификации
  const auth = useAuth();

  // --- Логика загрузки баланса токенов через WebSocket --- 
  // Предоставляем auth контекст
  provideAuth();
  
  // Инициализируем WebSocket composable
  const { 
    tokenBalances, 
    isLoadingTokens, 
    lastUpdateTime, 
    formattedLastUpdate,
    requestTokenBalances,
    startAutoUpdate,
    stopAutoUpdate
  } = useTokenBalancesWebSocket();

  const identities = computed(() => auth.identities.value);

  const hasIdentityType = (type) => {
    if (!identities.value) return false;
    return identities.value.some((identity) => identity.provider === type);
  };

  const getIdentityValue = (type) => {
    if (!identities.value) return null;
    const identity = identities.value.find((identity) => identity.provider === type);
    return identity ? identity.provider_id : null;
  };

  const refreshTokenBalances = () => {
    if (!hasIdentityType('wallet') || !auth.isAuthenticated.value) {
      console.log('[App] Нет кошелька или не авторизован');
      return;
    }
    
    const walletAddress = getIdentityValue('wallet');
    console.log('[App] Запрашиваем обновление балансов через WebSocket для:', walletAddress, 'userId:', auth.userId.value);
    requestTokenBalances(walletAddress, auth.userId.value);
  };
  
  // Следим за изменениями в идентификаторах
  watch(identities, (newIdentities, oldIdentities) => {
    console.log('[App] identities changed:', { newIdentities, oldIdentities });
    if (auth.isAuthenticated.value) {
        const newWalletId = getIdentityValue('wallet');
        const oldWalletIdentity = oldIdentities ? oldIdentities.find(id => id.provider === 'wallet') : null;
        const oldWalletId = oldWalletIdentity ? oldWalletIdentity.provider_id : null;
        
        console.log('[App] wallet IDs comparison:', { newWalletId, oldWalletId });
        
        if (newWalletId !== oldWalletId) {
            console.log('[App] Обнаружено изменение идентификатора кошелька, обновляем балансы');
            if (newWalletId) {
              startAutoUpdate(newWalletId, auth.userId.value);
            } else {
              stopAutoUpdate();
            }
        }
    }
  }, { deep: true });

  // Мониторинг изменений состояния аутентификации
  watch(auth.isAuthenticated, (isAuth) => {
    console.log('[App] Состояние аутентификации изменилось:', isAuth);
    if (isAuth) {
      refreshTokenBalances(); // Вызываем сразу, если нужно обновить при смене auth
    }
  });
  
  // Проверка наличия MetaMask при загрузке
  const checkMetaMaskAvailability = () => {
    try {
      isMetaMaskAvailable.value = !!window.ethereum && window.ethereum.isMetaMask;
      console.log('[App] MetaMask доступен:', isMetaMaskAvailable.value);
    } catch (error) {
      console.error('[App] Ошибка проверки MetaMask:', error);
      isMetaMaskAvailable.value = false;
    }
  };

  // --- Возвращаем и улучшаем функцию-обработчик --- 
  const handleAuthActionCompleted = async () => {
    // console.log('[App] Auth action completed, triggering updates...');
    isLoading.value = true; // Показываем индикатор загрузки
    try {
      // 1. Проверяем аутентификацию (обновит identities и isAuthenticated)
      await auth.checkAuth();
              // console.log('[App] auth.checkAuth() completed. isAuthenticated:', auth.isAuthenticated.value);
      
      // 2. Обновляем баланс через WebSocket
      refreshTokenBalances();
              // console.log('[App] refreshTokenBalances() completed.');

      // 3. Явно оповещаем компоненты об изменении состояния авторизации
      // Передаем актуальное состояние из useAuth
      eventBus.emit('auth-state-changed', { 
          isAuthenticated: auth.isAuthenticated.value, 
          authType: auth.authType.value, // Предполагаем, что authType есть в useAuth
          userId: auth.userId.value, // Предполагаем, что userId есть в useAuth
          fromApp: true // Флаг, что событие от App.vue
      });
              // console.log('[App] auth-state-changed event emitted.');

    } catch (error) {
        // console.error("[App] Error during auth action handling:", error);
    } finally {
        isLoading.value = false; // Скрываем индикатор загрузки
    }
  };

  // Первичная загрузка баланса при монтировании, если пользователь уже авторизован
  onMounted(() => {
    console.log('[App] onMounted - auth.isAuthenticated:', auth.isAuthenticated.value);
    console.log('[App] onMounted - identities:', auth.identities.value);
    
    // Проверяем наличие MetaMask
    checkMetaMaskAvailability();
    if (auth.isAuthenticated.value) {
      console.log('[App] onMounted - вызываем refreshTokenBalances');
      refreshTokenBalances();
    }
    
    // Подписываемся на событие изменения настроек аутентификации
    const unsubscribe = eventBus.on('auth-settings-saved', () => {
      // console.log('[App] Получено событие сохранения настроек аутентификации, обновляем балансы');
      if (auth.isAuthenticated.value) {
        refreshTokenBalances();
      }
    });
    
    // WebSocket события для токенов обрабатываются в useTokenBalancesWebSocket
    
    // Отписываемся при размонтировании компонента
    onUnmounted(() => {
      if (unsubscribe) {
        unsubscribe();
      }
    });
  });
</script>

<style>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 5px solid var(--color-grey-light);
  border-top: 5px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
