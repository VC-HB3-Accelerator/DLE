<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <div class="app-container">
    <!-- Основной контент -->
    <div class="main-content" :class="{ 'no-right-sidebar': !showWalletSidebar }">
      <!-- Шапка сайта -->
      <Header 
        :is-sidebar-open="showWalletSidebar" 
        @toggle-sidebar="toggleWalletSidebar" 
      />

      <!-- Основной контент страницы (передается через слот) -->
      <slot></slot>
    </div>

    <!-- Правая панель с информацией о кошельке -->
    <Sidebar 
      v-model="showWalletSidebar" 
      :is-authenticated="isAuthenticated"
      :telegram-auth="telegramAuth"
      :email-auth="emailAuth"
      :token-balances="tokenBalances"
      :identities="identities"
      :is-loading-tokens="isLoadingTokens"
      @wallet-auth="handleWalletAuth"
      @disconnect-wallet="disconnectWallet"
      @telegram-auth="handleTelegramAuth"
      @cancel-telegram-auth="cancelTelegramAuth"
      @email-auth="showEmailForm"
      @send-email-verification="sendEmailVerification"
      @verify-email-code="verifyEmailCode"
      @cancel-email-auth="cancelEmailAuth"
    />

    <!-- Компонент для отображения уведомлений -->
    <NotificationDisplay :notifications="notifications.value" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, defineProps, defineEmits, provide, computed } from 'vue';
import { useAuthContext } from '../composables/useAuth';
import { useAuthFlow } from '../composables/useAuthFlow';
import { useNotifications } from '../composables/useNotifications';
import { useTokenBalancesWebSocket } from '../composables/useTokenBalancesWebSocket';
import { getFromStorage, setToStorage, removeFromStorage } from '../utils/storage';
import { connectWithWallet } from '../services/wallet';
import api from '../api/axios';
import eventBus from '../utils/eventBus';
import Header from './Header.vue';
import Sidebar from './Sidebar.vue';
import NotificationDisplay from './NotificationDisplay.vue';

// =====================================================================
// 1. ИСПОЛЬЗОВАНИЕ COMPOSABLES
// =====================================================================

const auth = useAuthContext();
const { notifications, showSuccessMessage, showErrorMessage } = useNotifications();

// Используем useTokenBalancesWebSocket для получения актуального состояния загрузки
const { isLoadingTokens: wsIsLoadingTokens } = useTokenBalancesWebSocket();

// Определяем props, которые будут приходить от родительского View (оставляем для совместимости)
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

// Используем useAuth напрямую для получения актуальных данных
const isAuthenticated = computed(() => auth.isAuthenticated.value);
const identities = computed(() => auth.identities.value);
const tokenBalances = computed(() => auth.tokenBalances.value);
const isLoadingTokens = computed(() => {
  // Приоритет: WebSocket состояние > пропс > false
  return wsIsLoadingTokens.value || (props.isLoadingTokens !== undefined ? props.isLoadingTokens : false);
});

// Предоставляем данные дочерним компонентам через provide/inject
provide('isAuthenticated', isAuthenticated);
provide('identities', identities);
provide('tokenBalances', tokenBalances);
provide('isLoadingTokens', isLoadingTokens);

// Отладочная информация
console.log('[BaseLayout] Auth state:', {
  isAuthenticated: isAuthenticated.value,
  tokenBalances: tokenBalances.value,
  isLoadingTokens: isLoadingTokens.value
});

// Callback после успешной аутентификации/привязки через Email/Telegram
const handleAuthFlowSuccess = (authType) => {
      // console.log(`[BaseLayout] Auth flow success: ${authType}`);
  // Отправляем событие для обновления данных на страницах
  eventBus.emit('auth-success', { authType });
};

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[BaseLayout] Clearing base layout data');
    // Очищаем данные при выходе из системы
    // BaseLayout не нуждается в очистке данных
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[BaseLayout] Refreshing base layout data');
    // BaseLayout не нуждается в обновлении данных
  });
});

const {
  telegramAuth,
  handleTelegramAuth,
  cancelTelegramAuth,
  emailAuth,
  showEmailForm,
  sendEmailVerification,
  verifyEmailCode,
  cancelEmailAuth,
} = useAuthFlow({ onAuthSuccess: handleAuthFlowSuccess });

// =====================================================================
// 2. СОСТОЯНИЯ КОМПОНЕНТА
// =====================================================================

const showWalletSidebar = ref(false);
const isConnectingWallet = ref(false); // Флаг процесса подключения кошелька

// =====================================================================
// 3. ФУНКЦИИ
// =====================================================================

/**
 * Обрабатывает аутентификацию через кошелек
 */
const handleWalletAuth = async () => {
  if (isConnectingWallet.value) return;
  isConnectingWallet.value = true;
  try {
    const result = await connectWithWallet();
    // console.log('[BaseLayout] Результат подключения кошелька:', result);

    if (result.success) {
      if (auth.isAuthenticated.value) {
        // Связывание кошелька с существующим аккаунтом
        const linkResult = await auth.linkIdentity('wallet', result.address);
        if (linkResult.success) {
          showSuccessMessage('Кошелек успешно подключен к вашему аккаунту!');
          emit('auth-action-completed');
        } else {
          showErrorMessage(linkResult.error || 'Не удалось подключить кошелек');
        }
      } else {
        // Новая аутентификация через кошелек
        const authResponse = await auth.checkAuth();
        if (authResponse.authenticated && authResponse.authType === 'wallet') {
          // console.log('[BaseLayout] Кошелёк успешно подключен и аутентифицирован');
          showSuccessMessage('Кошелёк успешно подключен!');
          emit('auth-action-completed');
        } else {
           showErrorMessage('Не удалось завершить аутентификацию через кошелек.');
        }
      }
    } else {
              // console.error('[BaseLayout] Не удалось подключить кошелёк:', result.error);
      showErrorMessage(result.error || 'Не удалось подключить кошелёк');
    }
  } catch (error) {
          // console.error('[BaseLayout] Ошибка при подключении кошелька:', error);
    
    // Улучшенная обработка ошибок MetaMask
    let errorMessage = 'Произошла ошибка при подключении кошелька';
    
    if (error.message && error.message.includes('MetaMask extension not found')) {
      errorMessage = 'Расширение MetaMask не найдено. Пожалуйста, установите MetaMask и обновите страницу.';
    } else if (error.message && error.message.includes('Failed to connect to MetaMask')) {
      errorMessage = 'Не удалось подключиться к MetaMask. Проверьте, что расширение установлено и активно.';
    } else if (error.message && error.message.includes('Браузерный кошелек не установлен')) {
      errorMessage = 'Браузерный кошелек не установлен. Пожалуйста, установите MetaMask.';
    } else if (error.message && error.message.includes('Не удалось получить nonce')) {
      errorMessage = 'Ошибка получения nonce. Попробуйте обновить страницу и повторить попытку.';
    } else if (error.message && error.message.includes('Invalid nonce')) {
      errorMessage = 'Ошибка аутентификации. Попробуйте обновить страницу и повторить попытку.';
    } else if (error.message && error.message.includes('Nonce expired')) {
      errorMessage = 'Время сессии истекло. Попробуйте обновить страницу и повторить попытку.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    showErrorMessage(errorMessage);
  } finally {
    isConnectingWallet.value = false;
  }
};

/**
 * Выполняет выход из аккаунта
 */
const disconnectWallet = async () => {
      // console.log('[BaseLayout] Выполняется выход из системы...');
  try {
    // Используем централизованную функцию disconnect из useAuth
    const result = await auth.disconnect();
    
    if (result.success) {
      showSuccessMessage('Вы успешно вышли из системы');
      emit('auth-action-completed');
    } else {
      showErrorMessage(result.error || 'Произошла ошибка при выходе из системы');
    }
  } catch (error) {
          // console.error('[BaseLayout] Ошибка при выходе из системы:', error);
    showErrorMessage('Произошла ошибка при выходе из системы');
  }
};

/**
 * Переключает отображение боковой панели
 */
const toggleWalletSidebar = () => {
  showWalletSidebar.value = !showWalletSidebar.value;
  setToStorage('showWalletSidebar', showWalletSidebar.value);
};

// =====================================================================
// 4. ЖИЗНЕННЫЙ ЦИКЛ
// =====================================================================

onMounted(() => {
  // console.log('[BaseLayout] Компонент загружен');

  // Загружаем сохраненное состояние боковой панели
  const savedSidebarState = getFromStorage('showWalletSidebar');
  if (savedSidebarState !== null) {
    showWalletSidebar.value = savedSidebarState;
  } else {
    showWalletSidebar.value = false; // по умолчанию закрыт
    setToStorage('showWalletSidebar', false);
  }
});
</script>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  position: relative;
  background-color: var(--color-light);
  overflow: hidden;
}

.main-content {
  flex-grow: 1;
  transition: all var(--transition-normal);
  display: flex;
  flex-direction: column;
  max-width: calc(100% - 350px);
  padding: 0 20px 20px 20px; /* Уменьшаем отступ снизу */
  background-color: var(--color-white);
  min-height: 100vh; /* Изменяем на min-height для возможности прокрутки */
  overflow-y: auto; /* Разрешаем вертикальную прокрутку */
  overflow-x: hidden;
}

.main-content.no-right-sidebar {
  max-width: 100%;
}

/* Адаптивный дизайн */
@media (max-width: 1199px) {
  .main-content {
    max-width: calc(100% - 320px);
  }
}

@media (max-width: 768px) {
  .main-content {
    max-width: 100%;
    padding-bottom: 10px; /* Уменьшаем отступ для мобильных устройств */
  }
  
  .main-content.no-right-sidebar {
    padding-bottom: 10px;
  }
}

@media (max-width: 480px) {
  .main-content {
    padding: 0 10px;
    padding-bottom: 5px; /* Минимальный отступ для очень маленьких экранов */
  }
  
  .main-content.no-right-sidebar {
    padding-bottom: 5px;
  }
}


</style> 