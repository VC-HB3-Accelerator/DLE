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
  <BaseLayout>
    <div class="personal-messages-header page-with-close">
      <PageCloseButton :fallback="{ name: 'crm' }" />
      <span>{{ t('chat.personalMessages') }}</span>
      <span v-if="newMessagesCount > 0" class="badge">+{{ newMessagesCount }}</span>
    </div>

    <div v-if="conferenceInvites.length" class="conference-invites">
      <div
        v-for="inv in conferenceInvites"
        :key="inv.id"
        class="conference-invite-card"
      >
        <div class="conference-invite-text">
          <strong>{{ t('contacts.conference.participant.inviteTitle') }}</strong>
          <span>{{ inv.title || t('contacts.conference.live.untitled') }} (#{{ inv.id }})</span>
        </div>
        <el-button
          type="primary"
          size="small"
          :loading="joiningId === inv.id"
          @click="openConferenceInvite(inv)"
        >
          {{ t('contacts.conference.participant.start') }}
        </el-button>
      </div>
    </div>
    
    <div v-if="isLoading" class="loading-container">
      <div class="loading">{{ t('chat.loadingConversations') }}</div>
    </div>
    
    <div v-else-if="personalMessages.length === 0 && !conferenceInvites.length" class="empty-state">
      <p>{{ t('chat.noConversations') }}</p>
    </div>
    
    <div v-else class="personal-messages-list">
      <div 
        v-for="message in personalMessages" 
        :key="message.id" 
        class="message-item"
      >
        <div class="message-info">
          <div class="admin-name">{{ message.name }}</div>
          <div class="message-preview">{{ message.last_message || t('chat.noMessages') }}</div>
          <div class="message-date">{{ formatDate(message.last_message_at) }}</div>
        </div>
        <el-button type="primary" size="small" @click="openPersonalChat(message)">
          {{ t('chat.open') }}
        </el-button>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import BaseLayout from '../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import { usePermissions } from '@/composables/usePermissions';
import { useAuthContext } from '@/composables/useAuth';
import { getPrivateConversations } from '../services/messagesService';
import conferenceService from '@/services/conferenceService';
import websocketServiceModule from '@/services/websocketService';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { canChatWithAdmins } = usePermissions();
const { userId } = useAuthContext();
const { websocketService } = websocketServiceModule;

const isLoading = ref(true);
const personalMessages = ref([]);
const newMessagesCount = ref(0);
const conferenceInvites = ref([]);
const joiningId = ref(null);
let listReloadTimer = null;

function scheduleListReloadFromWs() {
  if (listReloadTimer) clearTimeout(listReloadTimer);
  listReloadTimer = setTimeout(() => {
    fetchPersonalMessages();
    loadConferenceInvites();
  }, 150);
}

async function loadConferenceInvites() {
  try {
    const data = await conferenceService.listMyInvites();
    conferenceInvites.value = data.invites || [];
  } catch {
    conferenceInvites.value = [];
  }
}

async function openConferenceInvite(inv) {
  joiningId.value = inv.id;
  try {
    // «Старт» сразу в live (join), не только открытие чата с host
    const data = await conferenceService.joinSession(inv.id);
    await router.push({
      name: 'conference-participant-live',
      params: { sessionId: String(data.session.id) }
    });
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.participant.startError'));
  } finally {
    joiningId.value = null;
  }
}

async function fetchPersonalMessages() {
  try {
    isLoading.value = true;
    console.log('[PersonalMessagesView] Загружаем приватные чаты...');
    
    // Загружаем приватные чаты через новый API
    const response = await getPrivateConversations();
    console.log('[PersonalMessagesView] Загружено приватных чатов:', response.conversations?.length || 0);
    
    const conversations = response.success && response.conversations ? response.conversations : [];
    
    console.log('[PersonalMessagesView] Полученные conversations:', conversations);
    
    // Проверяем, что у нас есть данные
    if (!conversations || conversations.length === 0) {
      console.log('[PersonalMessagesView] Нет приватных чатов');
      personalMessages.value = [];
      newMessagesCount.value = 0;
      return;
    }
    
    // Формируем список бесед: имя = peer (Саша/Ваня), не «Приватный чат 12-13»
    personalMessages.value = conversations
      .filter((conv) => Number(conv.message_count) > 0 || Boolean(conv.last_message))
      .map((conv) => {
      const peerId = conv.peer_user_id || conv.user_id;
      console.log('[PersonalMessagesView] Обрабатываем conversation:', conv);
      return {
        id: conv.conversation_id,
        conversation_id: conv.conversation_id,
        user_id: peerId,
        peer_user_id: peerId,
        name: conv.peer_name || t('chat.chatWithUser', { id: peerId }),
        last_message: conv.last_message || t('chat.noMessages'),
        last_message_at: conv.last_message_at || conv.updated_at,
        message_count: conv.message_count || 0
      };
    });
    
    newMessagesCount.value = personalMessages.value.length;
    
    console.log('[PersonalMessagesView] Сформировано бесед:', personalMessages.value.length);
  } catch (error) {
    console.error('[PersonalMessagesView] Ошибка загрузки приватных чатов:', error);
    personalMessages.value = [];
  } finally {
    isLoading.value = false;
  }
}

function openPersonalChat(conversation) {
  console.log('[PersonalMessagesView] Открываем приватный чат:', conversation);
  
  const peerId = Number(conversation.peer_user_id || conversation.user_id);
  if (!Number.isInteger(peerId) || peerId <= 0) {
    console.error('[PersonalMessagesView] Ошибка: peer id не найден в conversation:', conversation);
    return;
  }
  
  console.log('[PersonalMessagesView] Переходим к чату с peerId:', peerId);
  router.push({ name: 'admin-chat', params: { adminId: peerId } });
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
    await Promise.all([fetchPersonalMessages(), loadConferenceInvites()]);
  }
});

onMounted(async () => {
  if (canChatWithAdmins.value) {
    if (userId.value) {
      websocketService.connect(userId.value);
    }
    websocketService.on('messages-updated', scheduleListReloadFromWs);
    websocketService.on('contacts-updated', scheduleListReloadFromWs);
    websocketService.on('conversation-updated', scheduleListReloadFromWs);
    await Promise.all([fetchPersonalMessages(), loadConferenceInvites()]);
  }
});

onUnmounted(() => {
  if (listReloadTimer) clearTimeout(listReloadTimer);
  websocketService.off('messages-updated', scheduleListReloadFromWs);
  websocketService.off('contacts-updated', scheduleListReloadFromWs);
  websocketService.off('conversation-updated', scheduleListReloadFromWs);
});
</script>

<style scoped>
.conference-invites {
  padding: 12px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.conference-invite-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  background: var(--color-primary-light);
}

.conference-invite-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.conference-invite-text span {
  font-size: 0.9rem;
  color: #606266;
}

.personal-messages-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  padding-right: calc(var(--spacing-md) + 2rem);
  background: transparent;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
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

@media (max-width: 768px) {
  .personal-messages-header {
    padding: 0.75rem;
    padding-right: calc(var(--spacing-md) + 2rem);
    font-size: 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .personal-messages-list {
    padding: 0.5rem;
  }
  
  .message-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    padding: 0.75rem;
  }
  
  .message-info {
    width: 100%;
  }
  
  .admin-name {
    font-size: 1rem;
  }
  
  .message-preview {
    font-size: 0.85rem;
  }
  
  .message-date {
    font-size: 0.75rem;
  }
}

@media (max-width: 480px) {
  .personal-messages-header {
    padding: 0.5rem;
    font-size: 0.9rem;
  }
  
  .message-item {
    padding: 0.5rem;
  }
  
  .admin-name {
    font-size: 0.95rem;
  }
  
  .empty-state {
    padding: 1.5rem 1rem;
    font-size: 0.9rem;
  }
}
</style>
