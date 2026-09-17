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
    <div class="admin-chat-header page-with-close">
      <PageCloseButton :fallback="{ name: 'personal-messages' }" />
      <span>{{ chatTitle }}</span>
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
    
    <div v-else class="chat-panel" :class="{ 'with-invite': conferenceId }">
      <ChatInterface
        embedded
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
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import BaseLayout from '../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import ChatInterface from '../components/ChatInterface.vue';
import { getPrivateMessages, sendPrivateMessage, getPrivateConversations, markPrivateMessagesAsRead } from '../services/messagesService.js';
import { useAuthContext } from '@/composables/useAuth';
import conferenceService from '@/services/conferenceService';
import websocketServiceModule from '@/services/websocketService';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { userId } = useAuthContext();
const { websocketService } = websocketServiceModule;

const adminId = computed(() => route.params.adminId);
const inviteConferenceId = ref(null);
const peerName = ref('');
const conferenceId = computed(() => {
  const n = Number(route.query.conference);
  if (Number.isInteger(n) && n > 0) return n;
  return inviteConferenceId.value;
});
const currentUserId = computed(() => userId.value);
const chatTitle = computed(() => {
  if (peerName.value) {
    return t('chat.privateChatWith', { name: peerName.value });
  }
  return t('chat.privateChat');
});
const messages = ref([]);
const chatAttachments = ref([]);
const chatNewMessage = ref('');
const isLoadingMessages = ref(false);
const joining = ref(false);
const activeConversationId = ref(null);
let reloadTimer = null;

function scheduleReloadFromWs(payload) {
  const cid = payload?.conversationId ?? payload;
  if (cid != null && activeConversationId.value != null
    && Number(cid) !== Number(activeConversationId.value)) {
    return;
  }
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    loadMessages({ silent: true });
  }, 150);
}

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

async function loadMessages({ silent = false } = {}) {
  if (!adminId.value) return;
  
  try {
    if (!silent) isLoadingMessages.value = true;
    const conversationsResponse = await getPrivateConversations();
    const conversation = conversationsResponse.conversations?.find(conv => 
      Number(conv.peer_user_id || conv.user_id) === Number(adminId.value)
    );
    
    if (conversation) {
      activeConversationId.value = conversation.conversation_id;
      peerName.value = conversation.peer_name
        || conversation.title
        || '';
      const messagesResponse = await getPrivateMessages(conversation.conversation_id);
      messages.value = messagesResponse?.messages || [];
      try {
        await markPrivateMessagesAsRead(conversation.conversation_id);
      } catch (error) {
        console.error('[AdminChatView] Ошибка отметки сообщений как прочитанных:', error);
      }
    } else {
      activeConversationId.value = null;
      peerName.value = '';
      messages.value = [];
    }
  } catch (error) {
    console.error('[AdminChatView] Ошибка загрузки сообщений:', error);
    if (!silent) messages.value = [];
  } finally {
    if (!silent) isLoadingMessages.value = false;
  }
}

async function handleSendMessage({ message, attachments = [] }) {
  const files = Array.isArray(attachments) ? attachments.slice(0, 1) : [];
  if ((!String(message || '').trim() && files.length === 0) || !adminId.value) return;
  
  try {
    await sendPrivateMessage({
      recipientId: parseInt(adminId.value, 10),
      content: message,
      attachments: files
    });
    chatNewMessage.value = '';
    chatAttachments.value = [];
    await loadMessages();
  } catch (error) {
    console.error('[AdminChatView] Ошибка отправки сообщения:', error);
    const code = error?.response?.data?.code;
    const apiError = error?.response?.data?.error;
    ElMessage.error(
      code === 'CHAT_CAP_DENIED'
        ? t('chat.capDenied')
        : (apiError || t('chat.sendMessageError'))
    );
  }
}

watch(adminId, async () => {
  await loadInviteForHost();
  await loadMessages();
});

onMounted(async () => {
  if (currentUserId.value) {
    websocketService.connect(currentUserId.value);
  }
  websocketService.on('messages-updated', scheduleReloadFromWs);
  websocketService.on('conversation-updated', scheduleReloadFromWs);
  await loadInviteForHost();
  await loadMessages();
});

onUnmounted(() => {
  if (reloadTimer) clearTimeout(reloadTimer);
  websocketService.off('messages-updated', scheduleReloadFromWs);
  websocketService.off('conversation-updated', scheduleReloadFromWs);
});
</script>

<style scoped>
.admin-chat-header {
  position: relative;
  display: flex;
  align-items: center;
  padding: 1rem;
  padding-right: calc(var(--spacing-md) + 2rem);
  background: color-mix(in srgb, var(--color-primary) 10%, white);
  border-bottom: 2px solid var(--color-primary, #1a1a1a);
  font-size: 1.15rem;
  font-weight: bold;
}

.conference-invite {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-primary-light);
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

.loading-container {
  height: 200px;
  position: relative;
  padding: 2rem;
  text-align: center;
}

.chat-panel {
  height: calc(100dvh - 120px);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chat-panel.with-invite {
  height: calc(100dvh - 190px);
}

.chat-panel :deep(.chat-container) {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}

.loading {
  color: #888;
  font-size: 1.1rem;
}

@media (max-width: 768px) {
  .admin-chat-header {
    padding: 0.75rem;
    font-size: 1rem;
  }
  
  .chat-panel {
    height: calc(100dvh - 100px);
  }

  .chat-panel.with-invite {
    height: calc(100dvh - 180px);
  }
}
</style>
