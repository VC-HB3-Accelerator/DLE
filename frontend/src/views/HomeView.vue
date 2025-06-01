<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <ChatInterface 
      :messages="messages" 
      :is-loading="isLoading || isConnectingWallet"
      :has-more-messages="messageLoading.hasMoreMessages"
      v-model:newMessage="newMessage"
      v-model:attachments="attachments"
      @send-message="handleSendMessage"
      @load-more="loadMessages"
    />
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

  console.log('HomeView.vue: Using BaseLayout');

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
  } = useChat(auth);

  // =====================================================================
  // 4. ЖИЗНЕННЫЙ ЦИКЛ
  // =====================================================================

  let unsubscribe = null;

  onMounted(() => {
    console.log('[HomeView] Компонент загружен (обновленная версия)');
    
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
  const handleAuthEvent = (eventData) => {
    console.log('[HomeView] Получено событие изменения авторизации:', eventData);
    if (eventData.isAuthenticated) {
      // Пользователь только что авторизовался - загрузим сообщения
      loadMessages({ initial: true, authType: eventData.authType || 'wallet' });
    } else {
      // Пользователь вышел из системы - можно очистить или обновить данные
      loadMessages({ initial: true });
    }
  };
</script>
