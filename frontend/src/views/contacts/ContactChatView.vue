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
  <section class="contact-chat-panel">
    <ChatInterface
      embedded
      :messages="messages"
      :isLoading="isLoadingMessages"
      :attachments="chatAttachments"
      :newMessage="chatNewMessage"
      :canSend="canSendToUsers && !!address"
      :canGenerateAI="canGenerateAI"
      :canSelectMessages="canGenerateAI"
      :currentUserId="currentUserId"
      @send-message="handleSendMessage"
      @update:newMessage="val => chatNewMessage = val"
      @update:attachments="val => chatAttachments = val"
      @ai-reply="handleAiReply"
    />
  </section>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import ChatInterface from '@/components/ChatInterface.vue';
import messagesService from '@/services/messagesService.js';
import { getConversationByUserId, getMessagesByConversationId, sendMessage } from '@/services/messagesService.js';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import { useContactDetailsContext } from '@/composables/useContactDetails';

const { t } = useI18n();
const router = useRouter();
const { canSendToUsers, canGenerateAI } = usePermissions();
const { address, userId: currentUserId } = useAuthContext();
const { contact, userId, isCreateMode } = useContactDetailsContext();

const isLoadingMessages = ref(false);
const messages = ref([]);
const chatAttachments = ref([]);
const chatNewMessage = ref('');
const isAiLoading = ref(false);
const conversationId = ref(null);

async function loadMessages() {
  if (!contact.value?.id) return;

  isLoadingMessages.value = true;
  try {
    if (String(contact.value.id).startsWith('guest_')) {
      messages.value = [];
      conversationId.value = null;
      return;
    }

    const convData = await getConversationByUserId(contact.value.id);
    const convId = convData?.conversations?.[0]?.id || convData?.id || null;
    conversationId.value = convId;

    if (!convId) {
      messages.value = [];
      return;
    }

    const response = await getMessagesByConversationId(convId, { limit: 50, offset: 0 });
    messages.value = response?.messages || [];
  } catch (e) {
    console.error('[ContactChatView] Ошибка загрузки сообщений:', e);
    messages.value = [];
    conversationId.value = null;
  } finally {
    isLoadingMessages.value = false;
  }
}

async function handleSendMessage({ message }) {
  if (!contact.value?.id) return;

  if (contact.value.is_blocked) {
    ElMessageBox.alert(t('contacts.details.userBlocked'), t('common.error'), { type: 'error' });
    return;
  }

  const hasAnyId = contact.value.email || contact.value.telegram || contact.value.wallet;
  if (!hasAnyId) {
    ElMessageBox.alert(t('contacts.details.noIdentifiers'), t('common.error'), { type: 'warning' });
    return;
  }

  try {
    const result = await sendMessage({
      recipientId: contact.value.id,
      content: message,
      messageType: 'public',
    });

    if (result?.success) {
      chatNewMessage.value = '';
      await loadMessages();
      ElMessageBox.alert(t('contacts.details.sendSuccess'), t('common.success'), { type: 'success' });
    } else {
      throw new Error(result?.message || t('common.unknownError'));
    }
  } catch (e) {
    ElMessageBox.alert(
      t('contacts.details.sendError', { error: e?.response?.data?.error || e?.message || e }),
      t('common.error'),
      { type: 'error' }
    );
  }
}

async function handleAiReply(selectedMessages = []) {
  if (isAiLoading.value) return;

  if (!Array.isArray(selectedMessages) || selectedMessages.length === 0) {
    alert(t('contacts.details.selectMessageForAi'));
    return;
  }

  isAiLoading.value = true;
  try {
    const draftResp = await messagesService.generateAiDraft(conversationId.value, selectedMessages);
    if (draftResp?.success && draftResp.aiMessage) {
      chatNewMessage.value = draftResp.aiMessage;
    } else {
      alert(t('contacts.details.aiGenerateFailed'));
    }
  } catch (e) {
    alert(t('contacts.details.aiGenerateError', { error: e?.message || e }));
  } finally {
    isAiLoading.value = false;
  }
}

onMounted(() => {
  if (isCreateMode.value) {
    router.replace({ name: 'contact-profile', params: { id: 'new' } });
    return;
  }
  loadMessages();
});

watch(userId, () => {
  messages.value = [];
  conversationId.value = null;
  chatNewMessage.value = '';
  chatAttachments.value = [];
  loadMessages();
});

watch(() => contact.value?.id, (newId, oldId) => {
  if (newId && newId !== oldId) {
    loadMessages();
  }
});
</script>

<style scoped>
.contact-chat-panel {
  border: none;
  border-radius: var(--block-radius);
  background: var(--color-white);
  box-shadow: none;
  overflow: hidden;
  height: calc(100dvh - 200px);
  min-height: 480px;
  max-height: calc(100dvh - 200px);
  display: flex;
  flex-direction: column;
}

.contact-chat-panel :deep(.chat-container) {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}

@media (max-width: 768px) {
  .contact-chat-panel {
    flex: 1 1 auto;
    min-height: 0;
    height: auto;
    max-height: none;
    border-radius: 0;
  }
}
</style>
