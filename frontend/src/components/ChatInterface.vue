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
    class="chat-container"
    :class="{ 'chat-container--embedded': embedded }"
  >
    <!-- Блок истории сообщений -->
    <div
      ref="messagesContainer"
      class="chat-messages"
      :style="panelWidthStyle(messagesWidth)"
      @scroll="handleScroll"
    >
      <div v-for="message in messages" :key="message.id" :class="['message-wrapper', { 'selected-message': selectedMessageIds.includes(message.id) }]">
        <template v-if="props.canSelectMessages">
          <input type="checkbox" class="admin-select-checkbox" :checked="selectedMessageIds.includes(message.id)" @change="() => toggleSelectMessage(message.id)" />
        </template>
        <Message 
          :message="message" 
          :isPrivateChat="isPrivateChat"
          :currentUserId="currentUserId"
          @consent-granted="handleConsentGranted"
        />
      </div>
    </div>

    <!-- Блок ввода сообщений -->
    <div
      ref="chatInputRef"
      class="chat-input"
      :style="panelWidthStyle(inputWidth)"
    >
      <div class="attachment-preview" v-if="localAttachments.length > 0">
        <div v-for="(file, index) in localAttachments" :key="index" class="preview-item">
          <img v-if="file.type.startsWith('image/')" :src="file.previewUrl" class="image-preview"/>
          <div v-else-if="file.type.startsWith('audio/')" class="audio-preview">
            <span>&#127925; {{ file.name }} ({{ formatFileSize(file.size) }})</span>
          </div>
          <div v-else-if="file.type.startsWith('video/')" class="video-preview">
            <span>&#127916; {{ file.name }} ({{ formatFileSize(file.size) }})</span>
          </div>
          <div v-else class="file-preview">
            <span>&#128196; {{ file.name }} ({{ formatFileSize(file.size) }})</span>
          </div>
          <button @click="removeAttachment(index)" class="remove-attachment-btn">×</button>
        </div>
      </div>

      <div v-if="isAudioRecording || isVideoRecording" class="record-status">
        <span>{{ isVideoRecording ? t('chat.recordingVideo') : t('chat.recordingAudio') }}</span>
        <span v-if="isAudioRecording && !isVideoRecording" class="record-status__hint">{{ t('chat.slideUpForVideo') }}</span>
      </div>

      <div class="chat-compose-row">
        <div class="input-shell" :class="{ 'input-shell--multiline': isMultilineInput }">
          <button
            type="button"
            class="attach-btn"
            :title="t('chat.attachFile')"
            :disabled="!props.canSend"
            @click="handleFileUpload"
          >
            <svg class="chat-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 1 1-8.49-8.49l9.19-9.19a4 4 0 1 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <textarea
            ref="messageInputRef"
            :value="newMessage"
            @input="handleInput"
            :placeholder="t('chat.inputPlaceholder')"
            :disabled="isLoading || !props.canSend"
            autofocus
            @keydown.enter.prevent="sendMessage"
            @focus="handleFocus"
            @blur="handleBlur"
          />
          <button
            v-if="props.canGenerateAI"
            type="button"
            class="ai-inline-btn"
            :title="t('chat.generateAi')"
            :disabled="isAiLoading"
            @click="handleAiReply"
          >
            <svg v-if="isAiLoading" class="ai-spinner chat-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke-width="2" />
            </svg>
            <svg v-else class="chat-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v2" />
              <path d="M12 19v2" />
              <path d="M5.6 5.6l1.4 1.4" />
              <path d="M17 17l1.4 1.4" />
              <path d="M3 12h2" />
              <path d="M19 12h2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            type="button"
            class="send-button"
            :class="{
              recording: isAudioRecording || isVideoRecording,
              'recording--video': isVideoRecording,
            }"
            :title="sendButtonTitle"
            :disabled="!props.canSend"
            @mousedown.prevent="onSendPointerDown"
            @touchstart.prevent="onSendPointerDown"
            @contextmenu.prevent
          >
            <svg v-if="isVideoRecording" class="chat-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2" y="6" width="14" height="12" rx="2" />
              <path d="m22 8-6 4 6 4V8z" />
            </svg>
            <svg v-else-if="isAudioRecording" class="chat-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
            </svg>
            <svg v-else class="chat-icon send-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22 11 13 2 9 22 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import Message from './Message.vue';
import messagesService from '../services/messagesService.js';

const { t } = useI18n();

const props = defineProps({
  messages: {
    type: Array,
    default: () => [],
  },
  isLoading: Boolean,
  newMessage: String, // Для v-model
  attachments: Array, // Для v-model
  // Добавляем пропс для проверки, есть ли еще сообщения для загрузки
  hasMoreMessages: Boolean,
  
  // Новые props для точного контроля прав
  canSend: { type: Boolean, default: true },           // Может отправлять сообщения
  canGenerateAI: { type: Boolean, default: false },    // Может генерировать AI-ответы
  canSelectMessages: { type: Boolean, default: false }, // Может выбирать сообщения
  
  // Props для приватного чата
  isPrivateChat: { type: Boolean, default: false },    // Это приватный чат
  currentUserId: { type: [String, Number], default: null }, // ID текущего пользователя
  embedded: { type: Boolean, default: false } // Встроенный режим: лента сверху, ввод снизу
});

const emit = defineEmits([
  'update:newMessage',
  'update:attachments',
  'send-message',
  'load-more', // Событие для загрузки старых сообщений
  'ai-reply',
  'remove-consent-messages', // Событие для удаления системных сообщений о согласиях
]);

const messagesContainer = ref(null);
const messageInputRef = ref(null);
const chatInputRef = ref(null);

function panelWidthStyle() {
  return undefined;
}

function handleConsentGranted(messageId) {
  // После подписания удаляем системное сообщение о необходимости согласия
  emit('remove-consent-messages', [messageId]);
}

// Локальное состояние для предпросмотра, синхронизированное с props.attachments
const localAttachments = ref([...props.attachments]);
watch(() => props.attachments, (newVal) => {
  // Обновляем локальное состояние, только если внешнее изменилось
  if (JSON.stringify(newVal) !== JSON.stringify(localAttachments.value)) {
      // Очищаем старые URL превью перед обновлением
      localAttachments.value.forEach(att => {
        if (att.previewUrl) {
          URL.revokeObjectURL(att.previewUrl);
        }
      });
      localAttachments.value = [...newVal];
  }
}, { deep: true });

// --- Логика записи медиа (остается здесь, так как связана с UI компонента) ---
const isAudioRecording = ref(false);
const isVideoRecording = ref(false);
const audioRecorder = ref(null);
const videoRecorder = ref(null);
const audioStream = ref(null);
const videoStream = ref(null);
const recordedAudioChunks = ref([]);
const recordedVideoChunks = ref([]);

  const startAudioRecording = async () => {
    // console.log('[ChatInterface] startAudioRecording called');
  try {
    if (isAudioRecording.value) return;
    audioStream.value = await navigator.mediaDevices.getUserMedia({ audio: true });
    // console.log('[ChatInterface] Got audio stream:', audioStream.value);
    recordedAudioChunks.value = [];
    audioRecorder.value = new MediaRecorder(audioStream.value);
    audioRecorder.value.ondataavailable = (event) => {
      // console.log('[ChatInterface] audioRecorder.ondataavailable fired');
      if (event.data.size > 0) recordedAudioChunks.value.push(event.data);
    };
    audioRecorder.value.onstop = () => {
        // console.log('[ChatInterface] audioRecorder.onstop fired');
        setTimeout(() => {
            if (recordedAudioChunks.value.length === 0) {
                // console.warn('[ChatInterface] No audio chunks recorded.');
                return;
            }
            // console.log(`[ChatInterface] Creating audio Blob from ${recordedAudioChunks.value.length} chunks.`);
            const audioBlob = new Blob(recordedAudioChunks.value, { type: 'audio/webm' });
            const audioFile = new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
            addAttachment(audioFile);
            recordedAudioChunks.value = [];
        }, 100);
    };
    audioRecorder.value.start();
    isAudioRecording.value = true;
    // console.log('[ChatInterface] Audio recording started, recorder state:', audioRecorder.value.state);
  } catch (error) {
    // console.error('[ChatInterface] Error starting audio recording:', error);
  }
};

const stopAudioRecording = async () => {
  // console.log('[ChatInterface] stopAudioRecording called');
  if (!isAudioRecording.value || !audioRecorder.value || audioRecorder.value.state === 'inactive') {
      // console.log('[ChatInterface] stopAudioRecording: Not recording or recorder inactive, state:', audioRecorder.value?.state);
      return;
  }
  try {
    audioRecorder.value.stop();
    // console.log('[ChatInterface] audioRecorder.stop() called');
    isAudioRecording.value = false;
    if (audioStream.value) {
        audioStream.value.getTracks().forEach(track => track.stop());
        // console.log('[ChatInterface] Audio stream tracks stopped.');
    }
  } catch (error) {
    // console.error('[ChatInterface] Error stopping audio recording:', error);
    isAudioRecording.value = false;
    if (audioStream.value) audioStream.value.getTracks().forEach(track => track.stop());
  }
};

const startVideoRecording = async () => {
  // console.log('[ChatInterface] startVideoRecording called');
  try {
    if (isVideoRecording.value) return;
    videoStream.value = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    // console.log('[ChatInterface] Got video stream:', videoStream.value);
    recordedVideoChunks.value = [];
    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        // console.warn(`MIME type ${options.mimeType} not supported, trying video/webm...`);
        options = { mimeType: 'video/webm' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            // console.warn(`MIME type ${options.mimeType} not supported, using default.`);
            options = {};
        }
    }
    // console.log('[ChatInterface] Using MediaRecorder options:', options);
    videoRecorder.value = new MediaRecorder(videoStream.value, options);

    videoRecorder.value.ondataavailable = (event) => {
      // console.log('[ChatInterface] videoRecorder.ondataavailable fired');
      if (event.data.size > 0) recordedVideoChunks.value.push(event.data);
    };
    videoRecorder.value.onstop = () => {
      // console.log('[ChatInterface] videoRecorder.onstop fired');
      setTimeout(() => {
          if (recordedVideoChunks.value.length === 0) {
              // console.warn('[ChatInterface] No video chunks recorded.');
              return;
          }
          // console.log(`[ChatInterface] Creating video Blob from ${recordedVideoChunks.value.length} chunks.`);
          const videoBlob = new Blob(recordedVideoChunks.value, { type: videoRecorder.value.mimeType || 'video/webm' });
          const videoFile = new File([videoBlob], `video-${Date.now()}.webm`, { type: videoRecorder.value.mimeType || 'video/webm' });
          addAttachment(videoFile);
          recordedVideoChunks.value = [];
      }, 100);
    };
    videoRecorder.value.start();
    isVideoRecording.value = true;
    // console.log('[ChatInterface] Video recording started, recorder state:', videoRecorder.value.state);
  } catch (error) {
    // console.error('[ChatInterface] Error starting video recording:', error);
  }
};

const stopVideoRecording = async () => {
  // console.log('[ChatInterface] stopVideoRecording called');
  if (!isVideoRecording.value || !videoRecorder.value || videoRecorder.value.state === 'inactive') {
      // console.log('[ChatInterface] stopVideoRecording: Not recording or recorder inactive, state:', videoRecorder.value?.state);
      return;
  }
  try {
    videoRecorder.value.stop();
    // console.log('[ChatInterface] videoRecorder.stop() called');
    isVideoRecording.value = false;
    if (videoStream.value) {
        videoStream.value.getTracks().forEach(track => track.stop());
        // console.log('[ChatInterface] Video stream tracks stopped.');
    }
  } catch (error) {
    // console.error('[ChatInterface] Error stopping video recording:', error);
    isVideoRecording.value = false;
    if (videoStream.value) videoStream.value.getTracks().forEach(track => track.stop());
  }
};

// --- Логика загрузки файлов --- 
const handleFileUpload = () => {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = '.txt,.pdf,.jpg,.jpeg,.png,.gif,.mp3,.wav,.mp4,.avi,.docx,.xlsx,.pptx,.odt,.ods,.odp,.zip,.rar,.7z';
  fileInput.onchange = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => addAttachment(file));
    }
  };
  fileInput.click();
};

// --- Логика управления предпросмотром --- 
const addAttachment = (file) => {
  const attachment = {
    file: file,
    name: file.name,
    size: file.size,
    type: file.type,
    previewUrl: null
  };
  if (file.type.startsWith('image/')) {
    attachment.previewUrl = URL.createObjectURL(file);
  }
  const updatedAttachments = [...localAttachments.value, attachment];
  localAttachments.value = updatedAttachments; // Обновляем локальное состояние
  emit('update:attachments', updatedAttachments); // Обновляем состояние в родителе
};

const removeAttachment = (index) => {
  const attachment = localAttachments.value[index];
  if (attachment.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
  const updatedAttachments = localAttachments.value.filter((_, i) => i !== index);
  localAttachments.value = updatedAttachments; // Обновляем локальное состояние
  emit('update:attachments', updatedAttachments); // Обновляем состояние в родителе
};

// --- Очистка ввода --- 
const clearInput = () => {
  emit('update:newMessage', ''); // Очищаем текстовое поле через emit
  // Очищаем локальные превью и родительское состояние
  localAttachments.value.forEach(att => {
      if (att.previewUrl) {
          URL.revokeObjectURL(att.previewUrl);
      }
  });
  localAttachments.value = [];
  emit('update:attachments', []);
  nextTick(adjustTextareaHeight); // Сбросить высоту textarea
};

const handleKeyboardToggle = () => {
  if (messageInputRef.value) {
    messageInputRef.value.focus();
  }
};

const LONG_PRESS_MS = 400;
const VIDEO_SWITCH_PX = 48;
let sendPressTimer = null;
let sendLongPressActive = false;
let sendPressStartY = 0;
let videoSwitchTriggered = false;

const sendButtonTitle = computed(() => {
  if (isVideoRecording.value) return t('chat.holdForVideo');
  if (isAudioRecording.value) return t('chat.holdForAudio');
  return t('chat.sendMessage');
});

function clearSendPressListeners() {
  document.removeEventListener('mousemove', onSendPointerMove);
  document.removeEventListener('mouseup', onSendPointerUp);
  document.removeEventListener('touchmove', onSendPointerMove);
  document.removeEventListener('touchend', onSendPointerUp);
  document.removeEventListener('touchcancel', onSendPointerUp);
}

function resetSendPressState() {
  if (sendPressTimer) {
    clearTimeout(sendPressTimer);
    sendPressTimer = null;
  }
  sendLongPressActive = false;
  videoSwitchTriggered = false;
  clearSendPressListeners();
}

async function switchRecordingToVideo() {
  if (videoSwitchTriggered || isVideoRecording.value) return;
  videoSwitchTriggered = true;
  if (isAudioRecording.value) {
    await stopAudioRecording();
  }
  await startVideoRecording();
}

function onSendPointerMove(event) {
  if (!sendLongPressActive || isVideoRecording.value) return;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  if (sendPressStartY - clientY >= VIDEO_SWITCH_PX) {
    switchRecordingToVideo();
  }
}

async function onSendPointerUp() {
  if (sendPressTimer) {
    clearTimeout(sendPressTimer);
    sendPressTimer = null;
  }

  if (sendLongPressActive) {
    if (isVideoRecording.value) {
      await stopVideoRecording();
    } else if (isAudioRecording.value) {
      await stopAudioRecording();
    }
    resetSendPressState();
    return;
  }

  clearSendPressListeners();
  if (!isSendDisabled.value) {
    sendMessage();
  }
}

function onSendPointerDown(event) {
  if (!props.canSend || props.isLoading) return;

  sendLongPressActive = false;
  videoSwitchTriggered = false;
  sendPressStartY = event.touches ? event.touches[0].clientY : event.clientY;

  sendPressTimer = setTimeout(async () => {
    sendLongPressActive = true;
    await startAudioRecording();
  }, LONG_PRESS_MS);

  document.addEventListener('mousemove', onSendPointerMove);
  document.addEventListener('mouseup', onSendPointerUp);
  document.addEventListener('touchmove', onSendPointerMove, { passive: true });
  document.addEventListener('touchend', onSendPointerUp);
  document.addEventListener('touchcancel', onSendPointerUp);
}

// --- Отправка сообщения --- 
const isSendDisabled = computed(() => {
  return props.isLoading || !props.canSend || (!props.newMessage.trim() && localAttachments.value.length === 0);
});

const sendMessage = () => {
  if (isSendDisabled.value) return;
  // Отправляем событие с текстом и текущими прикрепленными файлами
  emit('send-message', { 
      message: props.newMessage, 
      attachments: localAttachments.value.map(att => att.file) // Отправляем только сами файлы
  });
  // Очищаем поле ввода и превью после отправки
  clearInput();
  nextTick(adjustTextareaHeight); // Сбросить высоту textarea после отправки
};

// --- Изменение размера блоков ---
const messagesWidth = ref(70); // Начальная ширина блока истории (в процентах)
const inputWidth = ref(30); // Начальная ширина блока ввода (в процентах)
const isResizing = ref(false);
const resizeStartX = ref(0);
const resizeStartWidth = ref(0);

// Определяем, является ли устройство мобильным
const isMobile = ref(false);

// Функция для проверки мобильного устройства
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 1024;
  if (props.embedded) {
    messagesWidth.value = 100;
    inputWidth.value = 100;
    return;
  }
  if (isMobile.value) {
    // На мобильных устройствах устанавливаем ширину в 100%
    messagesWidth.value = 100;
    inputWidth.value = 100;
  } else {
    // На десктопе используем стандартные значения
    if (messagesWidth.value === 100) {
      messagesWidth.value = 70;
      inputWidth.value = 30;
    }
  }
};

// Отслеживаем изменение размера окна
onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
  adjustTextareaHeight();
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
  resetSendPressState();
});

const startResize = (e) => {
  isResizing.value = true;
  
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
  document.addEventListener('touchmove', handleResize);
  document.addEventListener('touchend', stopResize);
  
  e.preventDefault();
};

const handleResize = (e) => {
  if (!isResizing.value) return;
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const chatContainer = document.querySelector('.chat-container');
  if (!chatContainer) return;
  
  const containerRect = chatContainer.getBoundingClientRect();
  const containerWidth = containerRect.width;
  const mouseX = clientX - containerRect.left; // Позиция курсора относительно левого края контейнера
  
  // Вычисляем процент ширины блока истории от позиции курсора
  const newMessagesWidth = (mouseX / containerWidth) * 100;
  
  // Ограничиваем минимальную и максимальную ширину (от 20% до 80%)
  const clampedWidth = Math.max(20, Math.min(80, newMessagesWidth));
  
  messagesWidth.value = clampedWidth;
  inputWidth.value = 100 - clampedWidth;
};

const stopResize = () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  document.removeEventListener('touchmove', handleResize);
  document.removeEventListener('touchend', stopResize);
};

// --- Прокрутка и UI --- 
const scrollToBottom = () => {
  if (messagesContainer.value) {
    // Используем nextTick для ожидания обновления DOM
    nextTick(() => {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    });
  }
};

// Вызываем scrollToBottom при изменении количества сообщений
watch(() => props.messages.length, () => {
  scrollToBottom();
}, { flush: 'post' }); // flush: 'post' гарантирует выполнение после обновления DOM

// Обработчик скролла для подгрузки сообщений
const handleScroll = () => {
  const element = messagesContainer.value;
  if (element && element.scrollTop === 0 && props.hasMoreMessages) {
    emit('load-more');
  }
};

const handleFocus = () => {};

const handleBlur = () => {};

// Форматирование размера файла
const formatFileSize = (bytes) => {
  if (bytes === 0) return t('common.fileSize.zero');
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

// --- Автоматическое изменение высоты textarea ---
const INPUT_SINGLE_LINE_HEIGHT = 36;

const isMultilineInput = ref(false);

const adjustTextareaHeight = () => {
  const textarea = messageInputRef.value;
  if (!textarea) return;

  textarea.style.height = `${INPUT_SINGLE_LINE_HEIGHT}px`;
  const shouldExpand =
    textarea.scrollHeight > INPUT_SINGLE_LINE_HEIGHT + 2 || textarea.value.includes('\n');

  isMultilineInput.value = shouldExpand;

  nextTick(() => {
    if (!messageInputRef.value) return;
    const el = messageInputRef.value;
    if (!shouldExpand) {
      el.style.height = `${INPUT_SINGLE_LINE_HEIGHT}px`;
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  });
};

// Вызываем при изменении текста
const handleInput = (event) => {
  emit('update:newMessage', event.target.value);
  adjustTextareaHeight();
};

const isAiLoading = ref(false);

const selectedMessageIds = ref([]);

function toggleSelectMessage(id) {
  if (selectedMessageIds.value.includes(id)) {
    selectedMessageIds.value = selectedMessageIds.value.filter(mid => mid !== id);
  } else {
    selectedMessageIds.value.push(id);
  }
}

async function handleAiReply() {
  if (isAiLoading.value) return;
  // Если выбраны сообщения — отправляем их, иначе старое поведение
  if (emit) {
    const selectedMessages = props.messages.filter(m => selectedMessageIds.value.includes(m.id));
    emit('ai-reply', selectedMessages);
    return;
  }
  isAiLoading.value = true;
  try {
    const response = await messagesService.sendMessage({
      message: props.newMessage,
      attachments: []
    });
    if (response && response.aiMessage && response.aiMessage.content) {
      emit('update:newMessage', response.aiMessage.content);
    } else {
      emit('update:newMessage', '');
    }
  } catch (e) {
    console.error('Ошибка генерации ответа ИИ:', e);
    // Используем более дружелюбное уведомление вместо alert
    emit('error', {
      type: 'ai-generation-error',
      message: t('chat.aiGenerationError'),
      details: e.message
    });
  } finally {
    isAiLoading.value = false;
  }
}

</script>

<style scoped>
.chat-container {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  position: relative;
  overflow: hidden;
  --chat-column-width: 680px;
}

.chat-messages {
  grid-row: 1;
  width: 100% !important;
  flex: unset !important;
  overflow-y: auto;
  position: relative;
  padding: var(--spacing-md);
  min-height: 0;
  background-color: #ffffff;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.chat-container--embedded .chat-messages::-webkit-scrollbar,
.chat-messages::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.chat-input {
  grid-row: 2;
  position: relative;
  width: 100% !important;
  height: auto !important;
  min-height: 0;
  flex-shrink: 0;
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
  gap: 6px;
  box-sizing: border-box;
  background: #fff;
  border-top: none;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.chat-compose-row {
  width: 100%;
  flex-shrink: 0;
}

.input-shell {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: #fff;
  border: 1px solid #dde3ea;
  border-radius: 24px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
}

.input-shell--multiline {
  align-items: flex-end;
  padding-bottom: 4px;
}

.input-shell:focus-within {
  border-color: #b8c0cc;
  box-shadow: 0 0 0 3px rgba(51, 65, 85, 0.08);
}

.attach-btn,
.ai-inline-btn,
.send-button {
  align-self: center;
  margin: 0;
}

.input-shell--multiline .attach-btn,
.input-shell--multiline .ai-inline-btn,
.input-shell--multiline .send-button {
  align-self: flex-end;
  margin-bottom: 0;
}

.attach-btn,
.ai-inline-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.18s ease, background-color 0.18s ease;
}

.attach-btn:hover:not(:disabled),
.ai-inline-btn:hover:not(:disabled) {
  color: #334155;
  background: rgba(15, 23, 42, 0.05);
}

.attach-btn:disabled,
.ai-inline-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.input-shell textarea {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  height: 36px;
  min-height: 36px;
  max-height: 120px;
  border: none;
  background: transparent;
  border-radius: 0;
  resize: none;
  outline: none;
  font-size: var(--font-size-md);
  line-height: 36px;
  padding: 0 4px;
  margin: 0;
  color: var(--color-dark);
  overflow-y: hidden;
  box-sizing: border-box;
  vertical-align: middle;
}

.input-shell--multiline textarea {
  line-height: 20px;
  padding: 8px 4px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.input-shell--multiline textarea::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.input-shell textarea:focus {
  outline: none;
  box-shadow: none;
}

.record-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sm);
  color: #64748b;
  padding: 0 4px;
}

.record-status__hint {
  color: #94a3b8;
}

.chat-icon {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.send-button {
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  background: var(--color-primary, #4CAF50);
  transition: background-color 0.18s ease, transform 0.15s ease;
  touch-action: manipulation;
  user-select: none;
}

.send-button .chat-icon {
  width: 18px;
  height: 18px;
}

.send-button:hover:not(:disabled) {
  background: var(--color-primary-dark, #45a049);
}

.send-button:disabled {
  background: #c5ccd3;
  cursor: not-allowed;
}

.send-button.recording {
  background: #334155;
  animation: record-pulse 1.2s ease-in-out infinite;
}

.send-button.recording--video {
  background: #1e293b;
}

.send-icon {
  margin-left: 2px;
}

@keyframes record-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.attachment-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 2px 0;
  max-height: 200px;
  overflow-y: auto;
  flex-shrink: 0;
}

.preview-item {
  position: relative;
  display: flex;
  align-items: center;
  background-color: var(--color-light);
  border-radius: var(--radius-md);
  padding: 4px 8px;
  font-size: var(--font-size-sm);
}

.image-preview {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  margin-right: 8px;
}

.audio-preview,
.video-preview,
.file-preview {
  display: flex;
  align-items: center;
  gap: 5px;
}

.remove-attachment-btn {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 18px;
  height: 18px;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  padding: 0;
}

@media (min-width: 1025px) {
  .chat-messages,
  .chat-input {
    width: 100% !important;
    max-width: var(--chat-column-width);
    margin-left: auto;
    margin-right: auto;
  }

  .chat-container--embedded {
    --chat-column-width: 720px;
  }
}

@media (max-width: 768px) {
  .chat-container--embedded,
  .chat-container {
    margin: 0;
  }

  .chat-container .chat-input {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 200;
    background: #fff;
  }

  .chat-container .chat-messages {
    padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  }
}

.ai-spinner {
  animation: ai-spin 1s linear infinite;
}

.ai-spinner circle {
  stroke: currentColor;
  stroke-dasharray: 42;
  stroke-dashoffset: 12;
}

@keyframes ai-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.selected-message {
  background: #e6f7ff;
}
.admin-select-checkbox {
  margin-right: 8px;
}

/* Стили для приватного чата */
.message-wrapper {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
}

/* Для приватного чата выравниваем сообщения по сторонам */
.chat-messages:has(.private-current-user) .message-wrapper {
  justify-content: flex-end;
}

.chat-messages:has(.private-other-user) .message-wrapper {
  justify-content: flex-start;
}
</style> 