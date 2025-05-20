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
        @auth-action-completed="handleAuthActionCompleted"
      />
    </RouterView>
  </div>
</template>

<script setup>
  import { ref, watch, onMounted, computed, onUnmounted } from 'vue';
  import { RouterView } from 'vue-router';
  import { useAuth } from './composables/useAuth';
  import { fetchTokenBalances } from './services/tokens';
  import eventBus from './utils/eventBus';
  
  // Импорт стилей
  import './assets/styles/variables.css';
  import './assets/styles/base.css';
  import './assets/styles/layout.css';
  import './assets/styles/global.css';

  // Состояние загрузки
  const isLoading = ref(false);

  // Использование composable для аутентификации
  const auth = useAuth();

  // --- Логика загрузки баланса токенов --- 
  const tokenBalances = ref({});
  const isLoadingTokens = ref(false);

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

  const refreshTokenBalances = async () => {
    if (!hasIdentityType('wallet') || !auth.isAuthenticated.value) {
      tokenBalances.value = {}; // Очищаем, если нет кошелька или не авторизован
      return;
    }
    
    isLoadingTokens.value = true;
    try {
      const walletAddress = getIdentityValue('wallet');
      console.log('[App] Обновление балансов для адреса:', walletAddress);
      
      const balances = await fetchTokenBalances(walletAddress);
      console.log('[App] Полученные балансы:', balances);
      
      tokenBalances.value = balances || {};
    } catch (error) {
      console.error('[App] Ошибка при получении балансов:', error);
      tokenBalances.value = {};
    } finally {
      isLoadingTokens.value = false;
    }
  };
  
  // Следим за изменениями в идентификаторах
  watch(identities, (newIdentities, oldIdentities) => {
    if (auth.isAuthenticated.value) {
        const newWalletId = getIdentityValue('wallet');
        const oldWalletIdentity = oldIdentities ? oldIdentities.find(id => id.provider === 'wallet') : null;
        const oldWalletId = oldWalletIdentity ? oldWalletIdentity.provider_id : null;
        
        if (newWalletId !== oldWalletId) {
            console.log('[App] Обнаружено изменение идентификатора кошелька, обновляем балансы');
            refreshTokenBalances();
        } else if (hasIdentityType('wallet') && Object.keys(tokenBalances.value).length === 0 && !isLoadingTokens.value) {
            // Если кошелек есть, но баланс пустой и не грузится - пробуем загрузить
            console.log('[App] Кошелек есть, но баланс пуст, пытаемся загрузить.');
            refreshTokenBalances();
        }
    }
  }, { deep: true });

  // Мониторинг изменений состояния аутентификации
  watch(auth.isAuthenticated, (isAuth) => {
    console.log('[App] Состояние аутентификации изменилось:', isAuth);
    if (isAuth) {
      // Убираем задержку, полагаемся на watch(identities) или прямо вызываем
      // setTimeout(refreshTokenBalances, 500);
      refreshTokenBalances(); // Вызываем сразу, если нужно обновить при смене auth
    } else {
      // Очищаем баланс при выходе
      tokenBalances.value = {};
    }
  });
  
  // --- Возвращаем и улучшаем функцию-обработчик --- 
  const handleAuthActionCompleted = async () => {
    console.log('[App] Auth action completed, triggering updates...');
    isLoading.value = true; // Показываем индикатор загрузки
    try {
      // 1. Проверяем аутентификацию (обновит identities и isAuthenticated)
      await auth.checkAuth();
      console.log('[App] auth.checkAuth() completed. isAuthenticated:', auth.isAuthenticated.value);
      
      // 2. Обновляем баланс (использует обновленные identities)
      await refreshTokenBalances();
      console.log('[App] refreshTokenBalances() completed.');

      // 3. Явно оповещаем компоненты об изменении состояния авторизации
      // Передаем актуальное состояние из useAuth
      eventBus.emit('auth-state-changed', { 
          isAuthenticated: auth.isAuthenticated.value, 
          authType: auth.authType.value, // Предполагаем, что authType есть в useAuth
          userId: auth.userId.value, // Предполагаем, что userId есть в useAuth
          fromApp: true // Флаг, что событие от App.vue
      });
      console.log('[App] auth-state-changed event emitted.');

    } catch (error) {
        console.error("[App] Error during auth action handling:", error);
    } finally {
        isLoading.value = false; // Скрываем индикатор загрузки
    }
  };

  // Первичная загрузка баланса при монтировании, если пользователь уже авторизован
  onMounted(() => {
    if (auth.isAuthenticated.value) {
      refreshTokenBalances();
    }
    
    // Подписываемся на событие изменения настроек аутентификации
    const unsubscribe = eventBus.on('auth-settings-saved', () => {
      console.log('[App] Получено событие сохранения настроек аутентификации, обновляем балансы');
      if (auth.isAuthenticated.value) {
        refreshTokenBalances();
      }
    });
    
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
