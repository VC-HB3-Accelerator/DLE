<template>
  <div v-if="isAuthenticated">
    <div class="conversation-list">
      <div class="list-header">
        <h3>Диалоги</h3>
        <button class="new-conversation-btn" @click="createNewConversation">
          <span>+</span> Новый диалог
        </button>
      </div>

      <div v-if="loading" class="loading">Загрузка диалогов...</div>

      <div v-else-if="conversations.length === 0" class="empty-list">
        <p>У вас пока нет диалогов.</p>
        <p>Создайте новый диалог, чтобы начать общение с ИИ-ассистентом.</p>
      </div>

      <div v-else class="conversations">
        <div
          v-for="conversation in conversations"
          :key="conversation.conversation_id"
          :class="[
            'conversation-item',
            { active: selectedConversationId === conversation.conversation_id },
          ]"
          @click="selectConversation(conversation.conversation_id)"
        >
          <div class="conversation-title">{{ conversation.title }}</div>
          <div class="conversation-meta">
            <span class="message-count">{{ conversation.message_count }} сообщений</span>
            <span class="time">{{ formatTime(conversation.last_activity) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="connect-wallet-prompt">
    <p>Подключите кошелек для просмотра бесед</p>
  </div>
</template>

<script setup>
  import { ref, onMounted, computed, defineEmits, watch, inject } from 'vue';
  import axios from 'axios';

  const emit = defineEmits(['select-conversation']);
  const auth = inject('auth');
  const isAuthenticated = computed(() => auth.isAuthenticated.value);

  const conversations = ref([]);
  const loading = ref(true);
  const selectedConversationId = ref(null);

  // Следим за изменением статуса аутентификации
  watch(
    () => isAuthenticated.value,
    (authenticated) => {
      if (!authenticated) {
        conversations.value = []; // Очищаем список бесед при отключении
        selectedConversationId.value = null;
      }
    }
  );

  // Загрузка списка диалогов
  const fetchConversations = async () => {
    try {
      loading.value = true;
      const response = await axios.get('/api/messages/conversations');
      conversations.value = response.data;

      // Если есть диалоги и не выбран ни один, выбираем первый
      if (conversations.value.length > 0 && !selectedConversationId.value) {
        selectConversation(conversations.value[0].conversation_id);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      loading.value = false;
    }
  };

  // Выбор диалога
  const selectConversation = (conversationId) => {
    selectedConversationId.value = conversationId;
    emit('select-conversation', conversationId);
  };

  // Создание нового диалога
  const createNewConversation = async () => {
    try {
      const response = await axios.post('/api/messages/conversations', {
        title: 'Новый диалог',
      });

      // Добавляем новый диалог в список
      const newConversation = {
        conversation_id: response.data.id,
        title: response.data.title,
        username: authStore.username,
        address: authStore.address,
        message_count: 0,
        last_activity: response.data.created_at,
        created_at: response.data.created_at,
      };

      conversations.value.unshift(newConversation);

      // Выбираем новый диалог
      selectConversation(newConversation.conversation_id);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  // Форматирование времени
  const formatTime = (timestamp) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Сегодня - показываем только время
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      // Вчера
      return 'Вчера';
    } else if (diffDays < 7) {
      // В течение недели - показываем день недели
      const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      return days[date.getDay()];
    } else {
      // Более недели назад - показываем дату
      return date.toLocaleDateString();
    }
  };

  // Загрузка диалогов при монтировании компонента
  onMounted(() => {
    fetchConversations();
  });

  // Экспорт методов для использования в родительском компоненте
  defineExpose({
    fetchConversations,
  });
</script>
