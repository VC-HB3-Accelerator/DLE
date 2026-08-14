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
  <div class="rich-text-editor">
    <div v-if="uploadProgress" class="rte-progress-row">
      <p class="rte-progress">{{ uploadProgress }}</p>
      <button type="button" class="rte-cancel" @click="onCancelUpload">
        {{ t('editor.uploadCancel') }}
      </button>
    </div>
    <div ref="editorContainer" class="editor-container"></div>
    <ContentMediaPickerModal
      :open="pickerKind !== null"
      :kind="pickerKind || 'image'"
      @cancel="closePicker"
      @device="onPickerDevice"
      @select="onPickerSelect"
      @url="onPickerUrl"
    />
    <input
      ref="hiddenFileInput"
      type="file"
      class="rte-hidden-file"
      :accept="pickerAccept"
      @change="onHiddenFile"
    >
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import ContentMediaPickerModal from '../content/ContentMediaPickerModal.vue';
import { uploadContentMedia, abortContentMediaUpload, isAbortError } from '../../composables/useChunkedMediaUpload';
import { isLocalCmsMediaUrl, toRelativeCmsMediaUrl } from '../../utils/cmsMediaUrl';

const { t } = useI18n();

async function loadImageResizeModule() {
  try {
    const module = await import('quill-image-resize-module');
    const ImageResize = module.default || module.ImageResize || module;
    if (ImageResize && typeof ImageResize === 'function') {
      Quill.register('modules/imageResize', ImageResize);
      return true;
    } else if (ImageResize && ImageResize.default && typeof ImageResize.default === 'function') {
      Quill.register('modules/imageResize', ImageResize.default);
      return true;
    }
  } catch (error) {
    // ignore
  }
  return false;
}

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue']);

const editorContainer = ref(null);
const hiddenFileInput = ref(null);
const pickerKind = ref(null);
const pendingKind = ref('image');
const uploadProgress = ref('');
const activeUploadFile = ref(null);
const uploadAbortController = ref(null);
let savedRange = null;
let quill = null;

const pickerAccept = ref('image/*');

function rememberRange() {
  if (!quill) {
    savedRange = { index: 0, length: 0 };
    return;
  }
  savedRange = quill.getSelection() || { index: Math.max(quill.getLength() - 1, 0), length: 0 };
}

function closePicker() {
  pickerKind.value = null;
}

function currentRange() {
  if (savedRange) return savedRange;
  if (!quill) return { index: 0, length: 0 };
  return quill.getSelection() || { index: Math.max(quill.getLength() - 1, 0), length: 0 };
}

function getUploadErrorMessage(error) {
  const extractMessage = (obj) => {
    if (!obj) return null;
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'object') {
      if (obj.message) return String(obj.message);
      if (obj.error && typeof obj.error === 'string') return obj.error;
      if (obj.error && typeof obj.error === 'object' && obj.error.message) return String(obj.error.message);
      if (obj.detail) return String(obj.detail);
      if (obj.msg) return String(obj.msg);
      return null;
    }
    return String(obj);
  };

  if (error.response?.status === 503) {
    return error.response?.data?.message || t('editor.serverUnavailable');
  }
  if (error.response?.data?.success === false && error.response?.data?.message) {
    const msg = extractMessage(error.response.data.message);
    return msg || (typeof error.response.data.message === 'string' ? error.response.data.message : t('editor.serverError'));
  }
  if (error.response?.data?.error?.message) {
    return String(error.response.data.error.message);
  }
  if (error.response?.data?.message) {
    const msg = extractMessage(error.response.data.message);
    return msg || (typeof error.response.data.message === 'string' ? error.response.data.message : t('editor.serverError'));
  }
  if (error.response?.data?.error) {
    const err = error.response.data.error;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      return err.message || err.detail || err.msg || t('editor.serverError');
    }
    return String(err);
  }
  if (error.response?.data) {
    const msg = extractMessage(error.response.data);
    if (msg) return msg;
    if (typeof error.response.data === 'string') return error.response.data;
  }
  if (error.message) return error.message;
  return t('common.unknownError');
}

function getVideoLoadingHtml(videoUrl) {
  return `<div class="video-wrapper"><div class="video-loading-indicator" style="display: flex;"><div class="spinner"></div><span>${t('editor.loadingVideo')}</span></div><video controls class="ql-video" style="max-width: 100%; width: 100%; height: auto; min-height: 400px; border-radius: 8px; margin: 1.5rem 0; display: block;" src="${videoUrl}"></video></div>`;
}

// Настройка Quill с панелью инструментов
const toolbarOptions = [
  [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
  [{ 'font': [] }],
  [{ 'size': ['small', false, 'large', 'huge'] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ 'color': [] }, { 'background': [] }],
  [{ 'script': 'sub'}, { 'script': 'super' }],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
  [{ 'indent': '-1'}, { 'indent': '+1' }],
  [{ 'align': [] }],
  ['blockquote', 'code-block'],
  ['link', 'image', 'video'],
  ['clean']
];

onMounted(async () => {
  if (!editorContainer.value) return;

  // Загружаем модуль изменения размера изображений перед инициализацией
  const imageResizeLoaded = await loadImageResizeModule();

  // Конфигурация модулей
  const modulesConfig = {
      toolbar: {
        container: toolbarOptions,
        handlers: {
          'image': handleImageClick,
          'video': handleVideoClick
        }
    }
  };

  // Добавляем imageResize только если модуль загружен
  if (imageResizeLoaded) {
    modulesConfig.imageResize = {
        parchment: Quill.import('parchment'),
        modules: ['Resize', 'DisplaySize', 'Toolbar']
    };
    }

  // Инициализация Quill
  quill = new Quill(editorContainer.value, {
    theme: 'snow',
    placeholder: props.placeholder || t('editor.placeholder'),
    modules: modulesConfig
  });

  // Устанавливаем начальное значение
  if (props.modelValue) {
    quill.root.innerHTML = props.modelValue;
    // Обрабатываем существующие видео и настраиваем обработчики
    setTimeout(() => {
      wrapExistingVideos();
      setupVideoLoadingHandlers();
    }, 100);
  }

  // Слушаем изменения
  quill.on('text-change', () => {
    const html = quill.root.innerHTML;
    emit('update:modelValue', html);
    // Настраиваем обработчики для новых видео после изменений
    setTimeout(() => {
      setupVideoLoadingHandlers();
    }, 100);
  });
});

// Обновление при изменении modelValue извне
watch(() => props.modelValue, (newValue) => {
  if (quill && quill.root.innerHTML !== newValue) {
    quill.root.innerHTML = newValue || '';
    // Обрабатываем существующие видео в контенте
    setTimeout(() => {
      wrapExistingVideos();
      setupVideoLoadingHandlers();
    }, 100);
  }
});

// Обертка существующих видео в контейнер с индикатором загрузки
function wrapExistingVideos() {
  if (!quill || !quill.root) return;
  
  const videoElements = quill.root.querySelectorAll('video.ql-video:not(.video-wrapper video)');
  videoElements.forEach((video) => {
    // Проверяем, не обернут ли уже видео
    if (video.closest('.video-wrapper')) return;
    
    // Проверяем, является ли это локальный файл
    const src = video.getAttribute('src');
    if (src && isLocalCmsMediaUrl(src)) {
      // Создаем обертку
      const wrapper = document.createElement('div');
      wrapper.className = 'video-wrapper';
      
      // Создаем индикатор загрузки
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'video-loading-indicator';
      loadingIndicator.style.display = 'flex';
      loadingIndicator.innerHTML = `<div class="spinner"></div><span>${t('editor.loadingVideo')}</span>`;
      
      // Вставляем обертку перед видео
      video.parentNode?.insertBefore(wrapper, video);
      
      // Перемещаем видео и индикатор в обертку
      wrapper.appendChild(loadingIndicator);
      wrapper.appendChild(video);
    }
  });
}

function insertImageAtRange(url) {
  const range = currentRange();
  const rel = toRelativeCmsMediaUrl(url);
  quill.insertEmbed(range.index, 'image', rel);
  quill.setSelection(range.index + 1, 0);
  emit('update:modelValue', quill.root.innerHTML);
}

function insertVideoAtRange(url) {
  const range = currentRange();
  const rel = toRelativeCmsMediaUrl(url);
  if (isLocalCmsMediaUrl(rel)) {
    quill.clipboard.dangerouslyPasteHTML(range.index, getVideoLoadingHtml(rel));
    setupVideoLoadingHandlers();
    setTimeout(() => setupVideoLoadingHandlers(), 50);
    setTimeout(() => setupVideoLoadingHandlers(), 200);
  } else {
    quill.insertEmbed(range.index, 'video', rel);
  }
  quill.setSelection(range.index + 1, 0);
  emit('update:modelValue', quill.root.innerHTML);
}

function handleImageClick() {
  rememberRange();
  pendingKind.value = 'image';
  pickerAccept.value = 'image/*';
  pickerKind.value = 'image';
}

function handleVideoClick() {
  rememberRange();
  pendingKind.value = 'video';
  pickerAccept.value = 'video/*';
  pickerKind.value = 'video';
}

function onPickerDevice() {
  closePicker();
  nextTick(() => {
    if (hiddenFileInput.value) hiddenFileInput.value.click();
  });
}

function onPickerSelect(item) {
  closePicker();
  if (!item || !item.url) return;
  if (pendingKind.value === 'video') insertVideoAtRange(item.url);
  else insertImageAtRange(item.url);
}

function onPickerUrl() {
  closePicker();
  const url = prompt(t('editor.videoUrlPrompt'));
  if (url) insertVideoAtRange(url);
}

async function onCancelUpload() {
  const file = activeUploadFile.value;
  if (uploadAbortController.value) uploadAbortController.value.abort();
  if (file) await abortContentMediaUpload(file);
  uploadProgress.value = '';
  activeUploadFile.value = null;
  uploadAbortController.value = null;
}

async function onHiddenFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const controller = new AbortController();
  uploadAbortController.value = controller;
  activeUploadFile.value = file;
  try {
    const data = await uploadContentMedia(file, {
      signal: controller.signal,
      onProgress: ({ percent, phase, part, totalParts }) => {
        if (phase === 'parts') {
          uploadProgress.value = t('editor.chunkedProgress', {
            percent,
            part: part || 0,
            total: totalParts || 0,
          });
        } else if (percent < 100) {
          uploadProgress.value = t('content.media.uploadProgress', { percent });
        } else {
          uploadProgress.value = '';
        }
      },
    });
    uploadProgress.value = '';
    if (!data || !data.url) {
      alert(t('editor.invalidResponse'));
      return;
    }
    if (pendingKind.value === 'video' || data.type === 'video') insertVideoAtRange(data.url);
    else insertImageAtRange(data.url);
  } catch (error) {
    uploadProgress.value = '';
    if (isAbortError(error)) return;
    const errorMessage = getUploadErrorMessage(error);
    const key = pendingKind.value === 'video' ? 'editor.videoUploadError' : 'editor.imageUploadError';
    alert(t(key, { message: errorMessage }));
  } finally {
    activeUploadFile.value = null;
    uploadAbortController.value = null;
  }
}

// Настройка обработчиков событий для индикатора загрузки видео
function setupVideoLoadingHandlers() {
  if (!quill || !quill.root) return;
  
  const videoElements = quill.root.querySelectorAll('.video-wrapper video');
  videoElements.forEach((video) => {
    const wrapper = video.closest('.video-wrapper');
    if (!wrapper) return;
    
    const loadingIndicator = wrapper.querySelector('.video-loading-indicator');
    if (!loadingIndicator) return;
    
    // Показываем индикатор сразу (он должен быть виден по умолчанию)
    loadingIndicator.style.display = 'flex';
    
    // Проверяем, не загружено ли уже видео
    if (video.readyState >= 2) {
      // Видео уже загружено, скрываем индикатор
      loadingIndicator.style.display = 'none';
    }
    
    // Показываем индикатор при начале загрузки
    const handleLoadStart = () => {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
      }
    };
    
    // Скрываем индикатор, когда видео готово к воспроизведению
    const handleCanPlay = () => {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
    };
    
    // Показываем индикатор, если видео буферизуется
    const handleWaiting = () => {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
      }
    };
    
    // Скрываем индикатор при воспроизведении
    const handlePlaying = () => {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
    };
    
    // Обработка ошибок
    const handleError = () => {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
    };
    
    // Добавляем обработчики событий (удаляем старые, если есть)
    video.removeEventListener('loadstart', handleLoadStart);
    video.removeEventListener('canplay', handleCanPlay);
    video.removeEventListener('waiting', handleWaiting);
    video.removeEventListener('playing', handlePlaying);
    video.removeEventListener('error', handleError);
    
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);
  });
}

// Настраиваем обработчики при изменении контента
watch(() => props.modelValue, () => {
  if (quill) {
    setTimeout(() => {
      setupVideoLoadingHandlers();
    }, 100);
  }
});

onBeforeUnmount(() => {
  if (quill) {
    quill = null;
  }
});

// Метод для получения HTML контента
function getHTML() {
  return quill ? quill.root.innerHTML : '';
}

// Метод для установки HTML контента
function setHTML(html) {
  if (quill) {
    quill.root.innerHTML = html || '';
  }
}

defineExpose({
  getHTML,
  setHTML
});
</script>

<style scoped>
.rich-text-editor {
  width: 100%;
}

.rte-hidden-file {
  display: none;
}

.rte-progress-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 8px;
}

.rte-progress {
  margin: 0;
  font-size: 0.9rem;
  color: #495057;
}

.rte-cancel {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  border-radius: 8px;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  font-size: 0.85rem;
}

.editor-container {
  min-height: 300px;
}

/* Переопределение стилей Quill для соответствия дизайну */
:deep(.ql-container) {
  font-family: inherit;
  font-size: 1rem;
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
}

:deep(.ql-toolbar) {
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  border: 1px solid #e9ecef;
  background: #f8f9fa;
}

:deep(.ql-editor) {
  min-height: 300px;
  padding: 15px;
}

:deep(.ql-editor.ql-blank::before) {
  font-style: normal;
  color: #6c757d;
}

:deep(.ql-snow .ql-stroke) {
  stroke: #495057;
}

:deep(.ql-snow .ql-fill) {
  fill: #495057;
}

:deep(.ql-snow .ql-picker-label:hover),
:deep(.ql-snow .ql-picker-item:hover) {
  color: var(--color-primary);
}

:deep(.ql-snow .ql-tooltip) {
  background: white;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

:deep(.ql-snow .ql-tooltip input[type=text]) {
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 4px 8px;
}

:deep(.ql-snow img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 10px 0;
}

/* Стили для видео в редакторе - на всю ширину */
:deep(.ql-snow video),
:deep(.ql-editor video) {
  max-width: 100%;
  width: 100%;
  height: auto;
  min-height: 400px;
  border-radius: 8px;
  margin: 1.5rem 0;
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: #000;
}

:deep(.ql-snow video.ql-video),
:deep(.ql-editor video.ql-video) {
  width: 100%;
  max-width: 100%;
  min-height: 400px;
}

/* Стили для iframe в редакторе */
:deep(.ql-snow iframe),
:deep(.ql-editor iframe) {
  max-width: 100%;
  width: 100%;
  height: auto;
  min-height: 400px;
  border-radius: 8px;
  margin: 1.5rem 0;
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: #000;
  border: none;
}

:deep(.ql-snow iframe.ql-video),
:deep(.ql-editor iframe.ql-video) {
  min-height: 400px;
  aspect-ratio: 16 / 9;
}

/* Стили для изменения размера изображений */
:deep(.ql-image-resize) {
  display: inline-block;
  position: relative;
}

:deep(.ql-image-resize .ql-image-resize-handle) {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  background: var(--color-primary);
  border: 2px solid white;
  border-radius: 2px;
  cursor: nwse-resize;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
}

/* Стили для обертки видео с индикатором загрузки */
:deep(.video-wrapper) {
  position: relative;
  max-width: 100%;
  width: 100%;
  margin: 1.5rem 0;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
  min-height: 400px;
}

:deep(.video-wrapper video) {
  max-width: 100%;
  width: 100%;
  height: auto;
  min-height: 400px;
  border-radius: 8px;
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: #000;
}

/* Индикатор загрузки видео */
:deep(.video-loading-indicator) {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  z-index: 10;
  border-radius: 8px;
}

:deep(.video-loading-indicator .spinner) {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

:deep(.video-loading-indicator span) {
  font-size: 1rem;
  font-weight: 500;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}


/* TZ package D */
@media (max-width: 768px) {
  .page, .panel, .view, .container, [class*="container"], [class*="panel"], [class*="wrapper"], [class*="list"], [class*="content"] {
    max-width: 100%;
    box-sizing: border-box;
  }
  .form-row, .row, .actions, .toolbar, .header-row, .filters {
    flex-wrap: wrap;
  }
  [class*="grid"], .form-row {
    grid-template-columns: 1fr !important;
  }
}
</style>

