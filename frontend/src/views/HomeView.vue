<template>
  <div class="app-container">
    <!-- Основной контент -->
    <div class="main-content" :class="{ 'no-right-sidebar': !showWalletSidebar }">
      <div class="header">
        <div class="header-content">
          <div class="header-text">
            <h1 class="title">✌️HB3 - Accelerator DLE</h1>
            <p class="subtitle">Венчурный фонд и поставщик программного обеспечения</p>
          </div>
          <button
            class="header-wallet-btn"
            :class="{ active: showWalletSidebar }"
            @click="toggleWalletSidebar"
          >
            <div class="hamburger-line" />
            <div class="nav-btn-text">
              {{ showWalletSidebar ? 'Скрыть панель' : 'Подключиться' }}
            </div>
          </button>
        </div>
      </div>

      <ChatInterface 
        :messages="messages" 
        :is-loading="isLoading || isConnectingWallet"
        :has-more-messages="messageLoading.hasMoreMessages"
        v-model:newMessage="newMessage"
        v-model:attachments="attachments"
        @send-message="handleSendMessage"
        @load-more="loadMessages"
      />

            </div>

    <!-- Правая панель с информацией о кошельке -->
    <Sidebar 
      v-model="showWalletSidebar" 
      :is-authenticated="auth.isAuthenticated.value"
      :telegram-auth="telegramAuth"
      :email-auth="emailAuth"
      :token-balances="tokenBalances.value"
      :identities="auth.identities?.value"
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
  import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
  import { useAuth } from '../composables/useAuth';
  import { useChat } from '../composables/useChat';
  import { useTokenBalances } from '../composables/useTokenBalances';
  import { useAuthFlow } from '../composables/useAuthFlow';
  import { useNotifications } from '../composables/useNotifications';
  import { getFromStorage, setToStorage, removeFromStorage } from '../utils/storage';
  import { connectWithWallet } from '../services/wallet';
  import api from '../api/axios';
  import '../assets/styles/home.css';
  import Sidebar from '../components/Sidebar.vue';
  import ChatInterface from '../components/ChatInterface.vue';
  import NotificationDisplay from '../components/NotificationDisplay.vue';

  console.log('HomeView.vue: Refactored version');

  // =====================================================================
  // 1. ИСПОЛЬЗОВАНИЕ COMPOSABLES
  // =====================================================================

  const auth = useAuth();
  const { notifications, showSuccessMessage, showErrorMessage } = useNotifications();
  const { tokenBalances } = useTokenBalances();

  // Callback после успешной аутентификации/привязки через Email/Telegram
  const handleAuthFlowSuccess = (authType) => {
    console.log(`[HomeView] Auth flow success: ${authType}`);
    // Загружаем сообщения после успешной аутентификации/привязки
    // useChat должен сам обработать изменение auth.isAuthenticated, но можем вызвать явно для гарантии
    loadMessages({ initial: true, authType });
    // useTokenBalances сам следит за auth состоянием для обновления балансов
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

  const {
    messages,
    newMessage,
    attachments,
    isLoading, // Переименовано из isLoadingChat
    messageLoading,
    loadMessages,
    handleSendMessage,
  } = useChat(auth);

  // =====================================================================
  // 2. СОСТОЯНИЯ КОМПОНЕНТА (Оставшиеся)
  // =====================================================================

  const showWalletSidebar = ref(false);
  const isConnectingWallet = ref(false); // Отдельный флаг для процесса подключения кошелька

  // =====================================================================
  // 3. ФУНКЦИИ (Оставшиеся или обертки для composables)
  // =====================================================================

  /**
   * Обрабатывает аутентификацию через кошелек
   */
  const handleWalletAuth = async () => {
    if (isConnectingWallet.value) return;
    isConnectingWallet.value = true;
    try {
      const result = await connectWithWallet();
      console.log('[HomeView] Результат подключения кошелька:', result);

      if (result.success) {
        if (auth.isAuthenticated.value) {
          // Связывание кошелька с существующим аккаунтом
          console.log('[HomeView] Связывание кошелька с существующим аккаунтом:', result.address);
          const linkResult = await auth.linkIdentity('wallet', result.address);
          if (linkResult.success) {
            showSuccessMessage('Кошелек успешно подключен к вашему аккаунту!');
            await auth.checkAuth(); // Обновить identities
            // useTokenBalances обновит балансы автоматически через watch
          } else {
            showErrorMessage(linkResult.error || 'Не удалось подключить кошелек');
          }
        } else {
          // Новая аутентификация через кошелек
          const authResponse = await auth.checkAuth();
          if (authResponse.authenticated && authResponse.authType === 'wallet') {
            console.log('[HomeView] Кошелёк успешно подключен и аутентифицирован');
            showSuccessMessage('Кошелёк успешно подключен!');
            // Загрузка сообщений произойдет через watch в useChat
            // Обновление балансов произойдет через watch в useTokenBalances
            loadMessages({ initial: true, authType: 'wallet' }); // Принудительно перезагрузим историю
          } else {
             showErrorMessage('Не удалось завершить аутентификацию через кошелек.');
          }
        }
      } else {
        console.error('[HomeView] Не удалось подключить кошелёк:', result.error);
        showErrorMessage(result.error || 'Не удалось подключить кошелёк');
      }
    } catch (error) {
      console.error('[HomeView] Ошибка при подключении кошелька:', error);
      showErrorMessage('Произошла ошибка при подключении кошелька');
    } finally {
      isConnectingWallet.value = false;
    }
  };

  /**
   * Выполняет выход из аккаунта
   */
  const disconnectWallet = async () => {
    console.log('[HomeView] Выполняется выход из системы...');
    try {
      // useTokenBalances остановит обновление балансов через watch
      await api.post('/api/auth/logout');
      // Вызываем checkAuth(), чтобы useAuth обновил состояние на основе ответа сервера (не аутентифицирован)
      await auth.checkAuth(); 
      showSuccessMessage('Вы успешно вышли из системы');
      // useChat сбросит сообщения через watch
      removeFromStorage('guestMessages'); // Доп. очистка
      removeFromStorage('hasUserSentMessage');
    } catch (error) {
      console.error('[HomeView] Ошибка при выходе из системы:', error);
      showErrorMessage('Произошла ошибка при выходе из системы');
      // Может потребоваться принудительная очистка состояния auth
      // await auth.checkAuth(); // Попробовать еще раз в catch, если необходимо
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
    console.log('[HomeView] Компонент загружен (refactored)');

    // Загружаем сохраненное состояние боковой панели
    const savedSidebarState = getFromStorage('showWalletSidebar');
    if (savedSidebarState !== null) {
      showWalletSidebar.value = savedSidebarState; // getFromStorage теперь парсит JSON
    } else {
      showWalletSidebar.value = true;
      setToStorage('showWalletSidebar', true);
    }

    // Начальная проверка аутентификации (useAuth делает это при инициализации)
    // Начальная загрузка сообщений (useChat делает это в onMounted)
    // Начальное обновление балансов (useTokenBalances делает это при инициализации/watch)

    // Пример добавления слушателя (если все еще нужен)
    // window.addEventListener('load-chat-history', () => loadMessages({ initial: true }));
  });

  onBeforeUnmount(() => {
    // Очистка интервалов происходит внутри composables (useTokenBalances, useAuthFlow)
    // window.removeEventListener('load-chat-history', () => loadMessages({ initial: true }));
  });

  // =====================================================================
  // 5. WATCHERS (Если нужны специфичные для View)
  // =====================================================================

  // Пример: показать панель гостю после первого сообщения
  watch(messages, (currentMessages, prevMessages) => {
    if (!auth.isAuthenticated.value && 
        currentMessages.length > (prevMessages?.length || 0) &&
        currentMessages[currentMessages.length - 1]?.sender_type === 'user' &&
        !showWalletSidebar.value) {
      console.log('[HomeView] Показываем панель гостю после первого сообщения.');
      toggleWalletSidebar();
    }
  }, { deep: false });
</script>
