<template>
  <div v-if="isAuthenticated">
    <div ref="threadContainer" class="message-thread">
      <div v-if="loading" class="loading">Загрузка сообщений...</div>

      <div v-else-if="messages.length === 0" class="empty-thread">
        <p>Нет сообщений. Начните диалог, отправив сообщение.</p>
      </div>

      <div v-else class="messages">
        <div
          v-for="message in messages"
          :key="message.id"
          :class="['message', message.sender_type]"
        >
          <div class="message-content">{{ message.content }}</div>
          <div class="message-meta">
            <span class="time">{{ formatTime(message.created_at) }}</span>
            <span v-if="message.channel" class="channel">
              {{ channelName(message.channel) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="connect-wallet-prompt">
    <p>Пожалуйста, подключите кошелек для просмотра сообщений</p>
  </div>
</template>

<script setup>
  import { ref, onMounted, watch, nextTick, defineExpose } from 'vue';
  import axios from 'axios';

  const props = defineProps({
    conversationId: {
      type: [Number, String],
      required: true,
    },
  });

  const messages = ref([]);
  const loading = ref(true);
  const threadContainer = ref(null);
  const isAuthenticated = ref(false);

  // Загрузка сообщений диалога
  const fetchMessages = async () => {
    try {
      loading.value = true;
      const response = await axios.get(
        `/api/messages/conversations/${props.conversationId}/messages`
      );
      messages.value = response.data;

      // Прокрутка к последнему сообщению
      await nextTick();
      scrollToBottom();
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      loading.value = false;
    }
  };

  // Добавление новых сообщений
  const addMessages = (newMessages) => {
    if (Array.isArray(newMessages)) {
      messages.value = [...messages.value, ...newMessages];
    } else {
      messages.value.push(newMessages);
    }

    // Прокрутка к последнему сообщению
    nextTick(() => {
      scrollToBottom();
    });
  };

  // Прокрутка к последнему сообщению
  const scrollToBottom = () => {
    if (threadContainer.value) {
      threadContainer.value.scrollTop = threadContainer.value.scrollHeight;
    }
  };

  // Форматирование времени
  const formatTime = (timestamp) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Получение названия канала
  const channelName = (channel) => {
    const channels = {
      web: 'Веб',
      telegram: 'Telegram',
      email: 'Email',
    };

    return channels[channel] || channel;
  };

  // Наблюдение за изменением ID диалога
  watch(
    () => props.conversationId,
    (newId, oldId) => {
      if (newId && newId !== oldId) {
        fetchMessages();
      }
    }
  );

  // Следим за изменением статуса аутентификации
  watch(
    () => isAuthenticated.value,
    (authenticated) => {
      if (!authenticated) {
        messages.value = []; // Очищаем сообщения при отключении
      }
    }
  );

  // Загрузка сообщений при монтировании компонента
  onMounted(() => {
    if (props.conversationId) {
      fetchMessages();
    }
  });

  // Экспорт методов для использования в родительском компоненте
  defineExpose({
    fetchMessages,
    addMessages,
  });
</script>
