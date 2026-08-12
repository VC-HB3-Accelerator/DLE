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
  <div class="app-container" :class="{ 'app-container--document-scroll': documentScroll }">
    <!-- Основной контент -->
    <div
      class="main-content"
      :class="{
        'no-right-sidebar': !showWalletSidebar,
        'main-content--document-scroll': documentScroll,
      }"
    >
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
      :password-auth="passwordAuth"
      :token-balances="tokenBalances"
      :identities="identities"
      :is-loading-tokens="isLoadingTokens"
      @wallet-auth="handleWalletAuth"
      @disconnect-wallet="disconnectWallet"
      @telegram-auth="handleTelegramAuth"
      @cancel-telegram-auth="cancelTelegramAuth"
      @confirm-telegram-deeplink="confirmTelegramDeeplink"
      @email-auth="showEmailForm"
      @send-email-verification="sendEmailVerification"
      @verify-email-code="verifyEmailCode"
      @cancel-email-auth="cancelEmailAuth"
      @password-auth="showPasswordStub"
      @cancel-password-auth="cancelPasswordAuth"
    />

    <!-- Компонент для отображения уведомлений -->
    <NotificationDisplay :notifications="notifications.value" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, defineProps, defineEmits, provide, computed } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const auth = useAuthContext();
const { notifications, showSuccessMessage, showErrorMessage } = useNotifications();

// Используем useTokenBalancesWebSocket для получения актуального состояния загрузки
const { isLoadingTokens: wsIsLoadingTokens } = useTokenBalancesWebSocket();

// Определяем props, которые будут приходить от родительского View (оставляем для совместимости)
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean,
  /**
   * Document-scroll: окно крутит страницу вместо внутренней колонки .main-content.
   * Включается страницами вроде /blog. На mobile (≤768) оболочка без изменений —
   * там полоса обычно скрыта, а fixed-сайдбар остаётся в прежней модели.
   */
  documentScroll: { type: Boolean, default: false },
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
  confirmTelegramDeeplink,
  cancelTelegramAuth,
  emailAuth,
  showEmailForm,
  sendEmailVerification,
  verifyEmailCode,
  cancelEmailAuth,
  passwordAuth,
  showPasswordStub,
  cancelPasswordAuth,
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
          showSuccessMessage(t('auth.walletConnected'));
          emit('auth-action-completed');
        } else {
          showErrorMessage(linkResult.error || t('auth.walletConnectFailed'));
        }
      } else {
        const authResponse = await auth.checkAuth();
        if (authResponse.authenticated && authResponse.authType === 'wallet') {
          showSuccessMessage(t('auth.walletAuthSuccess'));
          emit('auth-action-completed');
        } else {
           showErrorMessage(t('auth.walletAuthFailed'));
        }
      }
    } else {
      showErrorMessage(result.error || t('auth.walletConnectError'));
    }
  } catch (error) {
    let errorMessage = t('auth.walletGenericError');

    if (error.message && error.message.includes('MetaMask extension not found')) {
      errorMessage = t('auth.metamaskNotFound');
    } else if (error.message && error.message.includes('Failed to connect to MetaMask')) {
      errorMessage = t('auth.metamaskConnectFailed');
    } else if (error.message && error.message.includes('Invalid nonce')) {
      errorMessage = t('auth.invalidNonce');
    } else if (error.message && error.message.includes('Nonce expired')) {
      errorMessage = t('auth.nonceExpired');
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
      showSuccessMessage(t('auth.logoutSuccess'));
      emit('auth-action-completed');
    } else {
      showErrorMessage(result.error || t('auth.logoutError'));
    }
  } catch (error) {
    showErrorMessage(t('auth.logoutError'));
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

// =====================================================================
// 4. ЖИЗНЕННЫЙ ЦИКЛ
// =====================================================================

let unsubscribeOpenAuth = null;
let unsubscribeWalletAuth = null;

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

  unsubscribeOpenAuth = eventBus.on('open-auth-sidebar', () => {
    showWalletSidebar.value = true;
    setToStorage('showWalletSidebar', true);
  });

  unsubscribeWalletAuth = eventBus.on('request-wallet-auth', () => {
    showWalletSidebar.value = true;
    setToStorage('showWalletSidebar', true);
    handleWalletAuth();
  });
});

onBeforeUnmount(() => {
  unsubscribeOpenAuth?.();
  unsubscribeWalletAuth?.();
  unsubscribeOpenAuth = null;
  unsubscribeWalletAuth = null;
});
</script>

<style scoped>
/*
 * Живая оболочка приложения (TZ §0.3 / §3.1).
 * Контракт: этот scoped + Header/Sidebar — источник правды для shell.
 * layout.css — только legacy/fallback (.app-layout, .main-view); global.css — примитивы страниц.
 * bp: 1199 / 768 / 480 — литералы из контракта.
 */
.app-container {
  display: flex;
  height: 100vh;
  max-width: 100%;
  position: relative;
  background-color: var(--theme-surface);
  overflow: hidden;
}

/*
 * Sidebar position:fixed — резервируем ширину через max-width,
 * иначе контент уедет под панель (C2). Ширины = --sidebar-panel-*.
 */
.main-content {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  transition: all var(--transition-normal);
  display: flex;
  flex-direction: column;
  padding: 0 var(--spacing-lg) var(--spacing-lg);
  background-color: var(--theme-bg);
  min-height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

/*
 * Flex-колонка: у детей min-width:auto по умолчанию — длинный nowrap/minmax
 * раздувает страницу шире экрана и обрезается справа (iPhone/Samsung).
 */
.main-content > * {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

/* Сайдбар fixed — резерв ширины только на десктопе/планшете */
@media (min-width: 769px) {
  .main-content:not(.no-right-sidebar) {
    max-width: calc(100% - var(--sidebar-panel-width-narrow));
  }
}

@media (min-width: 1200px) {
  .main-content:not(.no-right-sidebar) {
    max-width: calc(100% - var(--sidebar-panel-width));
  }
}

@media (max-width: 768px) {
  .main-content {
    padding-left: var(--spacing-sm);
    padding-right: var(--spacing-sm);
    padding-bottom: var(--spacing-sm);
    overflow-x: hidden;
    /* стабильная ширина при появлении/исчезновении вертикального скролла */
    scrollbar-gutter: stable;
  }
}

@media (max-width: 480px) {
  .main-content {
    padding-left: var(--spacing-xs);
    padding-right: var(--spacing-xs);
    padding-bottom: var(--spacing-xs);
  }
}

/*
 * Document-scroll (только ≥769px): рост оболочки с контентом, скролл у окна.
 * Mobile ≤768 — прежний overflow-y:auto у .main-content.
 */
@media (min-width: 769px) {
  .app-container.app-container--document-scroll {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }

  .main-content.main-content--document-scroll {
    overflow-y: visible;
    overflow-x: hidden;
  }
}


</style> 