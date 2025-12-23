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
  <BaseLayout>
    <div class="admin-chat-header">
      <span>Приватный чат</span>
      <button class="close-btn" @click="goBack">×</button>
    </div>
    
    <div v-if="isLoadingMessages" class="loading-container">
      <div class="loading">Загрузка сообщений...</div>
    </div>
    
    <div v-else class="chat-container">
      <ChatInterface
        :messages="messages"
        :attachments="chatAttachments"
        :newMessage="chatNewMessage"
        :isLoading="isLoadingMessages"
        :canSend="true"
        :canGenerateAI="false"
        :canSelectMessages="false"
        :isPrivateChat="true"
        :currentUserId="currentUserId"
        @send-message="handleSendMessage"
        @update:newMessage="val => chatNewMessage = val"
        @update:attachments="val => chatAttachments = val"
        @load-more="loadMessages"
      />
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../components/BaseLayout.vue';
import ChatInterface from '../components/ChatInterface.vue';
import { getPrivateMessages, sendPrivateMessage, getPrivateConversations, markPrivateMessagesAsRead } from '../services/messagesService.js';
import { useAuthContext } from '@/composables/useAuth';

const route = useRoute();
const router = useRouter();
const { userId } = useAuthContext();

const adminId = computed(() => route.params.adminId);
const currentUserId = computed(() => userId.value);
const messages = ref([]);
const chatAttachments = ref([]);
const chatNewMessage = ref('');
const isLoadingMessages = ref(false);

async function loadMessages() {
  if (!adminId.value) return;
  
  try {
    isLoadingMessages.value = true;
    console.log('[AdminChatView] Загружаем приватные сообщения для админа:', adminId.value);
    
    // Получаем приватные чаты пользователя
    const conversationsResponse = await getPrivateConversations();
    console.log('[AdminChatView] Приватные чаты:', conversationsResponse);
    
    // Находим чат с нужным админом
    const conversation = conversationsResponse.conversations?.find(conv => 
      conv.user_id == adminId.value
    );
    
    if (conversation) {
      // Загружаем историю чата
      const messagesResponse = await getPrivateMessages(conversation.conversation_id);
      console.log('[AdminChatView] История чата:', messagesResponse);
      
      messages.value = messagesResponse?.messages || [];
      
      // Отмечаем сообщения как прочитанные
      try {
        await markPrivateMessagesAsRead(conversation.conversation_id);
        console.log('[AdminChatView] Сообщения отмечены как прочитанные');
      } catch (error) {
        console.error('[AdminChatView] Ошибка отметки сообщений как прочитанных:', error);
      }
    } else {
      messages.value = [];
    }
    
    console.log('[AdminChatView] Загружено сообщений:', messages.value.length);
  } catch (error) {
    console.error('[AdminChatView] Ошибка загрузки сообщений:', error);
    messages.value = [];
  } finally {
    isLoadingMessages.value = false;
  }
}

async function handleSendMessage({ message, attachments }) {
  if (!message.trim() || !adminId.value) return;
  
  try {
    console.log('[AdminChatView] Отправляем приватное сообщение:', message, 'админу:', adminId.value);
    
    await sendPrivateMessage({
      recipientId: parseInt(adminId.value),
      content: message
    });
    
    // Очищаем поле ввода
    chatNewMessage.value = '';
    chatAttachments.value = [];
    
    // Перезагружаем сообщения
    await loadMessages();
    
    console.log('[AdminChatView] Сообщение отправлено успешно');
  } catch (error) {
    console.error('[AdminChatView] Ошибка отправки сообщения:', error);
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: 'crm' });
  }
}

onMounted(() => {
  loadMessages();
});
</script>

<style scoped>
.admin-chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  font-size: 1.2rem;
  font-weight: bold;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #e0e0e0;
}

.loading-container {
  height: 200px;
  position: relative;
}

.chat-container {
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
}

.loading-container {
  padding: 2rem;
  text-align: center;
}

.loading {
  color: #888;
  font-size: 1.1rem;
}

/* Стили для ChatInterface */
:deep(.chat-messages) {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

:deep(.chat-input) {
  border-top: 1px solid #ddd;
  padding: 1rem;
  background: #f9f9f9;
}

@media (max-width: 768px) {
  .admin-chat-header {
    padding: 0.75rem;
    font-size: 1rem;
  }
  
  .close-btn {
    font-size: 1.25rem;
    padding: 0.2rem 0.4rem;
  }
  
  .chat-container {
    height: calc(100vh - 100px);
  }
  
  :deep(.chat-messages) {
    padding: 0.75rem;
  }
  
  :deep(.chat-input) {
    padding: 0.75rem;
  }
  
  .loading-container {
    padding: 1.5rem;
  }
  
  .loading {
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  .admin-chat-header {
    padding: 0.5rem;
    font-size: 0.9rem;
  }
  
  .chat-container {
    height: calc(100vh - 80px);
  }
  
  :deep(.chat-messages) {
    padding: 0.5rem;
  }
  
  :deep(.chat-input) {
    padding: 0.5rem;
  }
}
</style>
