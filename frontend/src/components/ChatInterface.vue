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
  <div class="chat-container" :style="{ '--chat-input-height': chatInputHeight + 'px' }">
    <div ref="messagesContainer" class="chat-messages" @scroll="handleScroll">
      <div v-for="message in messages" :key="message.id" :class="['message-wrapper', { 'selected-message': selectedMessageIds.includes(message.id) }]">
        <template v-if="props.canSelectMessages">
          <input type="checkbox" class="admin-select-checkbox" :checked="selectedMessageIds.includes(message.id)" @change="() => toggleSelectMessage(message.id)" />
        </template>
        <Message 
          :message="message" 
          :isPrivateChat="isPrivateChat"
          :currentUserId="currentUserId"
        />
      </div>
    </div>

    <div ref="chatInputRef" class="chat-input">
      <div class="input-area">
        <textarea
          ref="messageInputRef"
          :value="newMessage"
          @input="handleInput"
          placeholder="Введите сообщение..."
          :disabled="isLoading || !props.canSend"
          rows="1"
          autofocus
          @keydown.enter.prevent="sendMessage"
          @focus="handleFocus"
          @blur="handleBlur"
        />
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
]);

const messagesContainer = ref(null);
const messageInputRef = ref(null);
const chatInputRef = ref(null); // Ref для chat-input
const chatInputHeight = ref(80); // Начальная высота (можно подобрать точнее)

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
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  min-height: 0;
  position: relative;
}

.chat-messages {
  flex: 1 1 auto;
  overflow-y: auto;
  position: relative;
  padding-bottom: 8px;
}

.chat-input {
  position: relative;
  width: 100%;
  margin-bottom: 12px;
  margin-top: 8px;
  left: 0;
  right: 0;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  min-height: 500px;
  width: 100%;
  position: relative;
  background: transparent;
  height: 100%;
}

.chat-messages {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: var(--spacing-lg);
  background: transparent;
  border-radius: 0;
  border: none;
  flex: 1;
  min-height: 0;
}

.chat-input {
  display: flex;
  flex-direction: column;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-white);
  border-radius: 0;
  border: none;
  border-top: 1px solid #e9ecef;
  flex-shrink: 0;
  transition: all var(--transition-normal);
  z-index: 10;
  box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.05);
  position: sticky;
  bottom: 0;
}

.chat-input textarea {
  width: 100%;
  border: none;
  background: transparent;
  resize: none;
  outline: none;
  font-size: var(--font-size-md);
  line-height: 1.5;
  padding: var(--spacing-sm);
  min-height: var(--chat-input-min-height, 40px);
  max-height: var(--chat-input-max-height, 120px);
  transition: all var(--transition-fast);
  color: var(--color-dark);
  overflow-y: hidden;
  height: auto;
}

.chat-input textarea:focus {
  outline: none;
}

.input-area {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-sm);
  width: 100%;
}

.chat-icons {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
  align-items: center;
}

.chat-icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-grey);
  padding: 0;
  position: relative;
}

.chat-icon-btn:hover {
  color: var(--color-primary);
  background-color: rgba(0, 0, 0, 0.05);
}

.chat-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-icon-btn.send-button {
  background-color: var(--color-primary);
  color: white;
  width: 36px;
  height: 36px;
}

.chat-icon-btn.send-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  color: white;
  transform: scale(1.05);
}

.chat-icon-btn.send-button:disabled {
  background-color: #ccc;
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
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-grey-light);
  max-height: 100px;
  overflow-y: auto;
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
    padding: var(--spacing-md);
  }
  
  .chat-input {
    padding: var(--spacing-xs) var(--spacing-sm);
  }
  
  .chat-icon-btn {
    width: 32px;
    height: 32px;
  }
  
  .chat-icon-btn svg {
    width: 20px;
    height: 20px;
  }
}

@media (max-width: 480px) {
  .chat-input {
    position: sticky !important;
    bottom: 0 !important;
    border-radius: 0 !important;
    padding: 8px 12px !important;
    background: #f8f8f8 !important;
    border-top: 1px solid #eee !important;
  }
  .chat-messages {
    padding: var(--spacing-md) !important;
    overflow-y: auto !important;
  }
}

@media (max-width: 600px) {
  .chat-input {
    position: sticky !important;
    bottom: 0 !important;
    border-radius: 0 !important;
    padding: 8px 12px !important;
    background: #f8f8f8 !important;
    border-top: 1px solid #eee !important;
  }
  .chat-messages {
    padding: var(--spacing-md) !important;
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