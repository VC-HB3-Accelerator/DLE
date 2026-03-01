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
      isPrivateChat 
        ? (isCurrentUserMessage ? 'private-current-user' : 'private-other-user')
        : message.sender_type === 'assistant' || message.role === 'assistant'
          ? 'ai-message'
          : message.sender_type === 'system' || message.role === 'system'
            ? 'system-message'
            : 'user-message',
      message.isLocal ? 'is-local' : '',
      message.hasError ? 'has-error' : '',
    ]"
  >
    <!-- Информация об отправителе для приватного чата -->
    <div v-if="message.message_type === 'admin_chat'" class="message-sender-info">
      <div class="sender-label">
        <span class="sender-direction">
          {{ isCurrentUserMessage ? 'Вы →' : '← Получено от' }}
        </span>
        <span class="sender-wallet">
          {{ formatWalletAddress(isCurrentUserMessage ? message.recipient_wallet : message.sender_wallet) }}
        </span>
      </div>
    </div>

    <!-- Текстовый контент, если есть -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="message.content" class="message-content" v-html="formattedContent" />
    
    <!-- Ссылка "Ответить" для публичных сообщений от других пользователей -->
    <div v-if="shouldShowReplyLink" class="message-reply-link">
      <a :href="replyLink" class="reply-link">Ответить</a>
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
              Открыть документ →
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
          {{ isSubmittingConsent ? 'Подписание...' : 'Подписать' }}
        </button>
      </div>
    </div>

    <!-- Кнопки для системного сообщения -->
    <div v-if="message.sender_type === 'system' && (message.telegramBotUrl || message.supportEmail) && !message.consentRequired" class="system-actions">
      <button v-if="message.telegramBotUrl" @click="openTelegram(message.telegramBotUrl)" class="system-btn">Перейти в Telegram-бот</button>
      <button v-if="message.supportEmail" @click="copyEmail(message.supportEmail)" class="system-btn">Скопировать email</button>
    </div>

    <!-- Блок для отображения прикрепленного файла (теперь с плеерами/изображением/ссылкой) -->
    <div v-if="attachment" class="message-attachments">
      <div class="attachment-item">
        <!-- Изображение -->
        <img v-if="isImage" :src="objectUrl" :alt="attachment.originalname" class="attachment-preview image-preview"/>

        <!-- Аудио -->
        <audio v-else-if="isAudio" :src="objectUrl" controls class="attachment-preview audio-preview" />

        <!-- Видео -->
        <video v-else-if="isVideo" :src="objectUrl" controls class="attachment-preview video-preview" />

        <!-- Другие типы файлов (ссылка на скачивание) -->
        <div v-else class="attachment-info file-preview">
          <span class="attachment-icon">📄</span>
          <a :href="objectUrl" :download="attachment.originalname" class="attachment-name">
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
          {{ message.isRead ? '✓ Прочитано' : '○ Отправлено' }}
        </span>
        <span v-else class="read-status received">
          Получено
        </span>
      </div>
      <div v-if="message.isLocal" class="message-status">
        <span class="sending-indicator">Отправка...</span>
      </div>
      <div v-if="message.hasError" class="message-status">
        <span class="error-indicator">Ошибка отправки</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, computed, ref, watch, onUnmounted } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

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

const emit = defineEmits(['consent-granted']);

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
    alert('Ошибка при подписании документов. Попробуйте еще раз.');
  } finally {
    isSubmittingConsent.value = false;
  }
}

// Простая функция для определения, является ли сообщение отправленным текущим пользователем
// Используем данные из самого сообщения для определения направления
const isCurrentUserMessage = computed(() => {
  // Для приватного чата используем sender_id и currentUserId
  if (props.isPrivateChat && props.currentUserId) {
    return props.message.sender_id == props.currentUserId;
  }
  
  // Если это admin_chat, используем sender_id для определения
  if (props.message.message_type === 'admin_chat') {
    // Для простоты, считаем что если sender_id равен user_id, то это ответное сообщение
    // Это может потребовать корректировки в зависимости от логики
    return props.message.sender_id === props.message.user_id;
  }
  
  // Для публичных сообщений сравниваем sender_id с currentUserId
  if (props.message.message_type === 'public' && props.currentUserId) {
    return props.message.sender_id == props.currentUserId;
  }
  
  // Для обычных сообщений используем стандартную логику
  return props.message.sender_type === 'user' || props.message.role === 'user';
});

// Функция для форматирования wallet адреса
const formatWalletAddress = (address) => {
  if (!address || address === 'Админ') {
    return 'Админ';
  }
  
  // Если это wallet адрес (начинается с 0x), показываем сокращенную версию
  if (address.startsWith('0x') && address.length === 42) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  
  return address;
};

// --- Логика ссылки "Ответить" для публичных сообщений ---
const shouldShowReplyLink = computed(() => {
  // Показываем ссылку только для публичных сообщений от других пользователей
  return props.message.message_type === 'public' && 
         !isCurrentUserMessage.value && 
         props.message.sender_id && 
         props.currentUserId &&
         props.message.sender_id !== props.currentUserId;
});

const replyLink = computed(() => {
  if (!shouldShowReplyLink.value) return '';
  // Ссылка ведет на страницу контакта отправителя
  return `/contacts/${props.message.sender_id}`;
});

// --- Работа с вложениями --- 
const attachment = computed(() => {
    // Ожидаем массив attachments, даже если там только один элемент
    return props.message.attachments && props.message.attachments.length > 0
      ? props.message.attachments[0]
      : null;
});

const objectUrl = ref(null);
const isImage = ref(false);
const isAudio = ref(false);
const isVideo = ref(false);

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
  // Очищаем предыдущий URL, если он был
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = null;
  }
  // Сбрасываем типы
  isImage.value = false;
  isAudio.value = false;
  isVideo.value = false;

  if (newAttachment && newAttachment.data_base64 && newAttachment.mimetype) {
    const blob = base64ToBlob(newAttachment.data_base64, newAttachment.mimetype);
    if (blob) {
      objectUrl.value = URL.createObjectURL(blob);

      // Определяем тип для условного рендеринга
      const mimetype = newAttachment.mimetype.toLowerCase();
      if (mimetype.startsWith('image/')) {
        isImage.value = true;
      } else if (mimetype.startsWith('audio/')) {
        isAudio.value = true;
      } else if (mimetype.startsWith('video/')) {
        isVideo.value = true;
      }
    }
  }
}, { immediate: true }); // Выполняем сразу при монтировании

// Очистка при размонтировании
onUnmounted(() => {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
  }
});

// --- Форматирование контента и времени (остается как было) ---
const formattedContent = computed(() => {
  if (!props.message.content) return '';
  const rawHtml = marked.parse(props.message.content);
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
  if (!bytes || bytes === 0) return '0 Bytes'; // Добавлена проверка на undefined/null
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
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
  word-wrap: break-word;
  position: relative;
}

.user-message {
  background-color: var(--color-user-message);
  align-self: flex-end;
  margin-left: auto;
  margin-right: var(--spacing-sm);
  border-bottom-right-radius: 2px;
}

.ai-message {
  background-color: var(--color-ai-message);
  align-self: flex-start;
  margin-right: auto;
  margin-left: var(--spacing-sm);
  word-break: break-word;
  max-width: 70%;
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

.message-content {
  margin-bottom: var(--spacing-xs);
  white-space: pre-wrap;
  word-break: break-word;
  font-size: var(--font-size-md);
  line-height: 1.5;
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
}
.message-content :deep(code) {
    font-family: monospace;
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
.system-btn {
  background: var(--color-primary, #3b82f6);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 1em;
  transition: background 0.2s;
}
.system-btn:hover {
  background: var(--color-primary-dark, #2563eb);
}
.system-btn.primary {
  background: var(--color-primary, #007bff);
  font-weight: 600;
}
.system-btn.primary:hover {
  background: var(--color-primary-dark, #0056b3);
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
  border-color: var(--color-primary, #007bff);
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
  color: var(--color-primary, #007bff);
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
  color: var(--color-primary, #3b82f6);
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

/* Стили для приватного чата */
.private-current-user {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8); /* Синий градиент */
  color: white;
  margin-left: auto;
  margin-right: 0;
  max-width: 70%;
  border-radius: 18px 18px 4px 18px;
}

.private-other-user {
  background: linear-gradient(135deg, #10b981, #059669); /* Зеленый градиент */
  color: white;
  margin-left: 0;
  margin-right: auto;
  max-width: 70%;
  border-radius: 18px 18px 18px 4px;
}

/* Анимация появления сообщений */
.private-current-user,
.private-other-user {
  animation: slideInMessage 0.3s ease-out;
}

@keyframes slideInMessage {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Стили для ссылки "Ответить" */
.message-reply-link {
  margin-top: var(--spacing-xs);
  text-align: right;
}

.reply-link {
  color: var(--color-primary, #007bff);
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
  color: var(--color-primary-dark, #0056b3);
  text-decoration: none;
}

/* Адаптивность для мобильных устройств */
@media (max-width: 768px) {
  .private-current-user,
  .private-other-user {
    max-width: 85%;
  }
}
</style> 