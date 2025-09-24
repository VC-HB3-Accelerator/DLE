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
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <template v-if="auth.userAccessLevel.value && auth.userAccessLevel.value.hasAccess">
      <ChatInterface 
        :messages="messages" 
        :is-loading="isLoading || isConnectingWallet"
        :has-more-messages="messageLoading.hasMoreMessages"
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
      v-model:newMessage="newMessage"
      v-model:attachments="attachments"
      @send-message="handleSendMessage"
      @load-more="loadMessages"
    />
    </template>
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
