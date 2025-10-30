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
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="home-management">
      <!-- Заголовок -->
      <div class="management-header">
        <div class="header-content">
          <h1>ИИ Ассистент</h1>
        </div>
      </div>

      <!-- Чат интерфейс -->
      <div class="chat-wrapper">
        <template v-if="auth.userAccessLevel.value && auth.userAccessLevel.value.hasAccess">
          <ChatInterface 
            :messages="messages" 
            :is-loading="isLoading || isConnectingWallet"
            :has-more-messages="messageLoading.hasMoreMessages"
            :currentUserId="auth.userId"
            v-model:newMessage="newMessage"
            v-model:attachments="attachments"
            @send-message="handleSendMessage"
            @load-more="loadMessages"
          />
        </template>
        <template v-else>
          <ChatInterface 
            :messages="messages" 
            :is-loading="isLoading || isConnectingWallet"
            :has-more-messages="messageLoading.hasMoreMessages"
            :currentUserId="auth.userId"
            v-model:newMessage="newMessage"
            v-model:attachments="attachments"
            @send-message="handleSendMessage"
            @load-more="loadMessages"
          />
        </template>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
  import { ref, onMounted, watch, onBeforeUnmount, defineProps, defineEmits } from 'vue';
  import { useAuthContext } from '../composables/useAuth';
  import { useChat } from '../composables/useChat';
  import { connectWithWallet } from '../services/wallet';
  import eventBus from '../utils/eventBus';
  import BaseLayout from '../components/BaseLayout.vue';
  import ChatInterface from '../components/ChatInterface.vue';

  // console.log('HomeView.vue: Using BaseLayout');

  // Определяем props, переданные из App.vue через RouterView
  const props = defineProps({
    isAuthenticated: Boolean,
    identities: Array,
    tokenBalances: Object,
    isLoadingTokens: Boolean
  });

  // Определяем emits
  const emit = defineEmits(['auth-action-completed']);

  // =====================================================================
  // 1. ИСПОЛЬЗОВАНИЕ COMPOSABLES
  // =====================================================================

  const auth = useAuthContext();

  // =====================================================================
  // 2. СОСТОЯНИЯ КОМПОНЕНТА
  // =====================================================================

  const isConnectingWallet = ref(false); // Флаг для процесса подключения кошелька

  // =====================================================================
  // 3. ИСПОЛЬЗОВАНИЕ ЧАТА
  // =====================================================================

  const {
    messages,
    newMessage,
    attachments,
    isLoading,
    messageLoading,
    loadMessages,
    handleSendMessage,
    linkGuestMessagesAfterAuth,
  } = useChat(auth);

  // =====================================================================
  // 4. ЖИЗНЕННЫЙ ЦИКЛ
  // =====================================================================

  let unsubscribe = null;

  onMounted(() => {
    // console.log('[HomeView] Компонент загружен (обновленная версия)');
    
    // Подписка на события авторизации
    unsubscribe = eventBus.on('auth-state-changed', handleAuthEvent);
    
    // Подписываемся на централизованные события очистки и обновления данных
    window.addEventListener('clear-application-data', () => {
      console.log('[HomeView] Clearing chat data');
      // Очищаем данные при выходе из системы
      messages.value = [];
    });
    
    window.addEventListener('refresh-application-data', () => {
      console.log('[HomeView] Refreshing chat data');
      loadMessages(); // Обновляем данные при входе в систему
    });
  });

  onBeforeUnmount(() => {
    // Отписка от события при удалении компонента
    if (unsubscribe) {
      unsubscribe();
    }
  });

  // =====================================================================
  // 5. ОБРАБОТКА СОБЫТИЙ АВТОРИЗАЦИИ
  // =====================================================================

  // Функция обновления сообщений после авторизации
  const handleAuthEvent = async (eventData) => {
    // console.log('[HomeView] Получено событие изменения авторизации:', eventData);
    if (eventData.isAuthenticated) {
      // Сначала связываем гостевые сообщения, если есть
      await linkGuestMessagesAfterAuth();
      // Затем загружаем сообщения (если не было гостя, просто загрузка)
      loadMessages({ initial: true, authType: eventData.authType || 'wallet' });
    } else {
      // Пользователь вышел из системы - можно очистить или обновить данные
      loadMessages({ initial: true });
    }
  };
</script>

<style scoped>
.home-management {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e9ecef;
  flex-shrink: 0;
}

.header-content h1 {
  margin: 0;
  color: var(--color-primary);
  font-size: 2rem;
  font-weight: 700;
}

.chat-wrapper {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Адаптивность */
@media (max-width: 768px) {
  .management-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .header-content h1 {
    font-size: 1.5rem;
  }
  
  .home-management {
    padding: 16px;
    height: calc(100vh - 32px);
  }
  
  .chat-wrapper {
    border-radius: 8px;
  }
}

@media (max-width: 480px) {
  .home-management {
    padding: 12px;
    height: calc(100vh - 24px);
  }
  
  .management-header {
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
  }
  
  .header-content h1 {
    font-size: 1.3rem;
  }
  
  .chat-wrapper {
    border-radius: 6px;
  }
}
</style>
