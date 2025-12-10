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
  <div class="rich-text-editor">
    <div ref="editorContainer" class="editor-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import api from '../../api/axios';

// Функция для загрузки и регистрации модуля изменения размера изображений
async function loadImageResizeModule() {
try {
    // Используем динамический импорт для совместимости с Vite
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
  console.warn('[RichTextEditor] Не удалось загрузить модуль изменения размера изображений:', error);
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
    default: 'Введите текст...'
  }
});

const emit = defineEmits(['update:modelValue']);

const editorContainer = ref(null);
let quill = null;

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
    placeholder: props.placeholder,
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
    if (src && src.includes('/api/uploads/media/') && src.includes('/file')) {
      // Создаем обертку
      const wrapper = document.createElement('div');
      wrapper.className = 'video-wrapper';
      
      // Создаем индикатор загрузки
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'video-loading-indicator';
      loadingIndicator.style.display = 'flex';
      loadingIndicator.innerHTML = '<div class="spinner"></div><span>Загрузка видео...</span>';
      
      // Вставляем обертку перед видео
      video.parentNode?.insertBefore(wrapper, video);
      
      // Перемещаем видео и индикатор в обертку
      wrapper.appendChild(loadingIndicator);
      wrapper.appendChild(video);
    }
  });
}

// Обработка вставки изображения
function handleImageClick() {
  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', 'image/*');
  input.click();

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      console.log('[RichTextEditor] Начало загрузки изображения:', file.name);
      
      // Загружаем файл
      const formData = new FormData();
      formData.append('media', file);

      const response = await api.post('/uploads/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      console.log('[RichTextEditor] Ответ от сервера:', response.data);

      if (response.data && response.data.success && response.data.data && response.data.data.url) {
        // Получаем текущую позицию курсора или используем конец документа
        let range = quill.getSelection();
        if (!range) {
          // Если курсор не установлен, вставляем в конец
          const length = quill.getLength();
          range = { index: length - 1, length: 0 };
        }
        
        // Используем полный URL для доступа к файлу
        let fullUrl = response.data.data.url;
        if (!fullUrl.startsWith('http')) {
          // Если URL относительный, добавляем origin
          fullUrl = `${window.location.origin}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
        }
        
        console.log('[RichTextEditor] Вставляем изображение по URL:', fullUrl, 'в позицию:', range.index);
        
        // Вставляем изображение
        quill.insertEmbed(range.index, 'image', fullUrl);
        
        // Перемещаем курсор после изображения
        quill.setSelection(range.index + 1, 0);
        
        // Принудительно обновляем modelValue
        const html = quill.root.innerHTML;
        emit('update:modelValue', html);
        
        console.log('[RichTextEditor] Изображение успешно вставлено');
      } else {
        console.error('[RichTextEditor] Неверный формат ответа:', response.data);
        alert('Ошибка: сервер вернул неверный формат данных');
      }
    } catch (error) {
      console.error('[RichTextEditor] Ошибка загрузки изображения:', error);
      console.error('[RichTextEditor] Детали ошибки:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Обработка ошибок аналогично обработке ошибок видео
      let errorMessage = 'Неизвестная ошибка';
      
      try {
        // Проверяем статус ошибки для специальных случаев
        if (error.response?.status === 503) {
          errorMessage = error.response?.data?.message || 
                       'Сервер временно недоступен. Пожалуйста, попробуйте позже.';
        }
        // Приоритет 1: response.data.message (если success: false)
        else if (error.response?.data?.success === false && error.response?.data?.message) {
          errorMessage = typeof error.response.data.message === 'string' 
            ? error.response.data.message 
            : 'Ошибка сервера';
        }
        // Приоритет 2: response.data.error.message (формат errorHandler)
        else if (error.response?.data?.error?.message) {
          errorMessage = String(error.response.data.error.message);
        }
        // Приоритет 3: response.data.message
        else if (error.response?.data?.message) {
          errorMessage = typeof error.response.data.message === 'string' 
            ? error.response.data.message 
            : 'Ошибка сервера';
        }
        // Приоритет 4: response.data.error
        else if (error.response?.data?.error) {
          errorMessage = typeof error.response.data.error === 'string' 
            ? error.response.data.error 
            : 'Ошибка сервера';
        }
        // Приоритет 5: error.message
        else if (error.message) {
          errorMessage = error.message;
        }
      } catch (e) {
        console.error('[RichTextEditor] Ошибка при обработке ошибки загрузки изображения:', e);
        errorMessage = error?.message || 'Ошибка при загрузке изображения';
      }
      
      alert('Ошибка загрузки изображения: ' + errorMessage);
    }
  };
}

// Обработка вставки видео
function handleVideoClick() {
  // Предлагаем выбор: загрузить файл или вставить URL
  const choice = confirm('Нажмите OK для загрузки файла или Отмена для вставки URL');
  
  if (choice) {
    // Загрузка файла
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'video/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        console.log('[RichTextEditor] Начало загрузки видео:', file.name);
        
        // Загружаем файл
        const formData = new FormData();
        formData.append('media', file);

        const response = await api.post('/uploads/media', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        console.log('[RichTextEditor] Ответ от сервера:', response.data);

        if (response.data && response.data.success && response.data.data && response.data.data.url) {
          // Получаем текущую позицию курсора или используем конец документа
          let range = quill.getSelection();
          if (!range) {
            // Если курсор не установлен, вставляем в конец
            const length = quill.getLength();
            range = { index: length - 1, length: 0 };
          }
          
          // Используем полный URL для доступа к файлу
          let fullUrl = response.data.data.url;
          if (!fullUrl.startsWith('http')) {
            // Если URL относительный, добавляем origin
            fullUrl = `${window.location.origin}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
          }
          
          console.log('[RichTextEditor] Вставляем видео по URL:', fullUrl, 'в позицию:', range.index);
          
          // Проверяем, является ли это локальный файл из нашей системы
          const isLocalFile = fullUrl.includes('/api/uploads/media/') && fullUrl.includes('/file');
          
          if (isLocalFile) {
            // Для локальных файлов вставляем тег <video> с оберткой для индикатора загрузки
            const videoHtml = `<div class="video-wrapper"><div class="video-loading-indicator" style="display: flex;"><div class="spinner"></div><span>Загрузка видео...</span></div><video controls class="ql-video" style="max-width: 100%; width: 100%; height: auto; min-height: 400px; border-radius: 8px; margin: 1.5rem 0; display: block;" src="${fullUrl}"></video></div>`;
            quill.clipboard.dangerouslyPasteHTML(range.index, videoHtml);
            
            // Настраиваем обработчики событий для видео после вставки (сразу и с задержкой для надежности)
            setupVideoLoadingHandlers();
            setTimeout(() => {
              setupVideoLoadingHandlers();
            }, 50);
            setTimeout(() => {
              setupVideoLoadingHandlers();
            }, 200);
          } else {
            // Для внешних URL (YouTube, Vimeo) используем iframe через Quill
            quill.insertEmbed(range.index, 'video', fullUrl);
          }
          
          // Перемещаем курсор после видео
          quill.setSelection(range.index + 1, 0);
          
          // Принудительно обновляем modelValue
          const html = quill.root.innerHTML;
          emit('update:modelValue', html);
          
          console.log('[RichTextEditor] Видео успешно вставлено');
        } else {
          console.error('[RichTextEditor] Неверный формат ответа:', response.data);
          alert('Ошибка: сервер вернул неверный формат данных');
        }
      } catch (error) {
        console.error('[RichTextEditor] Ошибка загрузки видео:', error);
        console.error('[RichTextEditor] Детали ошибки:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          error: error
        });
        
        // Правильная обработка ошибок с учетом всех возможных форматов
        let errorMessage = 'Неизвестная ошибка';
        
        try {
          // Функция для безопасного извлечения сообщения из объекта
          const extractMessage = (obj) => {
            if (!obj) return null;
            if (typeof obj === 'string') return obj;
            if (typeof obj === 'object') {
              // Проверяем различные возможные поля с сообщением
              if (obj.message) return String(obj.message);
              if (obj.error && typeof obj.error === 'string') return obj.error;
              if (obj.error && typeof obj.error === 'object' && obj.error.message) return String(obj.error.message);
              if (obj.detail) return String(obj.detail);
              if (obj.msg) return String(obj.msg);
              // Если ничего не найдено, возвращаем null
              return null;
            }
            return String(obj);
          };
          
          // Проверяем статус ошибки для специальных случаев
          if (error.response?.status === 503) {
            // Service Unavailable - обычно ошибка подключения к БД
            errorMessage = error.response?.data?.message || 
                         'Сервер временно недоступен. Пожалуйста, попробуйте позже.';
          }
          // Приоритет 1: response.data.message (если success: false)
          else if (error.response?.data?.success === false && error.response?.data?.message) {
            const msg = extractMessage(error.response.data.message);
            if (msg) {
              errorMessage = msg;
            } else {
              errorMessage = typeof error.response.data.message === 'string' 
                ? error.response.data.message 
                : 'Ошибка сервера';
            }
          }
          // Приоритет 2: response.data.error.message (формат errorHandler)
          else if (error.response?.data?.error?.message) {
            errorMessage = String(error.response.data.error.message);
          }
          // Приоритет 3: response.data.message
          else if (error.response?.data?.message) {
            const msg = extractMessage(error.response.data.message);
            if (msg) {
              errorMessage = msg;
            } else {
              errorMessage = typeof error.response.data.message === 'string' 
                ? error.response.data.message 
                : 'Ошибка сервера (неверный формат сообщения)';
            }
          }
          // Приоритет 4: response.data.error (может быть объектом или строкой)
          else if (error.response?.data?.error) {
            const err = error.response.data.error;
            if (typeof err === 'string') {
              errorMessage = err;
            } else if (err && typeof err === 'object') {
              // Пытаемся извлечь понятное сообщение
              errorMessage = err.message || err.detail || err.msg || 'Ошибка сервера';
            } else {
              errorMessage = String(err);
            }
          }
          // Приоритет 5: response.data (может быть объектом с ошибкой)
          else if (error.response?.data) {
            const data = error.response.data;
            const msg = extractMessage(data);
            if (msg) {
              errorMessage = msg;
            } else if (typeof data === 'string') {
              errorMessage = data;
            } else if (data && typeof data === 'object') {
              errorMessage = data.message || 'Ошибка сервера';
            }
          }
          // Приоритет 6: error.message
          else if (error.message) {
            errorMessage = error.message;
          }
          // Приоритет 7: error сам по себе
          else {
            errorMessage = String(error);
          }
        } catch (e) {
          // Если что-то пошло не так при обработке ошибки, используем базовое сообщение
          console.error('[RichTextEditor] Ошибка при обработке ошибки:', e);
          errorMessage = error?.message || 'Ошибка при загрузке видео';
        }
        
        // Гарантируем, что errorMessage всегда строка
        if (typeof errorMessage !== 'string') {
          console.error('[RichTextEditor] errorMessage не является строкой:', errorMessage, typeof errorMessage);
          try {
            errorMessage = JSON.stringify(errorMessage);
          } catch (e) {
            errorMessage = String(errorMessage);
          }
        }
        
        console.error('[RichTextEditor] Финальное сообщение об ошибке:', errorMessage);
        alert('Ошибка загрузки видео: ' + errorMessage);
      }
    };
  } else {
    // Вставка URL
    const url = prompt('Введите URL видео:');
    if (url) {
      let range = quill.getSelection();
      if (!range) {
        const length = quill.getLength();
        range = { index: length - 1, length: 0 };
      }
      
      // Проверяем, является ли это локальный файл из нашей системы
      const isLocalFile = url.includes('/api/uploads/media/') && url.includes('/file');
      
      if (isLocalFile) {
        // Для локальных файлов вставляем тег <video> с оберткой для индикатора загрузки
        const videoHtml = `<div class="video-wrapper"><div class="video-loading-indicator" style="display: flex;"><div class="spinner"></div><span>Загрузка видео...</span></div><video controls class="ql-video" style="max-width: 100%; width: 100%; height: auto; min-height: 400px; border-radius: 8px; margin: 1.5rem 0; display: block;" src="${url}"></video></div>`;
        quill.clipboard.dangerouslyPasteHTML(range.index, videoHtml);
        
        // Настраиваем обработчики событий для видео после вставки (сразу и с задержкой для надежности)
        setupVideoLoadingHandlers();
        setTimeout(() => {
          setupVideoLoadingHandlers();
        }, 50);
        setTimeout(() => {
          setupVideoLoadingHandlers();
        }, 200);
      } else {
        // Для внешних URL (YouTube, Vimeo) используем iframe через Quill
        quill.insertEmbed(range.index, 'video', url);
      }
      
      quill.setSelection(range.index + 1, 0);
      
      // Принудительно обновляем modelValue
      const html = quill.root.innerHTML;
      emit('update:modelValue', html);
    }
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
    const handleError = (e) => {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
      console.error('[RichTextEditor] Ошибка загрузки видео в плеере:', e);
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
</style>

