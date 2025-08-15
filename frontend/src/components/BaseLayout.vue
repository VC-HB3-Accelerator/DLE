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

// Определяем props, которые будут приходить от родительского View
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

// Предоставляем данные дочерним компонентам через provide/inject
provide('isAuthenticated', computed(() => props.isAuthenticated));
provide('identities', computed(() => props.identities));
provide('tokenBalances', computed(() => props.tokenBalances));
provide('isLoadingTokens', computed(() => props.isLoadingTokens));

// Отладочная информация
console.log('[BaseLayout] Props received:', {
  isAuthenticated: props.isAuthenticated,
  tokenBalances: props.tokenBalances,
  isLoadingTokens: props.isLoadingTokens
});

// Callback после успешной аутентификации/привязки через Email/Telegram
const handleAuthFlowSuccess = (authType) => {
      // console.log(`[BaseLayout] Auth flow success: ${authType}`);
  // Отправляем событие для обновления данных на страницах
  eventBus.emit('auth-success', { authType });
};

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
    await api.post('/auth/logout');
    showSuccessMessage('Вы успешно вышли из системы');
    removeFromStorage('guestMessages');
    removeFromStorage('hasUserSentMessage');
    emit('auth-action-completed');
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
  min-height: 100vh;
  position: relative;
  background-color: var(--color-light);
}

.main-content {
  flex-grow: 1;
  transition: all var(--transition-normal);
  display: flex;
  flex-direction: column;
  max-width: calc(100% - 350px);
  padding: 0 20px;
  background-color: var(--color-white);
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
    padding-bottom: 20px; /* Убираем большой отступ, так как панель теперь полноэкранная */
  }
  
  .main-content.no-right-sidebar {
    padding-bottom: 20px;
  }
}

@media (max-width: 480px) {
  .main-content {
    padding: 0 10px;
    padding-bottom: 10px; /* Убираем большой отступ */
  }
  
  .main-content.no-right-sidebar {
    padding-bottom: 10px;
  }
}


</style> 