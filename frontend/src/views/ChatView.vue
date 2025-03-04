<template>
  <div class="chat-container">
    <ConversationList @select-conversation="handleSelectConversation" ref="conversationList" />

    <div class="chat-main">
      <div v-if="!selectedConversationId" class="no-conversation">
        <p>Выберите диалог из списка или создайте новый, чтобы начать общение.</p>
      </div>

      <template v-else>
        <div class="chat-header">
          <h2>{{ currentConversationTitle }}</h2>
          <div class="chat-actions">
            <button @click="showRenameDialog = true" class="action-button">Переименовать</button>
            <button @click="confirmDelete" class="action-button delete">Удалить</button>
          </div>
        </div>

        <MessageThread :conversation-id="selectedConversationId" ref="messageThread" />

        <MessageInput
          :conversation-id="selectedConversationId"
          @message-sent="handleMessageSent"
          ref="messageInput"
        />
      </template>
    </div>

    <!-- Диалог переименования -->
    <div v-if="showRenameDialog" class="dialog-overlay">
      <div class="dialog">
        <h3>Переименовать диалог</h3>
        <input
          v-model="newTitle"
          placeholder="Введите новое название"
          @keydown.enter="renameConversation"
        />
        <div class="dialog-actions">
          <button @click="showRenameDialog = false" class="cancel-button">Отмена</button>
          <button @click="renameConversation" class="confirm-button">Сохранить</button>
        </div>
      </div>
    </div>

    <!-- Диалог подтверждения удаления -->
    <div v-if="showDeleteDialog" class="dialog-overlay">
      <div class="dialog">
        <h3>Удалить диалог?</h3>
        <p>Вы уверены, что хотите удалить этот диалог? Это действие нельзя отменить.</p>
        <div class="dialog-actions">
          <button @click="showDeleteDialog = false" class="cancel-button">Отмена</button>
          <button @click="deleteConversation" class="delete-button">Удалить</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import ConversationList from '../components/chat/ConversationList.vue';
import MessageThread from '../components/chat/MessageThread.vue';
import MessageInput from '../components/chat/MessageInput.vue';
import axios from 'axios';

const selectedConversationId = ref(null);
const currentConversationTitle = ref('');
const conversationList = ref(null);
const messageThread = ref(null);
const messageInput = ref(null);

// Диалоги
const showRenameDialog = ref(false);
const showDeleteDialog = ref(false);
const newTitle = ref('');

// Обработка выбора диалога
const handleSelectConversation = (conversationId) => {
  selectedConversationId.value = conversationId;

  // Получение заголовка диалога
  const conversation = conversationList.value.conversations.value.find(
    (c) => c.conversation_id === conversationId
  );

  if (conversation) {
    currentConversationTitle.value = conversation.title;
  }

  // Фокус на поле ввода после загрузки сообщений
  nextTick(() => {
    messageInput.value?.focus();
  });
};

// Обработка отправки сообщения
const handleMessageSent = (messages) => {
  messageThread.value.addMessages(messages);
};

// Переименование диалога
const renameConversation = async () => {
  if (!newTitle.value.trim()) return;

  try {
    const response = await axios.put(
      `/api/messages/conversations/${selectedConversationId.value}`,
      { title: newTitle.value }
    );

    // Обновление заголовка
    currentConversationTitle.value = response.data.title;

    // Обновление списка диалогов
    conversationList.value.fetchConversations();

    // Закрытие диалога
    showRenameDialog.value = false;
    newTitle.value = '';
  } catch (error) {
    console.error('Error renaming conversation:', error);
  }
};

// Подтверждение удаления
const confirmDelete = () => {
  showDeleteDialog.value = true;
};

// Удаление диалога
const deleteConversation = async () => {
  try {
    await axios.delete(`/api/messages/conversations/${selectedConversationId.value}`);

    // Обновление списка диалогов
    conversationList.value.fetchConversations();

    // Сброс выбранного диалога
    selectedConversationId.value = null;
    currentConversationTitle.value = '';

    // Закрытие диалога
    showDeleteDialog.value = false;
  } catch (error) {
    console.error('Error deleting conversation:', error);
  }
};
</script>

<style scoped>
.chat-container {
  display: flex;
  height: calc(100vh - 64px); /* Высота экрана минус высота шапки */
  position: relative;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #fff;
}

.no-conversation {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #666;
  padding: 2rem;
  text-align: center;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  background-color: #f9f9f9;
}

.chat-header h2 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 500;
}

.chat-actions {
  display: flex;
  gap: 0.5rem;
}

.action-button {
  padding: 0.5rem 0.75rem;
  background-color: #f0f0f0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.action-button:hover {
  background-color: #e0e0e0;
}

.action-button.delete {
  color: #f44336;
}

.action-button.delete:hover {
  background-color: #ffebee;
}

/* Стили для диалогов */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog {
  background-color: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dialog h3 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.dialog input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 1rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.cancel-button,
.confirm-button,
.delete-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.cancel-button {
  background-color: #f0f0f0;
}

.confirm-button {
  background-color: #4caf50;
  color: white;
}

.delete-button {
  background-color: #f44336;
  color: white;
}
</style>
