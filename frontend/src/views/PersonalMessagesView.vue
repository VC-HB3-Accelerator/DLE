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
  <BaseLayout>
    <div class="personal-messages-header">
      <span>Личные сообщения</span>
      <span v-if="newMessagesCount > 0" class="badge">+{{ newMessagesCount }}</span>
      <button class="close-btn" @click="goBack">×</button>
    </div>
    
    <div v-if="isLoading" class="loading-container">
      <div class="loading">Загрузка бесед...</div>
    </div>
    
    <div v-else-if="personalMessages.length === 0" class="empty-state">
      <p>У вас пока нет личных бесед с другими администраторами</p>
    </div>
    
    <div v-else class="personal-messages-list">
      <div 
        v-for="message in personalMessages" 
        :key="message.id" 
        class="message-item"
      >
        <div class="message-info">
          <div class="admin-name">{{ message.name }}</div>
          <div class="message-preview">{{ message.last_message || 'Нет сообщений' }}</div>
          <div class="message-date">{{ formatDate(message.last_message_at) }}</div>
        </div>
        <el-button type="primary" size="small" @click="openPersonalChat(message.id)">
          Открыть
        </el-button>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../components/BaseLayout.vue';
import adminChatService from '../services/adminChatService.js';
import { usePermissions } from '@/composables/usePermissions';
import { getPrivateMessages } from '../services/messagesService';

const router = useRouter();
const route = useRoute();
const { canChatWithAdmins } = usePermissions();

const isLoading = ref(true);
const personalMessages = ref([]);
const newMessagesCount = ref(0);

let ws = null;

async function fetchPersonalMessages() {
  try {
    isLoading.value = true;
    console.log('[PersonalMessagesView] Загружаем приватные сообщения...');
    
    // Загружаем приватные сообщения через новый API с пагинацией
    const response = await getPrivateMessages({ limit: 100, offset: 0 });
    console.log('[PersonalMessagesView] Загружено приватных сообщений:', response.messages?.length || 0);
    
    const privateMessages = response.success && response.messages ? response.messages : [];
    
    // Группируем сообщения по отправителям для отображения списка бесед
    const messageGroups = {};
    privateMessages.forEach(msg => {
      const senderId = msg.sender_id || 'unknown';
      if (!messageGroups[senderId]) {
        messageGroups[senderId] = {
          id: senderId,
          name: `Админ ${senderId}`,
          last_message: msg.content,
          last_message_at: msg.created_at,
          messages: []
        };
      }
      messageGroups[senderId].messages.push(msg);
      // Обновляем последнее сообщение
      if (new Date(msg.created_at) > new Date(messageGroups[senderId].last_message_at)) {
        messageGroups[senderId].last_message = msg.content;
        messageGroups[senderId].last_message_at = msg.created_at;
      }
    });
    
    personalMessages.value = Object.values(messageGroups);
    newMessagesCount.value = personalMessages.value.length;
    
    console.log('[PersonalMessagesView] Сформировано бесед:', personalMessages.value.length);
  } catch (error) {
    console.error('[PersonalMessagesView] Ошибка загрузки приватных сообщений:', error);
    personalMessages.value = [];
  } finally {
    isLoading.value = false;
  }
}

function connectWebSocket() {
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[PersonalMessagesView] WebSocket подключен');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'contacts-updated' || 
            data.type === 'messages-updated' ||
            data.type === 'contact-updated' ||
            data.type === 'admin-status-changed') {
          console.log('[PersonalMessagesView] Получено обновление через WebSocket:', data.type);
          fetchPersonalMessages();
        }
      } catch (error) {
        console.error('[PersonalMessagesView] Ошибка парсинга WebSocket сообщения:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[PersonalMessagesView] Ошибка WebSocket:', error);
    };

    ws.onclose = () => {
      console.log('[PersonalMessagesView] WebSocket отключен, переподключаемся через 3 секунды');
      setTimeout(() => {
        if (ws?.readyState === WebSocket.CLOSED) {
          connectWebSocket();
        }
      }, 3000);
    };
  } catch (error) {
    console.error('[PersonalMessagesView] Ошибка подключения WebSocket:', error);
  }
}

function disconnectWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
}

function openPersonalChat(adminId) {
  console.log('[PersonalMessagesView] Открываем приватный чат с админом:', adminId);
  router.push({ name: 'admin-chat', params: { adminId } });
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: 'crm' });
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString();
};

// Следим за изменениями роута для обновления при возврате на страницу
watch(() => route.path, async (newPath) => {
  if (newPath === '/personal-messages' && canChatWithAdmins.value) {
    console.log('[PersonalMessagesView] Возврат на страницу, обновляем список');
    await fetchPersonalMessages();
  }
});

onMounted(async () => {
  if (canChatWithAdmins.value) {
    await fetchPersonalMessages();
    connectWebSocket();
  }
});

onUnmounted(() => {
  disconnectWebSocket();
});
</script>

<style scoped>
.personal-messages-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  font-size: 1.2rem;
  font-weight: bold;
}

.badge {
  background: #ff4757;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
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

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #666;
}

.personal-messages-list {
  padding: 1rem;
}

.message-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  background: white;
  transition: box-shadow 0.2s;
}

.message-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.message-info {
  flex: 1;
}

.admin-name {
  font-weight: bold;
  font-size: 1.1rem;
  margin-bottom: 0.25rem;
}

.message-preview {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.message-date {
  color: #999;
  font-size: 0.8rem;
}

/* Стили для загрузки */
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  min-height: 200px;
}

.loading {
  color: #666;
  font-size: 1rem;
  text-align: center;
}
</style>
