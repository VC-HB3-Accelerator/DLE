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
    <el-alert
      v-if="broadcastDraftMode"
      type="info"
      :closable="false"
      show-icon
      class="broadcast-draft-alert"
    >
      <template #title>
        {{ t('contacts.broadcast.drafts.chatHint') }}
      </template>
    </el-alert>

    <div v-if="broadcastDraftMode" class="broadcast-draft-subject">
      <label>{{ t('contacts.broadcast.subject') }}</label>
      <el-input
        v-model="draftSubject"
        maxlength="200"
        show-word-limit
        @input="saveDraftSoon"
        @change="saveDraftSoon"
      />
    </div>

    <ChatInterface
      embedded
      :messages="messages"
      :isLoading="isLoadingMessages"
      :attachments="chatAttachments"
      :newMessage="chatNewMessage"
      :canSend="broadcastDraftMode ? true : (canSendToUsers && !!address)"
      :canAttach="!broadcastDraftMode"
      :canGenerateAI="canGenerateAI && !broadcastDraftMode && !isGuestContact"
      :canSelectMessages="canGenerateAI && !broadcastDraftMode && !isGuestContact"
      :clearOnSend="!broadcastDraftMode"
      :currentUserId="currentUserId"
      @send-message="handleSendMessage"
      @update:newMessage="onNewMessageUpdate"
      @update:attachments="val => chatAttachments = val"
      @ai-reply="handleAiReply"
    />
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import ChatInterface from '@/components/ChatInterface.vue';
import messagesService from '@/services/messagesService.js';
import { getConversationByUserId, getMessagesByConversationId } from '@/services/messagesService.js';
import { notifyStoreCabinetAsk } from '@/services/storeService.js';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import { useContactDetailsContext } from '@/composables/useContactDetails';

const { t } = useI18n();
const route = useRoute();
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
const draftSubject = ref('');
const draftDirty = ref(false);
const draftSaving = ref(false);
let draftSaveTimer = null;
let draftSaveQueued = false;

const broadcastCampaignId = computed(() => {
  const raw = Number(route.query.broadcastCampaignId);
  return Number.isInteger(raw) && raw > 0 ? raw : null;
});

const broadcastDraftMode = computed(() => Boolean(broadcastCampaignId.value && contact.value?.id));
const isGuestContact = computed(() => String(contact.value?.id || '').startsWith('guest_'));

async function saveBroadcastDraft() {
  if (!broadcastDraftMode.value) return;
  if (draftSaving.value) {
    draftSaveQueued = true;
    return;
  }
  if (!String(chatNewMessage.value || '').trim()) return;

  draftSaving.value = true;
  try {
    await messagesService.saveBroadcastDraft(
      broadcastCampaignId.value,
      contact.value.id,
      {
        subject: draftSubject.value,
        body: chatNewMessage.value
      }
    );
    draftDirty.value = false;
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || t('contacts.broadcast.drafts.saveError'));
  } finally {
    draftSaving.value = false;
    if (draftSaveQueued) {
      draftSaveQueued = false;
      saveBroadcastDraft();
    }
  }
}
async function loadMessages() {
  if (!contact.value?.id) return;

  isLoadingMessages.value = true;
  try {
    if (isGuestContact.value) {
      const data = await messagesService.getMessagesByUserId(contact.value.id);
      messages.value = data?.messages || [];
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

async function loadBroadcastDraft() {
  if (!broadcastDraftMode.value) {
    return;
  }

  try {
    const response = await messagesService.getBroadcastDraft(
      broadcastCampaignId.value,
      contact.value.id
    );
    const draft = response?.draft;
    if (draft && draft.status === 'draft' && String(draft.body || '').trim()) {
      draftSubject.value = draft.subject || '';
      chatNewMessage.value = draft.body || '';
      draftDirty.value = false;
      return;
    }
  } catch (e) {
    // черновика ещё нет — попробуем локальную историю превью
  }

  // Fallback: текст из истории превью AI-агента (если DB-черновик ещё не создан)
  try {
    const raw = sessionStorage.getItem('broadcastPreviewHistory');
    const list = raw ? JSON.parse(raw) : [];
    const match = Array.isArray(list)
      ? list.find((item) => Number(item.userId) === Number(contact.value.id)
        && (!item.campaignId || Number(item.campaignId) === Number(broadcastCampaignId.value)))
      : null;
    if (match?.body) {
      draftSubject.value = match.subject || '';
      chatNewMessage.value = match.body || '';
      draftDirty.value = true;
      saveDraftSoon();
    }
  } catch (e) {
    console.error('[ContactChatView] Ошибка загрузки черновика рассылки:', e);
  }
}

function onNewMessageUpdate(val) {
  chatNewMessage.value = val;
  if (broadcastDraftMode.value) {
    draftDirty.value = true;
    saveDraftSoon();
  }
}

function saveDraftSoon() {
  if (!broadcastDraftMode.value) return;
  draftDirty.value = true;
  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer);
  }
  draftSaveTimer = setTimeout(() => {
    saveBroadcastDraft();
  }, 600);
}

async function handleSendMessage({ message, attachments = [], silent = false }) {
  if (!contact.value?.id) return false;

  if (broadcastDraftMode.value) {
    const text = String(message || '').trim();
    chatNewMessage.value = text;
    await saveBroadcastDraft();
    chatNewMessage.value = text;
    ElMessage.success(t('contacts.broadcast.drafts.savedInChat'));
    return true;
  }

  if (contact.value.is_blocked) {
    ElMessageBox.alert(t('contacts.details.userBlocked'), t('common.error'), { type: 'error' });
    return false;
  }

  const hasAnyId = contact.value.email || contact.value.telegram || contact.value.wallet;
  if (!isGuestContact.value && !hasAnyId) {
    ElMessageBox.alert(t('contacts.details.noIdentifiers'), t('common.error'), { type: 'warning' });
    return false;
  }

  const files = Array.isArray(attachments) ? attachments.slice(0, 1) : [];
  if (!String(message || '').trim() && files.length === 0) return false;

  const sessionUserId = Number(currentUserId.value);
  const contactNum = Number(contact.value.id);
  const isOwnCard = Number.isInteger(sessionUserId) && sessionUserId > 0 && sessionUserId === contactNum;

  try {
    const result = isGuestContact.value
      ? await messagesService.sendToGuestContact({
        toUserId: contact.value.id,
        message,
        attachments: files
      })
      : await messagesService.sendMessage({
        conversationId: conversationId.value,
        message,
        attachments: files,
        toUserId: isOwnCard ? undefined : contact.value.id
      });

    if (result?.success) {
      chatNewMessage.value = '';
      await loadMessages();
      if (!silent) {
        ElMessageBox.alert(t('contacts.details.sendSuccess'), t('common.success'), { type: 'success' });
      }
      return true;
    }
    throw new Error(result?.message || t('common.unknownError'));
  } catch (e) {
    const code = e?.response?.data?.code;
    ElMessageBox.alert(
      code === 'CHAT_CAP_DENIED'
        ? t('chat.capDenied')
        : t('contacts.details.sendError', { error: e?.response?.data?.error || e?.message || e }),
      t('common.error'),
      { type: 'error' }
    );
    return false;
  }
}

async function handleAiReply(selectedMessages = []) {
  if (isAiLoading.value || broadcastDraftMode.value) return;

  if (contact.value?.is_blocked) {
    ElMessageBox.alert(t('contacts.details.userBlocked'), t('common.error'), { type: 'error' });
    return;
  }

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

let storeAskSent = false;

async function bootstrap() {
  if (isCreateMode.value) {
    router.replace({ name: 'contact-profile', params: { id: 'new' } });
    return;
  }
  await loadMessages();
  await loadBroadcastDraft();
  await maybeSendStoreAsk();
}

async function maybeSendStoreAsk() {
  if (broadcastDraftMode.value || isCreateMode.value) return;
  const raw = String(route.query.storeAsk || '').trim();
  if (!raw || storeAskSent) return;
  const ids = [...new Set(raw.split(',').map((x) => x.trim()).filter(Boolean))];
  if (!ids.length) return;
  storeAskSent = true;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const links = ids.map((id) => `${origin}/store/${id}`).join('\n');
  const message = t('store.cabinet.askMessage', { links });
  const ok = await handleSendMessage({ message, attachments: [], silent: true });
  if (!ok) {
    storeAskSent = false;
    return;
  }
  try {
    await notifyStoreCabinetAsk(ids, route.params.id);
  } catch {
    /* событие CRM не должно откатывать уже отправленное сообщение */
  }
  const q = { ...route.query };
  delete q.storeAsk;
  await router.replace({
    name: 'contact-details',
    params: { id: route.params.id },
    query: q,
  });
}

onMounted(bootstrap);

onBeforeUnmount(async () => {
  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = null;
  }
  if (broadcastDraftMode.value && draftDirty.value) {
    await saveBroadcastDraft();
  }
});

watch(userId, async () => {
  messages.value = [];
  conversationId.value = null;
  chatNewMessage.value = '';
  chatAttachments.value = [];
  draftSubject.value = '';
  storeAskSent = false;
  await loadMessages();
  await loadBroadcastDraft();
  await maybeSendStoreAsk();
});

watch(() => contact.value?.id, async (newId, oldId) => {
  if (newId && newId !== oldId) {
    storeAskSent = false;
    await loadMessages();
    await loadBroadcastDraft();
    await maybeSendStoreAsk();
  }
});

watch(broadcastCampaignId, async () => {
  await loadBroadcastDraft();
});

watch(() => route.query.storeAsk, async () => {
  await maybeSendStoreAsk();
});
</script>

<style scoped>
.contact-chat-panel {
  border: none;
  border-radius: var(--block-radius);
  background: var(--color-white);
  box-shadow: none;
  overflow: hidden;
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
  max-height: none;
  max-width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.broadcast-draft-alert {
  margin: 12px 12px 0;
}

.broadcast-draft-subject {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 12px 0;
}

.broadcast-draft-subject label {
  font-size: var(--font-size-sm);
  color: var(--color-text-light);
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
    overflow: hidden;
  }
}

/* TZ package C safe */
@media (max-width: 768px) {
  .page, .layout, .panel, .settings-panel, [class*="container"], [class*="layout"], [class*="panel"] {
    max-width: 100%;
    box-sizing: border-box;
  }
}
</style>
