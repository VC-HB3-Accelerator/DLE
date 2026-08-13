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
      <div class="chat-messages-inner">
      <div v-for="message in messages" :key="message.id" :class="['message-wrapper', { 'selected-message': selectedMessageIds.includes(message.id) }]">
        <template v-if="props.canSelectMessages">
          <input type="checkbox" class="admin-select-checkbox" :checked="selectedMessageIds.includes(message.id)" @change="() => toggleSelectMessage(message.id)" />
        </template>
        <Message 
          :message="message" 
          :isPrivateChat="isPrivateChat"
          :currentUserId="currentUserId"
          @consent-granted="handleConsentGranted"
          @cms-branch="handleCmsBranch"
        />
      </div>
      </div>
    </div>

    <!-- Блок ввода сообщений -->
    <div
      ref="chatInputRef"
      class="chat-input"
      :style="panelWidthStyle(inputWidth)"
    >
      <div class="attachment-preview" v-if="localAttachments.length > 0">
        <div
          v-for="(file, index) in localAttachments"
          :key="index"
          class="preview-item"
          :class="{
            'preview-item--video-note': file.kind === 'video_note',
            'preview-item--voice': file.kind === 'audio' || (file.type && file.type.startsWith('audio/')),
          }"
        >
          <img v-if="file.type.startsWith('image/')" :src="file.previewUrl" class="image-preview"/>
          <VoiceMessageBubble
            v-else-if="(file.kind === 'audio' || (file.type && file.type.startsWith('audio/'))) && file.previewUrl"
            :src="file.previewUrl"
            :play-label="t('chat.playVoice')"
          />
          <VideoNoteBubble
            v-else-if="file.kind === 'video_note' && file.previewUrl"
            :src="file.previewUrl"
            :size="64"
            :play-label="t('chat.playVideoNote')"
          />
          <video v-else-if="file.type.startsWith('video/') && file.previewUrl" :src="file.previewUrl" class="video-preview" muted playsinline />
          <div v-else class="file-preview">
            <span>&#128196; {{ file.name }} ({{ formatFileSize(file.size) }})</span>
          </div>
          <button @click="removeAttachment(index)" class="remove-attachment-btn">×</button>
        </div>
      </div>

      <div v-if="isAudioRecording || isVideoRecording" class="record-status">
        <div v-if="isVideoRecording" class="video-note-live" aria-hidden="true">
          <video
            ref="videoPreviewRef"
            class="video-note-live__media"
            autoplay
            muted
            playsinline
            webkit-playsinline
          />
          <span class="video-note-live__ring" />
        </div>
        <div v-else-if="isAudioRecording" class="voice-live" aria-hidden="true">
          <span
            v-for="(h, i) in audioLiveBars"
            :key="i"
            class="voice-live__bar"
            :style="{ height: `${h}%` }"
          />
        </div>
        <div class="record-status__text">
          <span>{{ isVideoRecording ? t('chat.recordingVideo') : t('chat.recordingAudio') }}</span>
          <button type="button" class="record-cancel-btn" @click="cancelRecording">{{ t('chat.cancelRecord') }}</button>
        </div>
      </div>

      <div class="chat-compose-row">
        <div class="input-shell" :class="{ 'input-shell--multiline': isMultilineInput }">
          <button
            v-if="props.canAttach && chatCaps.send_file"
            type="button"
            class="attach-btn"
            :title="t('chat.attachFile')"
            :disabled="!props.canSend || isAudioRecording || isVideoRecording"
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
            :disabled="isLoading || !props.canSend || isAudioRecording || isVideoRecording"
            autofocus
            rows="1"
            @keydown.enter="onEnterKey"
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
          <div ref="slotClusterRef" class="slot-cluster">
            <Teleport to="body">
              <div
                v-if="plusOpen"
                ref="plusWidgetRef"
                class="plus-widget"
                :style="plusWidgetStyle"
                role="menu"
              >
              <button
                v-for="mode in widgetModes"
                :key="mode"
                type="button"
                class="plus-widget__btn"
                :title="slotTitle(mode)"
                role="menuitem"
                @click="selectSlotMode(mode)"
              >
                <svg v-if="mode === 'send'" class="chat-icon send-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22 2 11 13" />
                  <path d="M22 2 15 22 11 13 2 9 22 2z" />
                </svg>
                <svg v-else-if="mode === 'audio'" class="chat-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                </svg>
                <svg v-else-if="mode === 'video_note'" class="chat-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M10 8.5v7l6-3.5-6-3.5z" fill="currentColor" stroke="none" />
                </svg>
                <svg v-else class="chat-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.68 2.35a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.75.32 1.54.55 2.35.68A2 2 0 0 1 22 16.92z" />
                </svg>
              </button>
              </div>
            </Teleport>
            <button
              v-if="showPlusButton"
              type="button"
              class="plus-button"
              :title="t('chat.composerPlus')"
              :disabled="!props.canSend || isAudioRecording || isVideoRecording"
              :aria-expanded="plusOpen"
              @click.stop="togglePlus"
            >
              <svg class="chat-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </button>
            <button
              type="button"
              class="send-button"
              :class="{
                recording: isAudioRecording || isVideoRecording,
                'recording--video': isVideoRecording,
                'send-button--mode': slotMode !== 'send',
              }"
              :title="slotTitle(slotMode)"
              :disabled="slotButtonDisabled"
              @mousedown.prevent="onSlotPointerDown"
              @touchstart.prevent="onSlotPointerDown"
              @contextmenu.prevent
            >
              <svg v-if="slotIconMode === 'audio'" class="chat-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              </svg>
              <svg v-else-if="slotIconMode === 'video_note'" class="chat-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M10 8.5v7l6-3.5-6-3.5z" fill="currentColor" stroke="none" />
              </svg>
              <svg v-else-if="slotIconMode === 'phone'" class="chat-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.68 2.35a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.75.32 1.54.55 2.35.68A2 2 0 0 1 22 16.92z" />
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
    
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import Message from './Message.vue';
import VoiceMessageBubble from './chat/VoiceMessageBubble.vue';
import VideoNoteBubble from './chat/VideoNoteBubble.vue';
import messagesService from '../services/messagesService.js';
import api from '@/api/axios';
import { useAuthContext } from '@/composables/useAuth';
import { cloneDefaultCaps } from '@/shared/chatRoleCaps.js';
import {
  MEDIA_MAX_BYTES,
  VIDEO_NOTE_MAX_SECONDS,
  AUDIO_MAX_SECONDS,
  ATTACHMENT_KINDS,
  detectAttachmentKind,
  isMediaTooLarge
} from '@/shared/mediaLimits.js';

const { t } = useI18n();
const { isAuthenticated, userAccessLevel } = useAuthContext();
const chatCaps = ref(cloneDefaultCaps());

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
  canAttach: { type: Boolean, default: true },         // Может прикреплять файлы
  
  // Props для приватного чата
  isPrivateChat: { type: Boolean, default: false },    // Это приватный чат
  currentUserId: { type: [String, Number], default: null }, // ID текущего пользователя
  embedded: { type: Boolean, default: false }, // Встроенный режим: лента сверху, ввод снизу
  clearOnSend: { type: Boolean, default: true } // очищать поле после emit send-message
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
const slotClusterRef = ref(null);
const plusWidgetRef = ref(null);
const plusWidgetStyle = ref({});
const SLOT_MODES = ['send', 'audio', 'video_note', 'phone'];
const slotMode = ref('send');
const plusOpen = ref(false);
const HOLD_MS = 220;
const RECORD_MIN_MS = 800;
let slotHoldTimer = null;
let slotHoldActive = false;
let pendingAutoSend = false;
let recordingStartPending = false;
let recordStartedAt = 0;

function panelWidthStyle() {
  return undefined;
}

function handleConsentGranted(messageId) {
  // После подписания удаляем системное сообщение о необходимости согласия
  emit('remove-consent-messages', [messageId]);
}

function handleCmsBranch({ payload, branch }) {
  if (!payload) return;
  const assignTags = Array.isArray(branch?.assign_tags)
    ? branch.assign_tags
    : (Array.isArray(branch?.assignTags) ? branch.assignTags : []);
  emit('send-message', {
    message: payload,
    attachments: [],
    assign_tags: assignTags,
  });
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
const videoPreviewRef = ref(null);
const recordedAudioChunks = ref([]);
const recordedVideoChunks = ref([]);
const AUDIO_LIVE_BAR_COUNT = 24;
const audioLiveBars = ref(Array(AUDIO_LIVE_BAR_COUNT).fill(18));
let discardAudioOnStop = false;
let discardVideoOnStop = false;
let recordLimitTimer = null;
let audioMeterCtx = null;
let audioAnalyser = null;
let audioMeterRaf = 0;
let audioMeterData = null;

function clearRecordLimitTimer() {
  if (recordLimitTimer) {
    clearTimeout(recordLimitTimer);
    recordLimitTimer = null;
  }
}

function stopAudioMeter() {
  if (audioMeterRaf) {
    cancelAnimationFrame(audioMeterRaf);
    audioMeterRaf = 0;
  }
  audioAnalyser = null;
  audioMeterData = null;
  if (audioMeterCtx) {
    try { audioMeterCtx.close(); } catch (_) { /* ignore */ }
    audioMeterCtx = null;
  }
  audioLiveBars.value = Array(AUDIO_LIVE_BAR_COUNT).fill(18);
}

function startAudioMeter(stream) {
  stopAudioMeter();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || !stream) return;
  try {
    audioMeterCtx = new AC();
    const source = audioMeterCtx.createMediaStreamSource(stream);
    audioAnalyser = audioMeterCtx.createAnalyser();
    audioAnalyser.fftSize = 64;
    audioAnalyser.smoothingTimeConstant = 0.72;
    // только анализ, без вывода в динамики (иначе feedback)
    source.connect(audioAnalyser);
    audioMeterData = new Uint8Array(audioAnalyser.frequencyBinCount);
    if (audioMeterCtx.state === 'suspended') {
      audioMeterCtx.resume().catch(() => {});
    }

    const tick = () => {
      if (!audioAnalyser || !audioMeterData) return;
      audioAnalyser.getByteFrequencyData(audioMeterData);
      const n = AUDIO_LIVE_BAR_COUNT;
      const step = Math.max(1, Math.floor(audioMeterData.length / n));
      const out = [];
      for (let i = 0; i < n; i += 1) {
        let sum = 0;
        for (let j = 0; j < step; j += 1) sum += audioMeterData[i * step + j] || 0;
        const avg = sum / step;
        out.push(14 + Math.round((avg / 255) * 86));
      }
      audioLiveBars.value = out;
      audioMeterRaf = requestAnimationFrame(tick);
    };
    audioMeterRaf = requestAnimationFrame(tick);
  } catch (_) {
    stopAudioMeter();
  }
}

function detachVideoPreview() {
  const el = videoPreviewRef.value;
  if (!el) return;
  try { el.pause(); } catch (_) { /* ignore */ }
  el.srcObject = null;
}

async function attachVideoPreview(stream) {
  await nextTick();
  const el = videoPreviewRef.value;
  if (!el || !stream) return;
  el.srcObject = stream;
  el.muted = true;
  try {
    await el.play();
  } catch (_) {
    /* muted + playsinline обычно хватает для autoplay */
  }
}

function stopMediaStream(streamRef) {
  if (streamRef === videoStream) detachVideoPreview();
  if (streamRef === audioStream) stopAudioMeter();
  if (streamRef.value) {
    streamRef.value.getTracks().forEach((track) => track.stop());
    streamRef.value = null;
  }
}

function showMediaError(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    ElMessage.error(t('chat.mediaPermissionDenied'));
    return;
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    ElMessage.error(t('chat.mediaDeviceMissing'));
    return;
  }
  ElMessage.error(t('chat.mediaRecordError'));
}

const startAudioRecording = async () => {
  try {
    if (isAudioRecording.value) return;
    discardAudioOnStop = false;
    recordingStartPending = true;
    audioStream.value = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!recordingStartPending) {
      stopMediaStream(audioStream);
      return;
    }
    recordedAudioChunks.value = [];
    audioRecorder.value = new MediaRecorder(audioStream.value);
    audioRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) recordedAudioChunks.value.push(event.data);
    };
    audioRecorder.value.onstop = () => {
      stopMediaStream(audioStream);
      isAudioRecording.value = false;
      clearRecordLimitTimer();
      if (discardAudioOnStop) {
        recordedAudioChunks.value = [];
        discardAudioOnStop = false;
        return;
      }
      if (Date.now() - recordStartedAt < RECORD_MIN_MS) {
        recordedAudioChunks.value = [];
        return;
      }
      if (recordedAudioChunks.value.length === 0) return;
      const audioBlob = new Blob(recordedAudioChunks.value, { type: 'audio/webm' });
      const audioFile = new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
      addAttachment(audioFile, ATTACHMENT_KINDS.AUDIO);
      recordedAudioChunks.value = [];
      maybeAutoSendRecord();
    };
    audioRecorder.value.start();
    isAudioRecording.value = true;
    recordingStartPending = false;
    recordStartedAt = Date.now();
    startAudioMeter(audioStream.value);
    clearRecordLimitTimer();
    recordLimitTimer = setTimeout(() => {
      stopAudioRecording({ discard: false });
    }, AUDIO_MAX_SECONDS * 1000);
  } catch (error) {
    recordingStartPending = false;
    pendingAutoSend = false;
    showMediaError(error);
  }
};

const stopAudioRecording = async ({ discard = false } = {}) => {
  if (discard) discardAudioOnStop = true;
  if (!isAudioRecording.value || !audioRecorder.value || audioRecorder.value.state === 'inactive') {
    stopMediaStream(audioStream);
    isAudioRecording.value = false;
    return;
  }
  try {
    audioRecorder.value.stop();
  } catch (_) {
    isAudioRecording.value = false;
    stopMediaStream(audioStream);
  }
};

const startVideoRecording = async () => {
  try {
    if (isVideoRecording.value) return;
    discardVideoOnStop = false;
    recordingStartPending = true;
    videoStream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: true
    });
    if (!recordingStartPending) {
      stopMediaStream(videoStream);
      return;
    }
    recordedVideoChunks.value = [];
    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = {};
        }
      }
    }
    videoRecorder.value = new MediaRecorder(videoStream.value, options);
    videoRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) recordedVideoChunks.value.push(event.data);
    };
    videoRecorder.value.onstop = () => {
      stopMediaStream(videoStream);
      isVideoRecording.value = false;
      clearRecordLimitTimer();
      if (discardVideoOnStop) {
        recordedVideoChunks.value = [];
        discardVideoOnStop = false;
        return;
      }
      if (Date.now() - recordStartedAt < RECORD_MIN_MS) {
        recordedVideoChunks.value = [];
        return;
      }
      if (recordedVideoChunks.value.length === 0) return;
      const mime = videoRecorder.value.mimeType || 'video/webm';
      const videoBlob = new Blob(recordedVideoChunks.value, { type: mime });
      const videoFile = new File([videoBlob], `video-note-${Date.now()}.webm`, { type: mime });
      addAttachment(videoFile, ATTACHMENT_KINDS.VIDEO_NOTE);
      recordedVideoChunks.value = [];
      maybeAutoSendRecord();
    };
    videoRecorder.value.start();
    isVideoRecording.value = true;
    recordingStartPending = false;
    recordStartedAt = Date.now();
    await attachVideoPreview(videoStream.value);
    clearRecordLimitTimer();
    recordLimitTimer = setTimeout(() => {
      stopVideoRecording();
    }, VIDEO_NOTE_MAX_SECONDS * 1000);
  } catch (error) {
    recordingStartPending = false;
    pendingAutoSend = false;
    showMediaError(error);
  }
};

const stopVideoRecording = async ({ discard = false } = {}) => {
  if (discard) discardVideoOnStop = true;
  if (!isVideoRecording.value || !videoRecorder.value || videoRecorder.value.state === 'inactive') {
    stopMediaStream(videoStream);
    isVideoRecording.value = false;
    return;
  }
  try {
    videoRecorder.value.stop();
  } catch (_) {
    isVideoRecording.value = false;
    stopMediaStream(videoStream);
  }
};

const handleFileUpload = () => {
  if (!props.canAttach || !props.canSend || !chatCaps.value.send_file) return;
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = false;
  fileInput.accept = '.txt,.pdf,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.ogg,.webm,.m4a,.mp4,.avi,.mov,.docx,.xlsx,.pptx,.odt,.ods,.odp,.zip,.rar,.7z,audio/*,video/*,image/*';
  fileInput.onchange = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      addAttachment(files[0]);
    }
  };
  fileInput.click();
};

const addAttachment = (file, kindHint = '') => {
  if (isMediaTooLarge(file.size)) {
    ElMessage.error(t('chat.mediaTooLarge', { max: Math.round(MEDIA_MAX_BYTES / (1024 * 1024)) }));
    return;
  }
  const kind = detectAttachmentKind({
    filename: file.name,
    mimetype: file.type,
    hint: kindHint
  });
  if (localAttachments.value.length > 0) {
    localAttachments.value.forEach((att) => {
      if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
    });
  }
  const attachment = {
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    kind,
    previewUrl: null
  };
  if (file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type.startsWith('video/')) {
    attachment.previewUrl = URL.createObjectURL(file);
  }
  const updatedAttachments = [attachment];
  localAttachments.value = updatedAttachments;
  emit('update:attachments', updatedAttachments);
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

const isSendDisabled = computed(() => {
  if (props.isLoading || !props.canSend) return true;
  if (localAttachments.value.length > 0) return false;
  if (!chatCaps.value.send_text) return true;
  return !String(props.newMessage || '').trim();
});

function isModeAllowed(mode) {
  if (mode === 'send') return true;
  if (!props.canAttach) return false;
  if (mode === 'audio') return chatCaps.value.send_audio;
  if (mode === 'video_note') return chatCaps.value.send_video;
  if (mode === 'phone') return chatCaps.value.send_call;
  return false;
}

const widgetModes = computed(() => SLOT_MODES.filter((mode) => mode !== slotMode.value && isModeAllowed(mode)));
const showPlusButton = computed(() => widgetModes.value.length > 0);
const slotIconMode = computed(() => {
  if (isVideoRecording.value) return 'video_note';
  if (isAudioRecording.value) return 'audio';
  return slotMode.value;
});
const slotButtonDisabled = computed(() => {
  if (!props.canSend || props.isLoading) return true;
  if (slotMode.value === 'send') return isSendDisabled.value;
  if (slotMode.value === 'audio') return !chatCaps.value.send_audio;
  if (slotMode.value === 'video_note') return !chatCaps.value.send_video;
  if (slotMode.value === 'phone') return !chatCaps.value.send_call;
  return false;
});

function slotTitle(mode) {
  if (mode === 'audio') return t('chat.composerAudio');
  if (mode === 'video_note') return t('chat.composerVideoNote');
  if (mode === 'phone') return t('chat.composerCall');
  return t('chat.sendMessage');
}

function updatePlusWidgetPos() {
  const el = slotClusterRef.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  plusWidgetStyle.value = {
    right: `${Math.max(8, window.innerWidth - r.right)}px`,
    bottom: `${Math.max(8, window.innerHeight - r.top + 8)}px`
  };
}

function unbindPlusOutside() {
  document.removeEventListener('mousedown', closePlusFromOutside);
}

function togglePlus() {
  if (isAudioRecording.value || isVideoRecording.value) return;
  plusOpen.value = !plusOpen.value;
  if (plusOpen.value) {
    nextTick(() => {
      updatePlusWidgetPos();
      document.addEventListener('mousedown', closePlusFromOutside);
    });
  } else {
    unbindPlusOutside();
  }
}

function selectSlotMode(mode) {
  plusOpen.value = false;
  unbindPlusOutside();
  if (localAttachments.value.length > 0 && mode !== 'send') {
    ElMessage.warning(t('chat.removeFileBeforeRecord'));
    return;
  }
  if (mode === 'phone') {
    ElMessage.info(t('chat.callInDevelopment'));
    slotMode.value = 'send';
    return;
  }
  slotMode.value = mode;
}

function closePlusFromOutside(event) {
  if (!plusOpen.value) return;
  if (slotClusterRef.value?.contains(event.target)) return;
  if (plusWidgetRef.value?.contains(event.target)) return;
  plusOpen.value = false;
  unbindPlusOutside();
}

function onComposerKeydown(event) {
  if (event.key === 'Escape') {
    plusOpen.value = false;
    unbindPlusOutside();
  }
}

function resetSlotAfterMedia() {
  slotMode.value = chatCaps.value.send_text ? 'send' : slotMode.value;
}

function maybeAutoSendRecord() {
  if (!pendingAutoSend) return;
  pendingAutoSend = false;
  nextTick(() => {
    sendMessage();
    resetSlotAfterMedia();
  });
}

function cancelRecording() {
  pendingAutoSend = false;
  recordingStartPending = false;
  plusOpen.value = false;
  unbindPlusOutside();
  stopAudioRecording({ discard: true });
  stopVideoRecording({ discard: true });
}

function clearSlotHoldListeners() {
  document.removeEventListener('mouseup', onSlotPointerUp);
  document.removeEventListener('touchend', onSlotPointerUp);
  document.removeEventListener('touchcancel', onSlotPointerUp);
}

function resetSlotHoldState() {
  if (slotHoldTimer) {
    clearTimeout(slotHoldTimer);
    slotHoldTimer = null;
  }
  slotHoldActive = false;
  clearSlotHoldListeners();
}

async function onSlotPointerUp() {
  if (slotHoldTimer) {
    clearTimeout(slotHoldTimer);
    slotHoldTimer = null;
  }
  clearSlotHoldListeners();
  if (slotMode.value === 'send') return;
  if (!slotHoldActive) {
    if (slotMode.value === 'audio' || slotMode.value === 'video_note') {
      ElMessage.info(t('chat.holdToRecord'));
    }
    return;
  }
  slotHoldActive = false;
  if (recordingStartPending && !isAudioRecording.value && !isVideoRecording.value) {
    recordingStartPending = false;
    pendingAutoSend = false;
    stopMediaStream(audioStream);
    stopMediaStream(videoStream);
    return;
  }
  if (isVideoRecording.value) await stopVideoRecording();
  else if (isAudioRecording.value) await stopAudioRecording();
}

function onSlotPointerDown() {
  if (!props.canSend || props.isLoading) return;
  plusOpen.value = false;
  unbindPlusOutside();
  if (slotMode.value === 'send') {
    if (!isSendDisabled.value) sendMessage();
    return;
  }
  if (slotMode.value === 'phone') {
    ElMessage.info(t('chat.callInDevelopment'));
    slotMode.value = 'send';
    return;
  }
  if (localAttachments.value.length > 0) {
    ElMessage.warning(t('chat.removeFileBeforeRecord'));
    return;
  }
  slotHoldActive = false;
  slotHoldTimer = setTimeout(async () => {
    slotHoldActive = true;
    pendingAutoSend = true;
    if (slotMode.value === 'audio') await startAudioRecording();
    else if (slotMode.value === 'video_note') await startVideoRecording();
  }, HOLD_MS);
  document.addEventListener('mouseup', onSlotPointerUp);
  document.addEventListener('touchend', onSlotPointerUp);
  document.addEventListener('touchcancel', onSlotPointerUp);
}

const sendMessage = () => {
  if (isSendDisabled.value) return;
  const files = localAttachments.value.slice(0, 1).map((att) => {
    const file = att.file;
    if (att.kind) file.attachmentKind = att.kind;
    return file;
  });
  const isMediaSend = files.some((file) => file.attachmentKind === ATTACHMENT_KINDS.AUDIO || file.attachmentKind === ATTACHMENT_KINDS.VIDEO_NOTE);
  emit('send-message', {
      message: isMediaSend ? '' : props.newMessage,
      attachments: files
  });
  if (props.clearOnSend) {
    if (isMediaSend) {
      localAttachments.value.forEach((att) => {
        if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
      });
      localAttachments.value = [];
      emit('update:attachments', []);
    } else {
      clearInput();
    }
    nextTick(adjustTextareaHeight);
  }
  if (isMediaSend) resetSlotAfterMedia();
};

async function loadChatCaps() {
  try {
    const { data } = await api.get('/chat/capabilities', {
      headers: { 'Cache-Control': 'no-store' }
    });
    if (data?.success && data.data) {
      chatCaps.value = { ...cloneDefaultCaps(), ...data.data };
    } else {
      chatCaps.value = cloneDefaultCaps();
    }
  } catch {
    chatCaps.value = cloneDefaultCaps();
  }
  if (!isModeAllowed(slotMode.value)) slotMode.value = 'send';
}

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

// --- visualViewport: подгонка под мобильную клавиатуру (особенно iOS Safari) ---
const KEYBOARD_OPEN_PX = 80;
let blurResetTimer = null;

const isMobileViewport = () => window.innerWidth <= 768;

const getChatContainer = () => messagesContainer.value?.closest('.chat-container') || null;

const resetPageScroll = () => {
  window.scrollTo(0, 0);
  if (document.documentElement) document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;
};

const resetContainerHeight = () => {
  const container = getChatContainer();
  if (container) {
    container.style.height = '';
    container.style.maxHeight = '';
  }
};

const getKeyboardInset = () => {
  const vv = window.visualViewport;
  if (!vv) return 0;
  // iOS: layout viewport часто не сжимается; inset = разница + offsetTop
  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
};

const syncChatToViewport = () => {
  if (!isMobileViewport() || !window.visualViewport) return;
  const vv = window.visualViewport;
  const container = getChatContainer();
  if (!container) return;

  const keyboardInset = getKeyboardInset();
  if (keyboardInset > KEYBOARD_OPEN_PX) {
    // Не vv.height целиком (игнорирует шапку) — только видимая зона от верха контейнера
    const top = container.getBoundingClientRect().top;
    const available = Math.max(120, Math.floor(vv.height - (top - vv.offsetTop)));
    container.style.height = `${available}px`;
    container.style.maxHeight = `${available}px`;
    resetPageScroll();
  } else {
    resetContainerHeight();
    resetPageScroll();
  }
  nextTick(() => scrollToBottom());
};

const onViewportChange = () => {
  syncChatToViewport();
};

onMounted(() => {
  checkMobile();
  loadChatCaps();
  window.addEventListener('resize', checkMobile);
  window.addEventListener('resize', updatePlusWidgetPos);
  document.addEventListener('keydown', onComposerKeydown);
  adjustTextareaHeight();
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportChange);
    window.visualViewport.addEventListener('scroll', onViewportChange);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
  window.removeEventListener('resize', updatePlusWidgetPos);
  document.removeEventListener('keydown', onComposerKeydown);
  unbindPlusOutside();
  resetSlotHoldState();
  clearRecordLimitTimer();
  pendingAutoSend = false;
  recordingStartPending = false;
  stopAudioRecording({ discard: true });
  stopVideoRecording({ discard: true });
  localAttachments.value.forEach((att) => {
    if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
  });
  if (blurResetTimer) clearTimeout(blurResetTimer);
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', onViewportChange);
    window.visualViewport.removeEventListener('scroll', onViewportChange);
  }
  resetContainerHeight();
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
}, { flush: 'post' });

// Авто-скролл при потоковом обновлении последнего сообщения (стриминг ИИ)
watch(
  () => {
    const msgs = props.messages;
    if (!msgs.length) return '';
    const last = msgs[msgs.length - 1];
    return last?.content?.length || 0;
  },
  () => {
    const el = messagesContainer.value;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (atBottom) scrollToBottom();
  },
  { flush: 'post' }
);

// Обработчик скролла для подгрузки сообщений
const handleScroll = () => {
  const element = messagesContainer.value;
  if (element && element.scrollTop === 0 && props.hasMoreMessages) {
    emit('load-more');
  }
};

const handleFocus = () => {
  if (!isMobileViewport()) return;
  // iOS: клавиатура и auto-zoom анимируются ~250–350ms
  setTimeout(() => {
    syncChatToViewport();
    scrollToBottom();
    resetPageScroll();
  }, 300);
};

const handleBlur = () => {
  if (!isMobileViewport()) return;
  if (blurResetTimer) clearTimeout(blurResetTimer);
  // iOS закрывает клавиатуру дольше Android — двойной сброс
  blurResetTimer = setTimeout(() => {
    resetContainerHeight();
    resetPageScroll();
    nextTick(() => scrollToBottom());
    setTimeout(() => {
      resetContainerHeight();
      resetPageScroll();
      syncChatToViewport();
      scrollToBottom();
    }, 350);
  }, 100);
};

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
const INPUT_MAX_HEIGHT = 280;

const isMultilineInput = ref(false);

const adjustTextareaHeight = () => {
  const textarea = messageInputRef.value;
  if (!textarea) return;

  const value = String(textarea.value || props.newMessage || '');
  // Сначала сбрасываем высоту, чтобы scrollHeight отражал полный текст
  textarea.style.height = 'auto';
  const measured = Math.max(textarea.scrollHeight, INPUT_SINGLE_LINE_HEIGHT);
  const shouldExpand =
    measured > INPUT_SINGLE_LINE_HEIGHT + 2
    || value.includes('\n')
    || value.length > 48;

  isMultilineInput.value = shouldExpand;

  nextTick(() => {
    const el = messageInputRef.value;
    if (!el) return;
    if (!shouldExpand) {
      el.style.height = `${INPUT_SINGLE_LINE_HEIGHT}px`;
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, INPUT_SINGLE_LINE_HEIGHT), INPUT_MAX_HEIGHT)}px`;
  });
};

watch(() => props.newMessage, () => {
  // Черновик рассылки / AI подставляют текст снаружи — без этого поле остаётся в 1 строку
  nextTick(adjustTextareaHeight);
});

watch(
  [isAuthenticated, () => userAccessLevel.value?.level],
  () => {
    loadChatCaps();
  }
);

function onEnterKey(event) {
  // Shift+Enter — новая строка; Enter — отправка только в режиме самолётика
  if (event.shiftKey) {
    return;
  }
  if (slotMode.value !== 'send') return;
  event.preventDefault();
  sendMessage();
}

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
  min-width: 0;
  max-width: 100%;
  width: 100%;
  position: relative;
  overflow: hidden;
  --chat-column-width: 680px;
}

.chat-messages {
  grid-row: 1;
  width: 100% !important;
  flex: unset !important;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  padding: var(--spacing-md);
  min-height: 0;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  background-color: #ffffff;
  scrollbar-width: none;
  -ms-overflow-style: none;
  display: flex;
  flex-direction: column;
}

.chat-messages-inner {
  margin-top: auto;
  width: 100%;
  min-width: 0;
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
  max-width: 100%;
  height: auto !important;
  min-height: 0;
  min-width: 0;
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
.plus-button,
.send-button {
  align-self: center;
  margin: 0;
}

.input-shell--multiline .attach-btn,
.input-shell--multiline .ai-inline-btn,
.input-shell--multiline .plus-button,
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
  max-height: 280px;
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
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.input-shell--multiline textarea {
  line-height: 20px;
  padding: 8px 4px;
  overflow-y: auto;
  scrollbar-width: thin;
  -ms-overflow-style: auto;
}

.input-shell--multiline textarea::-webkit-scrollbar {
  display: block;
  width: 4px;
}

.input-shell textarea:focus {
  outline: none;
  box-shadow: none;
}

.record-status {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: var(--font-size-sm);
  color: #64748b;
  padding: 4px;
}

.record-status__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.video-note-live {
  position: relative;
  width: 120px;
  height: 120px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  background: #111;
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.55), 0 2px 10px rgba(0, 0, 0, 0.2);
  clip-path: circle(50% at 50% 50%);
  -webkit-clip-path: circle(50% at 50% 50%);
}

.video-note-live__media {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  /* зеркало как в selfie-превью TG/WhatsApp */
  transform: scaleX(-1);
}

.video-note-live__ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.35);
  pointer-events: none;
  animation: video-note-live-pulse 1.4s ease-in-out infinite;
}

@keyframes video-note-live-pulse {
  0%, 100% { box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.35); }
  50% { box-shadow: inset 0 0 0 3px rgba(220, 38, 38, 0.65); }
}

.voice-live {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 160px;
  height: 48px;
  padding: 8px 12px;
  border-radius: 18px;
  background: rgba(220, 38, 38, 0.1);
  box-sizing: border-box;
  flex-shrink: 0;
}

.voice-live__bar {
  flex: 1;
  min-width: 2px;
  max-width: 4px;
  border-radius: 2px;
  background: #dc2626;
  align-self: center;
  transition: height 0.05s linear;
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
  background: var(--color-primary);
  transition: background-color 0.18s ease, transform 0.15s ease;
  touch-action: manipulation;
  user-select: none;
}

.send-button .chat-icon {
  width: 18px;
  height: 18px;
}

.send-button:hover:not(:disabled) {
  background: var(--color-primary-dark);
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

.slot-cluster {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.plus-button {
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
}

.plus-button:hover:not(:disabled) {
  color: #334155;
  background: rgba(15, 23, 42, 0.05);
}

.plus-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.plus-widget {
  position: fixed;
  display: flex;
  flex-direction: row;
  gap: 8px;
  padding: 6px;
  border-radius: 24px;
  background: #fff;
  border: 1px solid #dde3ea;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  z-index: 4000;
}

.plus-widget__btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #f1f5f9;
  color: #334155;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.plus-widget__btn:hover {
  background: #e2e8f0;
}

.send-button--mode {
  background: #334155;
}

.record-cancel-btn {
  border: none;
  background: transparent;
  color: #64748b;
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: 0 4px;
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

.preview-item--video-note {
  background: transparent;
  padding: 0;
  border-radius: 50%;
  overflow: visible;
}

.preview-item--video-note :deep(.video-note) {
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15);
}

.preview-item--voice {
  background: transparent;
  padding: 0;
  align-items: stretch;
}

.preview-item--voice :deep(.voice) {
  min-width: 180px;
  max-width: 240px;
  padding: 6px 10px 6px 6px;
}

.preview-item--video-note .remove-attachment-btn,
.preview-item--voice .remove-attachment-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 2;
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
    overscroll-behavior: contain;
    touch-action: pan-y;
  }

  .chat-container .chat-input {
    position: sticky;
    bottom: 0;
    left: auto;
    right: auto;
    z-index: 20;
    width: 100% !important;
    max-width: 100%;
    background: #fff;
  }

  .chat-container .chat-messages {
    padding-bottom: var(--spacing-md);
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  /* iOS Safari зумит страницу при focus, если font-size < 16px */
  .input-shell textarea {
    font-size: 16px;
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
  background: var(--color-primary-light);
}
.admin-select-checkbox {
  margin-right: 8px;
}

/* Стили для приватного чата */
.message-wrapper {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

/* Для приватного чата выравниваем сообщения по сторонам */
.chat-messages:has(.private-current-user) .message-wrapper {
  justify-content: flex-end;
}

.chat-messages:has(.private-other-user) .message-wrapper {
  justify-content: flex-start;
}


/* TZ package R stack */
@media (max-width: 768px) {
  [class*="grid"], .form-row, .management-blocks, .cards-grid {
    grid-template-columns: 1fr !important;
  }
  .row, .actions, .toolbar, .filters, .form-actions {
    flex-wrap: wrap;
  }
}
</style> 