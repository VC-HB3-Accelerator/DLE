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
  <div
    :class="[
      'message',
      messageBubbleClass,
      message.isLocal ? 'is-local' : '',
      message.hasError ? 'has-error' : '',
    ]"
  >
    <!-- Подпись направления только если есть реальный wallet/имя (не «Админ») -->
    <div v-if="showPrivateSenderInfo" class="message-sender-info">
      <div class="sender-label">
        <span class="sender-direction">
          {{ isCurrentUserMessage ? t('chat.message.youArrow') : t('chat.message.receivedFrom') }}
        </span>
        <span class="sender-wallet">{{ privateCounterpartyLabel }}</span>
      </div>
    </div>

    <div v-if="cmsTitle" class="cms-welcome-title">{{ cmsTitle }}</div>

    <!-- Текстовый контент, если есть -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="displayContent" class="message-content" v-html="formattedContent" />

    <!-- CMS ветки: кнопки + текстовые вопросы -->
    <div v-if="cmsBranches.length" class="cms-branches">
      <div v-if="buttonBranches.length" class="cms-branches__buttons">
        <button
          v-for="branch in buttonBranches"
          :key="'btn-' + branch.id"
          type="button"
          class="system-btn"
          @click="onBranchClick(branch)"
        >
          {{ branch.label }}
        </button>
      </div>
      <div v-if="textBranches.length" class="cms-branches__texts">
        <button
          v-for="branch in textBranches"
          :key="'txt-' + branch.id"
          type="button"
          class="cms-branch-text"
          @click="onBranchClick(branch)"
        >
          {{ branch.label }}
        </button>
      </div>
    </div>
    
    <!-- Ссылка "Ответить" для публичных сообщений от других пользователей -->
    <div v-if="shouldShowReplyLink" class="message-reply-link">
      <a :href="replyLink" class="reply-link">{{ t('chat.message.reply') }}</a>
    </div>

    <!-- Блок с документами для подписания -->
    <div v-if="message.consentRequired && message.consentDocuments" class="consent-documents-block">
      <div v-for="doc in message.consentDocuments" :key="doc.id" class="consent-document-item">
        <label class="consent-document-label">
          <input 
            type="checkbox" 
            :value="doc.id"
            v-model="selectedConsentDocuments"
            class="consent-checkbox"
          />
          <div class="consent-document-info">
            <h4 class="consent-document-title">{{ doc.title }}</h4>
            <p v-if="doc.summary" class="consent-document-summary">{{ doc.summary }}</p>
            <a 
              :href="`/public/page/${doc.id}`" 
              target="_blank" 
              class="consent-document-link"
              @click.stop
            >
              {{ t('chat.message.openDocument') }}
            </a>
          </div>
        </label>
      </div>
      <div class="consent-actions">
        <button 
          @click="submitConsent" 
          class="system-btn primary"
          :disabled="selectedConsentDocuments.length === 0 || isSubmittingConsent"
        >
          {{ isSubmittingConsent ? t('chat.message.signing') : t('chat.message.sign') }}
        </button>
      </div>
    </div>

    <!-- Мягкое приглашение гостю войти через кошелёк (первый ответ ИИ) -->
    <div
      v-if="showWalletInvite"
      class="wallet-login-invite"
    >
      <p class="wallet-login-invite__text">{{ t('chat.message.guestWalletInvite') }}</p>
      <button type="button" class="system-btn primary" @click="requestWalletLogin">
        {{ t('auth.connectWallet') }}
      </button>
    </div>

    <!-- Кнопки для системного сообщения -->
    <div v-if="message.sender_type === 'system' && (message.telegramBotUrl || message.supportEmail) && !message.consentRequired" class="system-actions">
      <button v-if="message.telegramBotUrl" @click="openTelegram(message.telegramBotUrl)" class="system-btn">{{ t('chat.message.goToTelegram') }}</button>
      <button v-if="message.supportEmail" @click="copyEmail(message.supportEmail)" class="system-btn">{{ t('chat.message.copyEmail') }}</button>
    </div>

    <!-- Блок для отображения прикрепленного файла (теперь с плеерами/изображением/ссылкой) -->
    <div v-if="attachment" class="message-attachments">
      <div class="attachment-item">
        <img v-if="isImage" :src="mediaSrc" :alt="attachment.originalname" class="attachment-preview image-preview"/>
        <VoiceMessageBubble
          v-else-if="isAudio && mediaSrc"
          :src="mediaSrc"
          :play-label="t('chat.playVoice')"
        />
        <VideoNoteBubble
          v-else-if="isVideoNote && mediaSrc"
          :src="mediaSrc"
          :play-label="t('chat.playVideoNote')"
        />
        <video
          v-else-if="isVideo"
          :src="mediaSrc"
          controls
          playsinline
          webkit-playsinline
          class="attachment-preview video-preview"
        />
        <div v-else class="attachment-info file-preview">
          <span class="attachment-icon">📄</span>
          <a :href="mediaSrc" :download="attachment.originalname" class="attachment-name">
            {{ attachment.originalname }}
          </a>
          <span class="attachment-size">({{ formatFileSize(attachment.size) }})</span>
        </div>
      </div>
    </div>

    <div class="message-meta">
      <div class="message-time">
        {{ formattedTime }}
      </div>
      <div v-if="message.message_type === 'admin_chat'" class="message-read-status">
        <span v-if="isCurrentUserMessage" class="read-status">
          {{ message.isRead ? t('chat.message.read') : t('chat.message.sent') }}
        </span>
        <span v-else class="read-status received">
          {{ t('chat.message.received') }}
        </span>
      </div>
      <div v-if="message.isLocal" class="message-status">
        <span class="sending-indicator">{{ t('chat.message.sending') }}</span>
      </div>
      <div v-if="message.hasError" class="message-status">
        <span class="error-indicator">{{ t('chat.message.sendError') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, computed, ref, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import eventBus from '../utils/eventBus';
import VideoNoteBubble from './chat/VideoNoteBubble.vue';
import VoiceMessageBubble from './chat/VoiceMessageBubble.vue';
import { useAuthContext } from '../composables/useAuth';
import { detectAttachmentKind } from '@/shared/mediaLimits.js';

const { t, locale: i18nLocale } = useI18n();
const auth = useAuthContext();

const props = defineProps({
  message: {
    type: Object,
    required: true,
  },
  isPrivateChat: {
    type: Boolean,
    default: false,
  },
  currentUserId: {
    type: [String, Number],
    default: null,
  },
});

const emit = defineEmits(['consent-granted', 'cms-branch']);

const cmsLocaleBlock = computed(() => {
  const map = props.message?.i18n;
  if (!map || typeof map !== 'object') return null;
  const loc = String(i18nLocale.value || 'ru');
  return map[loc] || map.ru || map.en || Object.values(map)[0] || null;
});

const displayContent = computed(() => {
  if (cmsLocaleBlock.value?.content) return cmsLocaleBlock.value.content;
  return props.message?.content || '';
});

const cmsTitle = computed(() => {
  if (!(props.message?.cmsEphemeral || props.message?.i18n)) return '';
  return cmsLocaleBlock.value?.title || '';
});

const cmsBranches = computed(() => {
  const branches = cmsLocaleBlock.value?.branches;
  return Array.isArray(branches) ? branches : [];
});

const buttonBranches = computed(() => cmsBranches.value.filter((b) => b.ui !== 'text'));
const textBranches = computed(() => cmsBranches.value.filter((b) => b.ui === 'text'));

function onBranchClick(branch) {
  const payload = branch.payload || branch.label || '';
  if (!payload) return;
  emit('cms-branch', { payload, branch, message: props.message });
}

const showWalletInvite = computed(() => (
  Boolean(props.message?.suggestWalletLogin) && !auth.isAuthenticated.value
));

function requestWalletLogin() {
  if (auth.isAuthenticated.value) return;
  // request-wallet-auth уже открывает сайдбар и стартует MetaMask
  eventBus.emit('request-wallet-auth');
}

// Состояние для выбранных документов и отправки согласия
const selectedConsentDocuments = ref([]);
const isSubmittingConsent = ref(false);

// Инициализируем выбранные документы при монтировании, если есть документы
watch(() => props.message.consentDocuments, (docs) => {
  if (docs && Array.isArray(docs) && docs.length > 0) {
    // Автоматически выбираем все документы
    selectedConsentDocuments.value = docs.map(doc => doc.id);
  }
}, { immediate: true });

// Функция подписания документов
async function submitConsent() {
  if (selectedConsentDocuments.value.length === 0 || isSubmittingConsent.value) return;
  
  isSubmittingConsent.value = true;
  try {
    const api = (await import('../api/axios')).default;
    const documents = props.message.consentDocuments || [];
    const consentTypes = documents
      .filter(doc => selectedConsentDocuments.value.includes(doc.id))
      .map(doc => doc.consentType)
      .filter(type => type);
    
    await api.post('/consent/grant', {
      documentIds: selectedConsentDocuments.value,
      consentTypes: consentTypes,
    });
    
    // Уведомляем родительский компонент об успешном подписании
    emit('consent-granted', props.message.id);
  } catch (error) {
    console.error('Ошибка подписания документов:', error);
    alert(t('chat.message.consentSignError'));
  } finally {
    isSubmittingConsent.value = false;
  }
}

// Простая функция для определения, является ли сообщение отправленным текущим пользователем
const isCurrentUserMessage = computed(() => {
  const me = props.currentUserId;
  if (me != null && me !== '' && (
    props.isPrivateChat
    || props.message.message_type === 'admin_chat'
    || props.message.message_type === 'public'
  )) {
    return Number(props.message.sender_id) === Number(me);
  }

  // Для обычных сообщений используем стандартную логику
  return props.message.sender_type === 'user' || props.message.role === 'user';
});

const messageBubbleClass = computed(() => {
  // Приватный чат — те же пузыри, что и везде (не тёмный градиент)
  if (props.isPrivateChat || props.message.message_type === 'admin_chat') {
    return isCurrentUserMessage.value ? 'user-message' : 'peer-public-message';
  }
  if (props.message.sender_type === 'assistant' || props.message.role === 'assistant') {
    return 'ai-message';
  }
  if (props.message.sender_type === 'system' || props.message.role === 'system') {
    return props.message.cmsEphemeral || props.message.i18n ? 'ai-message cms-welcome' : 'system-message';
  }
  // Public: свои справа, чужие слева (раньше все люди шли в user-message справа → «Ответить» на «своём»)
  if (props.message.message_type === 'public') {
    return isCurrentUserMessage.value ? 'user-message' : 'peer-public-message';
  }
  return 'user-message';
});

function formatWalletAddress(address) {
  if (!address) return '';
  const raw = String(address).trim();
  if (!raw || raw === t('common.admin')) return '';
  if (raw.startsWith('0x') && raw.length === 42) {
    return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
  }
  return raw;
}

const privateCounterpartyLabel = computed(() => {
  const raw = isCurrentUserMessage.value
    ? (props.message.recipient_name || props.message.recipient_wallet)
    : (props.message.sender_name || props.message.sender_wallet);
  return formatWalletAddress(raw);
});

const showPrivateSenderInfo = computed(() => (
  props.message.message_type === 'admin_chat' && Boolean(privateCounterpartyLabel.value)
));

// --- Логика ссылки "Ответить" для публичных сообщений ---
const shouldShowReplyLink = computed(() => {
  if (props.message.message_type !== 'public') return false;
  if (!props.message.sender_id || props.currentUserId == null || props.currentUserId === '') return false;
  if (isCurrentUserMessage.value) return false;
  // Loose compare: sender_id из API может быть number, currentUserId — string
  return Number(props.message.sender_id) !== Number(props.currentUserId);
});

const replyLink = computed(() => {
  if (!shouldShowReplyLink.value) return '';
  // TZ_CHAT_SYSTEM §3.3: «Ответить» → приватная беседа, не карточка-чат
  return `/admin-chat/${props.message.sender_id}`;
});

// --- Работа с вложениями --- 
const attachment = computed(() => {
    const raw = props.message.attachments && props.message.attachments.length > 0
      ? props.message.attachments[0]
      : null;
    if (!raw) return null;
    return {
      ...raw,
      originalname: raw.originalname || raw.filename || raw.name,
      mimetype: raw.mimetype || raw.type,
      url: raw.url || (raw.id ? `/api/chat/attachment/${raw.id}` : '')
    };
});

const objectUrl = ref(null);
const isImage = ref(false);
const isAudio = ref(false);
const isVideo = ref(false);
const isVideoNote = ref(false);

const mediaSrc = computed(() => {
  if (attachment.value?.url) return attachment.value.url;
  if (objectUrl.value) return objectUrl.value;
  return '';
});

// Функция для преобразования Base64 в Blob
const base64ToBlob = (base64, mimetype) => {
  try {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimetype });
  } catch (e) {
    // console.error("Error decoding base64 string:", e);
    return null;
  }
};

// Наблюдаем за изменением вложения в сообщении
watch(attachment, (newAttachment) => {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = null;
  }
  isImage.value = false;
  isAudio.value = false;
  isVideo.value = false;
  isVideoNote.value = false;

  if (!newAttachment) return;

  const mimetype = String(newAttachment.mimetype || newAttachment.type || '').toLowerCase();
  const filename = String(newAttachment.originalname || newAttachment.filename || newAttachment.name || '');
  const metaKind = props.message?.metadata?.attachment_kind
    || props.message?.attachment_kind
    || '';
  const kind = detectAttachmentKind({
    filename,
    mimetype,
    hint: newAttachment.kind || newAttachment.attachmentKind || metaKind,
  });

  if (kind === 'video_note') {
    isVideoNote.value = true;
  } else if (kind === 'audio') {
    isAudio.value = true;
  } else if (kind === 'video') {
    isVideo.value = true;
  } else if (kind === 'image') {
    isImage.value = true;
  }

  if (newAttachment.url) return;

  if (newAttachment.data_base64 && newAttachment.mimetype) {
    const blob = base64ToBlob(newAttachment.data_base64, newAttachment.mimetype);
    if (blob) objectUrl.value = URL.createObjectURL(blob);
  }
}, { immediate: true });

// Очистка при размонтировании
onUnmounted(() => {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
  }
});

// --- Форматирование контента и времени (остается как было) ---
const formattedContent = computed(() => {
  if (!displayContent.value) return '';
  const rawHtml = marked.parse(displayContent.value);
  return DOMPurify.sanitize(rawHtml);
});

const formattedTime = computed(() => {
  const timestamp = props.message.timestamp || props.message.created_at;
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      // console.warn('Invalid timestamp in Message.vue:', timestamp);
      return '';
    }
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    // console.error('Error formatting time in Message.vue:', error, timestamp);
    return '';
  }
});

// Форматирование размера файла
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return t('common.fileSize.zero');
  const k = 1024;
  const sizes = [
    t('common.fileSize.bytes'),
    t('common.fileSize.kb'),
    t('common.fileSize.mb'),
    t('common.fileSize.gb'),
  ];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

function openTelegram(url) {
  window.open(url, '_blank');
}
function copyEmail(email) {
  navigator.clipboard.writeText(email);
  // Можно добавить уведомление "Email скопирован"
}

</script>

<style scoped>
/* Стили сообщений, полностью перенесенные из home.css */
.message {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-lg);
  max-width: 75%;
  min-width: 0;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  word-break: break-word;
  position: relative;
  box-sizing: border-box;
}

.user-message {
  background-color: var(--color-user-message);
  align-self: flex-end;
  margin-left: auto;
  margin-right: var(--spacing-sm);
  border-bottom-right-radius: 2px;
}

.peer-public-message {
  background-color: var(--color-ai-message);
  align-self: flex-start;
  margin-right: auto;
  margin-left: var(--spacing-sm);
  word-break: break-word;
  overflow-wrap: anywhere;
  max-width: 70%;
  min-width: 0;
  border-bottom-left-radius: 2px;
}

.ai-message {
  background-color: var(--color-ai-message);
  align-self: flex-start;
  margin-right: auto;
  margin-left: var(--spacing-sm);
  word-break: break-word;
  overflow-wrap: anywhere;
  max-width: 70%;
  min-width: 0;
  border-bottom-left-radius: 2px;
}

.system-message {
  background-color: var(--color-system-message);
  align-self: center;
  margin-left: auto;
  margin-right: auto;
  font-style: italic;
  color: var(--color-system-text);
  text-align: center;
  max-width: 90%;
}

/* CMS-приветствие — как ответ ассистента, без «системного» italic */
.message.cms-welcome {
  font-style: normal;
  color: inherit;
  text-align: left;
}

.cms-welcome-title {
  font-weight: 600;
  font-size: var(--font-size-md);
  margin-bottom: var(--spacing-xs);
  line-height: 1.35;
}

.cms-branches {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  font-style: normal;
}

.cms-branches__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.cms-branches__texts {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
}

.cms-branch-text {
  border: none;
  background: transparent;
  color: var(--color-primary, #1a1a1a);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  padding: 0;
  text-align: left;
}

.cms-branch-text:hover {
  opacity: 0.8;
}

.message-content {
  margin-bottom: var(--spacing-xs);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  font-size: var(--font-size-md);
  line-height: 1.5;
  min-width: 0;
  max-width: 100%;
}

.message-content :deep(p) {
    margin-bottom: 0.5em;
}
.message-content :deep(ul),
.message-content :deep(ol) {
    margin-left: 1.5em;
}
.message-content :deep(pre) {
    background-color: #eee;
    padding: 0.5em;
    border-radius: 4px;
    overflow-x: auto;
    max-width: 100%;
    box-sizing: border-box;
}
.message-content :deep(code) {
    font-family: monospace;
    word-break: break-word;
    overflow-wrap: anywhere;
}
.message-content :deep(pre code) {
    word-break: normal;
    white-space: pre;
}
.message-content :deep(img),
.message-content :deep(video) {
    max-width: 100%;
    height: auto;
}
.message-content :deep(table) {
    display: block;
    max-width: 100%;
    overflow-x: auto;
    box-sizing: border-box;
}
.message-content :deep(a) {
    overflow-wrap: anywhere;
    word-break: break-word;
}

.message-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--spacing-xs);
}

.message-time {
  font-size: var(--font-size-xs);
  color: var(--color-grey);
  text-align: right;
}

.message-status {
  font-size: var(--font-size-xs);
  color: var(--color-grey);
}

.sending-indicator {
  color: var(--color-secondary);
  font-style: italic;
}

.error-indicator {
  color: var(--color-danger);
  font-weight: bold;
}

.is-local {
  opacity: 0.7;
}

.has-error {
  border: 1px solid var(--color-danger);
}

/* Стили для вложений */
.message-attachments {
  margin-top: var(--spacing-sm);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  padding-top: var(--spacing-sm);
}

.attachment-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.attachment-item :deep(.video-note),
.attachment-item :deep(.voice) {
  margin-bottom: var(--spacing-xs);
}

.attachment-preview {
  max-width: 100%;
  max-height: 300px;
  margin-bottom: var(--spacing-xs);
  border-radius: var(--radius-md);
}

.image-preview {
  object-fit: cover;
}

.audio-preview {
  width: 100%;
}

.video-preview {
  width: 100%;
}

.file-preview {
  display: flex;
  align-items: center;
  font-size: var(--font-size-sm);
}

.attachment-icon {
  margin-right: var(--spacing-xs);
}

.attachment-name {
  font-weight: 500;
  margin-right: var(--spacing-xs);
  color: var(--color-primary);
  text-decoration: none;
}

.attachment-name:hover {
  text-decoration: underline;
}

.attachment-size {
  color: var(--color-grey);
  font-size: var(--font-size-xs);
}

/* Адаптивные стили для разных экранов */
@media (max-width: 768px) {
  .message {
    max-width: 85%;
    padding: var(--spacing-xs) var(--spacing-sm);
  }
  
  .ai-message {
    max-width: 80%;
  }
}

@media (max-width: 480px) {
  .message {
    max-width: 95%;
    font-size: var(--font-size-sm);
  }
  
  .ai-message {
    max-width: 90%;
  }
  
  .message-time {
    font-size: calc(var(--font-size-xs) - 1px);
  }
  
  .attachment-preview {
    max-height: 200px;
  }
}

.system-actions {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}

.wallet-login-invite {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.wallet-login-invite__text {
  margin: 0;
  font-size: 0.92em;
  line-height: 1.45;
  color: var(--color-grey, #666);
  font-style: normal;
}

.system-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 1em;
  transition: background 0.2s;
}
.system-btn:hover {
  background: var(--color-primary-dark);
}
.system-btn.primary {
  background: var(--color-primary);
  font-weight: 600;
}
.system-btn.primary:hover {
  background: var(--color-primary-dark);
}
.system-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Стили для блока с документами для подписания */
.consent-documents-block {
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.consent-document-item {
  margin-bottom: 12px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  transition: all 0.2s;
}

.consent-document-item:hover {
  border-color: var(--color-primary);
  background: #f8f9fa;
}

.consent-document-item:last-child {
  margin-bottom: 0;
}

.consent-document-label {
  display: flex;
  gap: 12px;
  cursor: pointer;
  align-items: flex-start;
}

.consent-checkbox {
  margin-top: 4px;
  width: 18px;
  height: 18px;
  cursor: pointer;
  flex-shrink: 0;
}

.consent-document-info {
  flex: 1;
}

.consent-document-title {
  margin: 0 0 6px 0;
  font-size: 1rem;
  color: var(--color-primary, #333);
  font-weight: 600;
}

.consent-document-summary {
  margin: 0 0 8px 0;
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
}

.consent-document-link {
  color: var(--color-primary);
  text-decoration: none;
  font-size: 0.9rem;
  display: inline-block;
  margin-top: 4px;
}

.consent-document-link:hover {
  text-decoration: underline;
}

.consent-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid #e9ecef;
}

/* Стили для информации об отправителе в приватном чате */
.message-sender-info {
  margin-bottom: 8px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  font-size: 0.85em;
}

.sender-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sender-direction {
  font-weight: 600;
  color: var(--color-primary);
}

.sender-wallet {
  font-family: monospace;
  color: var(--color-text-secondary, #666);
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.9em;
}

/* Стили для статуса прочтения */
.message-read-status {
  margin-left: 8px;
}

.read-status {
  font-size: 0.8em;
  color: var(--color-text-secondary, #666);
}

.read-status.received {
  color: var(--color-success, #10b981);
}

.read-status:contains('✓') {
  color: var(--color-success, #10b981);
}

/* Ссылка "Ответить" */
.message-reply-link {
  margin-top: var(--spacing-xs);
  text-align: right;
}

.reply-link {
  color: var(--color-primary);
  text-decoration: none;
  font-size: var(--font-size-sm);
  font-weight: 500;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  background-color: rgba(0, 123, 255, 0.1);
  transition: all 0.2s ease;
  display: inline-block;
}

.reply-link:hover {
  background-color: rgba(0, 123, 255, 0.2);
  color: var(--color-primary-dark);
  text-decoration: none;
}
</style> 