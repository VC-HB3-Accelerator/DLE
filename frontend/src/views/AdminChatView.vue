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
    <div class="admin-chat-header">
      <span>{{ t('chat.privateChat') }}</span>
      <button class="close-btn" @click="goBack">×</button>
    </div>

    <div v-if="conferenceId" class="conference-invite">
      <div class="conference-invite-text">
        <strong>{{ t('contacts.conference.participant.inviteTitle') }}</strong>
        <span>{{ t('contacts.conference.participant.inviteHint') }}</span>
      </div>
      <el-button type="primary" :loading="joining" @click="startConference">
        {{ t('contacts.conference.participant.start') }}
      </el-button>
    </div>
    
    <div v-if="isLoadingMessages" class="loading-container">
      <div class="loading">{{ t('chat.loadingMessages') }}</div>
    </div>
    
    <div v-else class="chat-container" :class="{ 'with-invite': conferenceId }">
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
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import BaseLayout from '../components/BaseLayout.vue';
import ChatInterface from '../components/ChatInterface.vue';
import { getPrivateMessages, sendPrivateMessage, getPrivateConversations, markPrivateMessagesAsRead } from '../services/messagesService.js';
import { useAuthContext } from '@/composables/useAuth';
import conferenceService from '@/services/conferenceService';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { userId } = useAuthContext();

const adminId = computed(() => route.params.adminId);
const inviteConferenceId = ref(null);
const conferenceId = computed(() => {
  const n = Number(route.query.conference);
  if (Number.isInteger(n) && n > 0) return n;
  return inviteConferenceId.value;
});
const currentUserId = computed(() => userId.value);
const messages = ref([]);
const chatAttachments = ref([]);
const chatNewMessage = ref('');
const isLoadingMessages = ref(false);
const joining = ref(false);

async function loadInviteForHost() {
  if (route.query.conference) return;
  try {
    const data = await conferenceService.listMyInvites();
    const host = Number(adminId.value);
    const match = (data.invites || []).find((i) => Number(i.host_id) === host);
    inviteConferenceId.value = match?.id || null;
  } catch {
    inviteConferenceId.value = null;
  }
}

async function startConference() {
  if (!conferenceId.value) return;
  joining.value = true;
  try {
    const data = await conferenceService.joinSession(conferenceId.value);
    await router.push({
      name: 'conference-participant-live',
      params: { sessionId: String(data.session.id) }
    });
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.conference.participant.startError'));
  } finally {
    joining.value = false;
  }
}

async function loadMessages() {
  if (!adminId.value) return;
  
  try {
    isLoadingMessages.value = true;
    const conversationsResponse = await getPrivateConversations();
    const conversation = conversationsResponse.conversations?.find(conv => 
      conv.user_id == adminId.value
    );
    
    if (conversation) {
      const messagesResponse = await getPrivateMessages(conversation.conversation_id);
      messages.value = messagesResponse?.messages || [];
      try {
        await markPrivateMessagesAsRead(conversation.conversation_id);
      } catch (error) {
        console.error('[AdminChatView] Ошибка отметки сообщений как прочитанных:', error);
      }
    } else {
      messages.value = [];
    }
  } catch (error) {
    console.error('[AdminChatView] Ошибка загрузки сообщений:', error);
    messages.value = [];
  } finally {
    isLoadingMessages.value = false;
  }
}

async function handleSendMessage({ message }) {
  if (!message.trim() || !adminId.value) return;
  
  try {
    await sendPrivateMessage({
      recipientId: parseInt(adminId.value),
      content: message
    });
    chatNewMessage.value = '';
    chatAttachments.value = [];
    await loadMessages();
  } catch (error) {
    console.error('[AdminChatView] Ошибка отправки сообщения:', error);
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: 'personal-messages' });
  }
}

onMounted(async () => {
  await loadInviteForHost();
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

.conference-invite {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-primary-light, #ecf5ff);
  border-bottom: 1px solid var(--color-border, #dcdfe6);
}

.conference-invite-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.conference-invite-text span {
  color: var(--color-grey, #606266);
  font-size: 0.9rem;
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
  padding: 2rem;
  text-align: center;
}

.chat-container {
  height: calc(100dvh - 120px);
  display: flex;
  flex-direction: column;
}

.chat-container.with-invite {
  height: calc(100dvh - 190px);
}

.loading {
  color: #888;
  font-size: 1.1rem;
}

:deep(.chat-messages) {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

:deep(.chat-input) {
  padding: 1rem;
  background: #f9f9f9;
}

@media (max-width: 768px) {
  .admin-chat-header {
    padding: 0.75rem;
    font-size: 1rem;
  }
  
  .chat-container {
    height: calc(100dvh - 100px);
  }

  .chat-container.with-invite {
    height: calc(100dvh - 180px);
  }
}
</style>
