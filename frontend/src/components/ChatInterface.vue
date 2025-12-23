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
  <div class="chat-container" :style="{ '--chat-input-height': chatInputHeight + 'px' }">
    <!-- Блок истории сообщений -->
    <div 
      ref="messagesContainer" 
      class="chat-messages" 
      :style="{ width: messagesWidth + '%' }"
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

    <!-- Разделитель для изменения размера -->
    <div 
      class="resizer"
      @mousedown="startResize"
      @touchstart="startResize"
    ></div>

    <!-- Блок ввода сообщений -->
    <div 
      ref="chatInputRef" 
      class="chat-input"
      :style="{ width: inputWidth + '%' }"
    >
      <div class="input-area">
        <textarea
          ref="messageInputRef"
          :value="newMessage"
          @input="handleInput"
          placeholder="Введите сообщение..."
          :disabled="isLoading || !props.canSend"
          autofocus
          @keydown.enter.prevent="sendMessage"
          @focus="handleFocus"
          @blur="handleBlur"
        />
      </div>
      <div class="chat-icons">
        <button 
          class="chat-icon-btn" 
          title="Удерживайте для записи аудио" 
          @mousedown="startAudioRecording" 
          @mouseup="stopAudioRecording"
          @mouseleave="stopAudioRecording"
          :class="{ 'recording': isAudioRecording }"
          :disabled="!props.canSend"
        >
          <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="currentColor"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="currentColor"/>
          </svg>
        </button>
        <button 
          class="chat-icon-btn" 
          title="Удерживайте для записи видео" 
          @mousedown="startVideoRecording" 
          @mouseup="stopVideoRecording"
          @mouseleave="stopVideoRecording"
          :class="{ 'recording': isVideoRecording }"
          :disabled="!props.canSend"
        >
          <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" fill="currentColor"/>
          </svg>
        </button>
        <button class="chat-icon-btn" title="Прикрепить файл" @click="handleFileUpload" :disabled="!props.canSend">
          <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
            <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" fill="currentColor"/>
          </svg>
        </button>
        <button class="chat-icon-btn" title="Клавиатура" @click="handleKeyboardToggle">
          <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
            <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" fill="currentColor"/>
          </svg>
        </button>
        <button class="chat-icon-btn" title="Очистить поле ввода" @click="clearInput">
          <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
          </svg>
        </button>
        <button 
          class="chat-icon-btn send-button" 
          title="Отправить сообщение" 
          :disabled="isSendDisabled" 
          @click="sendMessage"
        >
          <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
            <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" fill="currentColor"/>
          </svg>
        </button>
        <button v-if="props.canGenerateAI" class="chat-icon-btn ai-reply-btn" title="Сгенерировать ответ ІІ" @click="handleAiReply" :disabled="isAiLoading">
          <template v-if="isAiLoading">
            <svg class="ai-spinner" width="22" height="22" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg>
          </template>
          <template v-else>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="8" r="4"/><path d="M8 16v2M16 16v2"/></svg>
          </template>
        </button>
      </div>
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
    </div>
    
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import Message from './Message.vue';
import messagesService from '../services/messagesService.js';

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
  currentUserId: { type: [String, Number], default: null } // ID текущего пользователя
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
const chatInputRef = ref(null); // Ref для chat-input
const chatInputHeight = ref(80); // Начальная высота (можно подобрать точнее)

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
  nextTick(updateChatInputHeight); // Обновляем высоту после добавления превью
};

const removeAttachment = (index) => {
  const attachment = localAttachments.value[index];
  if (attachment.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
  const updatedAttachments = localAttachments.value.filter((_, i) => i !== index);
  localAttachments.value = updatedAttachments; // Обновляем локальное состояние
  emit('update:attachments', updatedAttachments); // Обновляем состояние в родителе
  nextTick(updateChatInputHeight); // Обновляем высоту после удаления превью
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
  // Показываем виртуальную клавиатуру или переключаем режим
  if (messageInputRef.value) {
    messageInputRef.value.focus();
  }
};

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
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
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

const handleFocus = () => {
  // Логика добавления класса 'focused' удалена, т.к. высота управляется ResizeObserver
  // Можно добавить другую логику при фокусе, если нужно
};

const handleBlur = () => {
  // Логика удаления класса 'focused' удалена
  // Можно добавить другую логику при потере фокуса, если нужно
};

// Форматирование размера файла
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Байт';
  const k = 1024;
  const sizes = ['Байт', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// --- Автоматическое изменение высоты textarea ---
const adjustTextareaHeight = () => {
  const textarea = messageInputRef.value;
  if (textarea) {
    textarea.style.height = 'auto'; // Сброс высоты для пересчета
    const scrollHeight = textarea.scrollHeight;
    // Ограничиваем максимальную высоту (соответствует max-height в CSS)
    const newHeight = Math.min(scrollHeight, 120);
    textarea.style.height = `${newHeight}px`;
    // Высота родительского блока (.chat-input) обновится через ResizeObserver
    // nextTick(updateChatInputHeight); // Убрано отсюда
  }
};

// Вызываем при изменении текста
const handleInput = (event) => {
  emit('update:newMessage', event.target.value);
  adjustTextareaHeight();
  // Явно вызовем обновление высоты родителя после изменения textarea
  // Это может быть надежнее, чем полагаться только на ResizeObserver в некоторых случаях
  nextTick(updateChatInputHeight);
};

// --- Динамическое изменение высоты ---
let resizeObserver;

const updateChatInputHeight = () => {
  if (chatInputRef.value) {
    chatInputHeight.value = chatInputRef.value.offsetHeight;
  }
};

onMounted(() => {
  // Проверяем мобильное устройство и устанавливаем ширину
  checkMobile();
  window.addEventListener('resize', checkMobile);
  
  // Начальная установка высоты textarea и блока ввода
  adjustTextareaHeight();
  updateChatInputHeight();

  if (chatInputRef.value) {
    resizeObserver = new ResizeObserver(updateChatInputHeight);
    resizeObserver.observe(chatInputRef.value);
  }
  // Убедимся, что высота input установлена после монтирования
  nextTick(updateChatInputHeight);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
  
  if (resizeObserver && chatInputRef.value) {
    resizeObserver.unobserve(chatInputRef.value);
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

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
      message: 'Не удалось сгенерировать ответ ИИ. Попробуйте еще раз.',
      details: e.message
    });
  } finally {
    isAiLoading.value = false;
  }
}

</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: row;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  position: relative;
  overflow: hidden;
  gap: 0;
}

/* На мобильных устройствах возвращаем вертикальный layout */
@media (max-width: 1024px) {
  .chat-container {
    flex-direction: column;
  }
}

.chat-messages {
  flex: 0 0 auto;
  overflow-y: auto;
  position: relative;
  padding: var(--spacing-md) var(--spacing-md);
  min-height: 0;
  background-color: #ffffff;
  border-right: none;
  /* Скрываем скроллбар, но сохраняем функциональность скролла */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE и Edge */
  transition: width 0.1s ease;
}

.chat-messages::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

/* На мобильных устройствах история занимает всё пространство */
@media (max-width: 1024px) {
  .chat-messages {
    flex: 1 1 auto;
    width: 100% !important;
    border-right: none;
    padding: var(--spacing-md) var(--spacing-md) 8px;
    /* Скрываем скроллбар и на мобильных */
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  .chat-messages::-webkit-scrollbar {
    display: none;
  }
  
  .resizer {
    display: none;
  }
  
  .chat-input {
    width: 100% !important;
  }
}

.resizer {
  width: 4px;
  flex-shrink: 0;
  background-color: transparent;
  cursor: col-resize;
  position: relative;
  user-select: none;
  transition: background-color 0.2s ease;
}

.resizer:hover {
  background-color: var(--color-primary, #4CAF50);
}

.resizer::before {
  content: '';
  position: absolute;
  left: -2px;
  right: -2px;
  top: 0;
  bottom: 0;
  background-color: transparent;
}

.chat-input {
  position: relative;
  flex: 0 0 auto;
  margin: 0;
  left: 0;
  right: 0;
  border-radius: 0;
  min-height: 80px;
  height: 100%;
  padding: var(--spacing-md) var(--spacing-md) 0;
  box-sizing: border-box;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.1s ease;
}

/* На мобильных устройствах блок ввода занимает всё пространство внизу */
@media (max-width: 1024px) {
  .chat-input {
    width: 100% !important;
    max-width: 100% !important;
    height: auto;
    border-top: none;
    border-right: none;
  }
}




.chat-input textarea {
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  border: none;
  background: #f5f5f5;
  border-radius: 12px;
  resize: none;
  outline: none;
  font-size: var(--font-size-md);
  line-height: 1.5;
  padding: 16px;
  margin: 0;
  transition: all var(--transition-fast);
  color: var(--color-dark);
  overflow-y: auto;
  box-sizing: border-box;
  max-width: 100%;
}

.chat-input textarea:focus {
  outline: none;
  border: none;
  background: #f5f5f5;
}

/* На мобильных устройствах поле ввода меньше */
@media (max-width: 1024px) {
  .chat-input textarea {
    width: 100% !important;
    max-width: 100% !important;
    border-radius: 20px;
    padding: 12px 16px;
    min-height: var(--chat-input-min-height, 40px);
    max-height: var(--chat-input-max-height, 120px);
    overflow-y: hidden;
    resize: none;
    box-sizing: border-box;
  }
}

.input-area {
  display: flex;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  box-sizing: border-box;
  flex-direction: column;
}

.chat-icons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  flex-shrink: 0;
  margin: 0;
  margin-top: 0;
  width: 100%;
  padding: var(--spacing-sm) 0;
  border-top: none;
}

.chat-icon-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 8px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-dark, #333);
  transition: all 0.2s ease;
  position: relative;
  font-weight: 500;
  flex-shrink: 0;
}

.chat-icon-btn svg {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.chat-icon-btn:hover:not(:disabled) {
  color: var(--color-primary);
  background-color: #ffffff;
  border-color: var(--color-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chat-icon-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.chat-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f5f5f5;
  border-color: #e0e0e0;
}

.chat-icon-btn.send-button {
  background-color: var(--color-primary, #4CAF50);
  color: white;
  border-color: var(--color-primary, #4CAF50);
  font-weight: 600;
  width: 40px;
  height: 40px;
}

.chat-icon-btn.send-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark, #45a049);
  border-color: var(--color-primary-dark, #45a049);
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(76, 175, 80, 0.3);
}

.chat-icon-btn.send-button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(76, 175, 80, 0.2);
}

.chat-icon-btn.send-button:disabled {
  background-color: #ccc;
  border-color: #ccc;
  opacity: 0.7;
}

.chat-icon-btn.recording {
  color: var(--color-danger);
  animation: pulse 1.5s infinite;
}

.chat-icon-btn.recording::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: var(--color-danger);
  border-radius: 50%;
  top: 2px;
  right: 2px;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.attachment-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--color-grey-light);
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

/* Добавляем адаптивные стили для мобильных устройств */
@media (max-width: 768px) {
  .chat-container {
    margin: var(--spacing-sm) auto;
  }
  
  .chat-messages {
    padding: var(--spacing-md) var(--spacing-md) 8px;
    width: 100% !important;
  }
  
  .chat-input {
    width: 100% !important;
    max-width: 100% !important;
    padding: var(--spacing-xs) var(--spacing-sm);
    height: auto;
    box-sizing: border-box;
  }
  
  .input-area {
    width: 100% !important;
    box-sizing: border-box;
  }
  
  .input-area textarea {
    width: 100% !important;
    box-sizing: border-box;
  }
  
  .chat-icon-btn {
    width: 32px;
    height: 32px;
  }
  
  .chat-icon-btn svg {
    width: 20px;
    height: 20px;
  }
  
  .resizer {
    display: none;
  }
}

@media (max-width: 480px) {
  .chat-input {
    width: 100% !important;
    max-width: 100% !important;
    position: sticky !important;
    bottom: 0 !important;
    border-radius: 0 !important;
    padding: 8px 12px !important;
    background: #f8f8f8 !important;
    border-top: 1px solid #eee !important;
  }
  
  .chat-messages {
    width: 100% !important;
    padding: var(--spacing-md) var(--spacing-md) 8px !important;
    overflow-y: auto !important;
  }
  
  .input-area {
    width: 100% !important;
  }
  
  .input-area textarea {
    width: 100% !important;
    box-sizing: border-box;
  }
}

@media (max-width: 600px) {
  .chat-input {
    width: 100% !important;
    max-width: 100% !important;
    position: sticky !important;
    bottom: 0 !important;
    border-radius: 0 !important;
    padding: 8px 12px !important;
    background: #f8f8f8 !important;
    border-top: 1px solid #eee !important;
  }
  
  .chat-messages {
    width: 100% !important;
    padding: var(--spacing-md) var(--spacing-md) 8px !important;
    overflow-y: auto !important;
  }
  .chat-container {
    height: 100% !important;
  }
}

.input-area textarea {
  flex: 1 1 0%;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.ai-spinner {
  animation: ai-spin 1s linear infinite;
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