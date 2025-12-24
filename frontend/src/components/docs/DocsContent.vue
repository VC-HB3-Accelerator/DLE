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
  <div class="docs-content">
    <!-- Хлебные крошки -->
    <!-- Убираем последний элемент breadcrumbs, так как он дублирует заголовок страницы -->
    <nav v-if="breadcrumbs.length > 1" class="breadcrumbs">
      <a
        v-for="(crumb, index) in breadcrumbs.slice(0, -1)"
        :key="index"
        :href="crumb.path || '#'"
        :class="['breadcrumb-item', { active: !crumb.path }]"
        @click.prevent="crumb.path && navigateTo(crumb.path)"
      >
        {{ crumb.name }}
        <i v-if="index < breadcrumbs.slice(0, -1).length - 1" class="fas fa-chevron-right breadcrumb-separator"></i>
      </a>
    </nav>

    <!-- Заголовок страницы -->
    <header v-if="page" class="page-header">
      <div class="page-header-top">
        <button v-if="!hideBackButton" class="back-btn" @click="$emit('back')" title="Вернуться к списку">
          <i class="fas fa-arrow-left"></i>
          <span>Назад</span>
        </button>
        <div v-if="canManageDocs" class="page-header-actions">
          <button
            class="page-action-btn page-edit-btn"
            @click="editPage"
            title="Редактировать документ"
          >
            <i class="fas fa-edit"></i>
            <span>Редактировать</span>
          </button>
          <button
            class="page-action-btn page-index-btn"
            @click="reindexPage"
            title="Отправить документ в поиск"
          >
            <i class="fas fa-search"></i>
            <span>Индексировать</span>
          </button>
          <button
            class="page-action-btn page-delete-btn"
            @click="confirmDeletePage"
            title="Удалить документ"
          >
            <i class="fas fa-trash"></i>
            <span>Удалить</span>
          </button>
        </div>
      </div>
      <h1>{{ page.title }}</h1>
      <div v-if="page.summary" class="page-summary">
        {{ page.summary }}
      </div>
      <div class="page-meta">
        <span class="meta-item">
          <i class="fas fa-calendar"></i>
          {{ formatDate(page.created_at) }}
        </span>
        <span v-if="page.category" class="meta-item">
          <i class="fas fa-folder"></i>
          {{ page.category }}
        </span>
      </div>
    </header>

    <!-- Основной контент -->
    <article v-if="page" class="page-article">
      <div v-if="page.format === 'pdf' && page.file_path" class="file-preview">
        <embed :src="page.file_path" type="application/pdf" class="pdf-embed" />
        <a class="btn btn-outline" :href="page.file_path" target="_blank" download>Скачать PDF</a>
      </div>
      <div v-else-if="page.format === 'image' && page.file_path" class="file-preview">
        <img :src="page.file_path" alt="Документ" class="image-preview" />
        <a class="btn btn-outline" :href="page.file_path" target="_blank" download>Скачать изображение</a>
      </div>
      <div v-else-if="page.content" class="content-text" v-html="formatContent"></div>
      <div v-else class="empty-content">
        <i class="fas fa-file-alt"></i>
        <p>Контент не добавлен</p>
      </div>
    </article>

    <!-- Навигация: Предыдущая/Следующая -->
    <nav v-if="page && navigation" class="page-navigation">
      <div class="nav-section">
        <a
          v-if="navigation.previous"
          :href="navigation.previous.path"
          class="nav-link nav-prev"
          @click.prevent="navigateTo(navigation.previous.path)"
        >
          <div class="nav-label">
            <i class="fas fa-arrow-left"></i>
            <span>Предыдущая</span>
          </div>
          <div class="nav-title">{{ navigation.previous.title }}</div>
        </a>
        <div v-else class="nav-link nav-prev disabled">
          <div class="nav-label">
            <i class="fas fa-arrow-left"></i>
            <span>Предыдущая</span>
          </div>
        </div>
      </div>

      <div class="nav-section">
        <a
          v-if="navigation.next"
          :href="navigation.next.path"
          class="nav-link nav-next"
          @click.prevent="navigateTo(navigation.next.path)"
        >
          <div class="nav-label">
            <span>Следующая</span>
            <i class="fas fa-arrow-right"></i>
          </div>
          <div class="nav-title">{{ navigation.next.title }}</div>
        </a>
        <div v-else class="nav-link nav-next disabled">
          <div class="nav-label">
            <span>Следующая</span>
            <i class="fas fa-arrow-right"></i>
          </div>
        </div>
      </div>
    </nav>

    <!-- Загрузка -->
    <div v-if="!page && isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Загрузка документа...</p>
    </div>

    <!-- Ошибка -->
    <div v-else-if="!page && !isLoading" class="error-state">
      <div class="error-icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3>Документ не найден</h3>
      <p>Запрашиваемый документ не существует или не опубликован</p>
      <p v-if="route.path.startsWith('/blog')" class="error-hint">
        <small>Проверьте консоль браузера для деталей ошибки. Убедитесь, что страница опубликована и отмечена для отображения в блоге.</small>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import pagesService from '../../services/pagesService';
import api from '../../api/axios';
import { usePermissions } from '../../composables/usePermissions';
import { PERMISSIONS } from '../../composables/permissions';

const props = defineProps({
  pageId: {
    type: [Number, String],
    default: null
  },
  hideBackButton: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['back']);

const router = useRouter();
const route = useRoute();
const { hasPermission } = usePermissions();

const canManageDocs = computed(() => hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS));

const page = ref(null);
const navigation = ref(null);
const breadcrumbs = ref([]);
const isLoading = ref(false);

// Установка мета-тегов для SEO
function updateMetaTags(pageData) {
  if (!pageData) return;
  
  // Парсим seo, если это строка (может прийти из базы как JSON строка)
  let seoData = pageData.seo;
  if (typeof seoData === 'string') {
    try {
      seoData = JSON.parse(seoData);
    } catch (e) {
      console.warn('Ошибка парсинга SEO данных:', e);
      seoData = null;
    }
  }
  
  const title = seoData?.title || pageData.title || 'Документ';
  const description = seoData?.description || pageData.summary || '';
  const keywords = seoData?.keywords || '';
  
  // Определяем canonical URL в зависимости от текущего маршрута и наличия slug
  const currentPath = window.location.pathname;
  let canonicalUrl;
  if (currentPath.startsWith('/blog')) {
    // Используем slug если есть, иначе fallback на query параметр
    if (pageData.slug && typeof pageData.slug === 'string' && pageData.slug.trim() !== '') {
      canonicalUrl = `${window.location.origin}/blog/${encodeURIComponent(pageData.slug)}`;
    } else if (pageData.id) {
      canonicalUrl = `${window.location.origin}/blog?page=${pageData.id}`;
    } else {
      canonicalUrl = `${window.location.origin}/blog`;
    }
  } else {
    canonicalUrl = pageData.id 
      ? `${window.location.origin}/content/published?page=${pageData.id}`
      : `${window.location.origin}/content/published`;
  }
  
  // Обновляем title
  document.title = title;
  
  // Обновляем или создаем meta теги
  const updateOrCreateMeta = (name, content, attribute = 'name') => {
    if (!content) return;
    let meta = document.querySelector(`meta[${attribute}="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  };
  
  // Meta description
  updateOrCreateMeta('description', description);
  
  // Meta keywords
  if (keywords) {
    updateOrCreateMeta('keywords', keywords);
  }
  
  // Canonical URL
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', canonicalUrl);
  
  // Open Graph теги для социальных сетей
  updateOrCreateMeta('og:title', title, 'property');
  updateOrCreateMeta('og:description', description, 'property');
  updateOrCreateMeta('og:type', 'article', 'property');
  updateOrCreateMeta('og:url', canonicalUrl, 'property');
  
  // Robots meta
  updateOrCreateMeta('robots', 'index, follow');
  
  // Добавляем JSON-LD разметку для статьи
  addArticleJsonLd(pageData, canonicalUrl);
}

// Добавляем JSON-LD разметку для статьи
function addArticleJsonLd(pageData, canonicalUrl) {
  // Удаляем старую разметку, если есть
  const oldScript = document.querySelector('script[type="application/ld+json"][data-article]');
  if (oldScript) {
    oldScript.remove();
  }
  
  // Парсим seo данные
  let seoData = pageData.seo;
  if (typeof seoData === 'string') {
    try {
      seoData = JSON.parse(seoData);
    } catch (e) {
      seoData = null;
    }
  }
  
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': seoData?.title || pageData.title || '',
    'description': seoData?.description || pageData.summary || '',
    'datePublished': pageData.created_at || '',
    'dateModified': pageData.updated_at || pageData.created_at || '',
    'url': canonicalUrl,
    'author': {
      '@type': 'Organization',
      'name': 'Digital Legal Entity'
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'Digital Legal Entity'
    }
  };
  
  if (pageData.category) {
    articleJsonLd.articleSection = pageData.category;
  }
  
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-article', 'true');
  script.textContent = JSON.stringify(articleJsonLd);
  document.head.appendChild(script);
}

// Загрузка страницы
async function loadPage() {
  if (!props.pageId) return;
  
  try {
    isLoading.value = true;
    
    // Определяем, это slug или id
    // Проверяем, находимся ли мы на странице блога
    const isBlogRoute = route.path.startsWith('/blog');
    
    // Если это строка и не чисто число, или мы на странице блога - считаем это slug
    const isSlug = isBlogRoute || (typeof props.pageId === 'string' && !/^\d+$/.test(props.pageId));
    
    console.log('[DocsContent] loadPage:', { 
      pageId: props.pageId, 
      isBlogRoute, 
      isSlug,
      routePath: route.path 
    });
    
    if (isSlug) {
      // Загружаем по slug через новый endpoint блога
      // Если pageId это число, но мы на странице блога, конвертируем в строку
      const slug = typeof props.pageId === 'string' ? props.pageId : String(props.pageId);
      console.log('[DocsContent] Загрузка по slug:', slug);
      
      try {
        const response = await pagesService.getBlogPageBySlug(slug);
        console.log('[DocsContent] Ответ от API:', {
          hasData: !!response,
          type: typeof response,
          keys: response ? Object.keys(response) : [],
          hasTitle: response?.title,
          hasContent: !!response?.content,
          id: response?.id
        });
        
        if (!response) {
          console.error('[DocsContent] API вернул пустой ответ');
          throw new Error('Страница не найдена');
        }
        
        // Устанавливаем page.value ДО любых других операций
        page.value = response;
        console.log('[DocsContent] page.value установлен:', {
          hasPage: !!page.value,
          hasTitle: !!page.value?.title,
          hasContent: !!page.value?.content,
          pageValue: page.value
        });
        
        // Проверяем, что page.value действительно установлен
        if (!page.value) {
          console.error('[DocsContent] КРИТИЧЕСКАЯ ОШИБКА: page.value не установлен после присваивания!');
        }
      } catch (slugError) {
        console.error('[DocsContent] Ошибка загрузки по slug:', slugError);
        console.error('[DocsContent] Детали ошибки:', {
          message: slugError.message,
          response: slugError.response?.data,
          status: slugError.response?.status
        });
        // Если ошибка 404, пробуем найти страницу по другому способу
        if (slugError.response?.status === 404) {
          console.warn('[DocsContent] Страница не найдена по slug, возможно slug не совпадает');
        }
        throw slugError;
      }
    } else {
      // Загружаем по id (старый способ)
      const pageId = typeof props.pageId === 'number' ? props.pageId : parseInt(props.pageId, 10);
      console.log('[DocsContent] Загрузка по id:', pageId);
      page.value = await pagesService.getPublicPage(pageId);
    }
    
    // Устанавливаем мета-теги для SEO (оборачиваем в try-catch, чтобы ошибка не блокировала отображение)
    if (page.value) {
      console.log('[DocsContent] Устанавливаем мета-теги для страницы:', {
        id: page.value.id,
        title: page.value.title,
        hasContent: !!page.value.content
      });
      try {
      updateMetaTags(page.value);
      } catch (metaError) {
        console.error('[DocsContent] Ошибка установки мета-тегов (не критично):', metaError);
        // Продолжаем работу, даже если мета-теги не установились
      }
    } else {
      console.error('[DocsContent] page.value пусто после загрузки!', {
        response: 'данные не были установлены',
        pageId: props.pageId,
        isSlug
      });
    }
    
    // Загружаем навигацию (только для загрузки по ID, не по slug)
    if (!isSlug && page.value && page.value.id) {
    try {
        navigation.value = await pagesService.getPublicPageNavigation(page.value.id);
      breadcrumbs.value = navigation.value.breadcrumbs || [];
    } catch (navError) {
      console.warn('Ошибка загрузки навигации:', navError);
        navigation.value = null;
        breadcrumbs.value = [];
      }
    } else {
      // Для статей блога навигация не нужна
      navigation.value = null;
      breadcrumbs.value = [];
    }
  } catch (error) {
    console.error('[DocsContent] Ошибка загрузки страницы:', error);
    console.error('[DocsContent] Детали ошибки:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      pageId: props.pageId,
      routePath: route.path,
      stack: error.stack
    });
    
    // Если это не критическая ошибка (например, 404), все равно пытаемся установить page.value
    // если данные есть в response
    if (error.response?.data && error.response.status !== 404) {
      console.warn('[DocsContent] Пытаемся использовать данные из error.response.data');
      page.value = error.response.data;
    } else {
    page.value = null;
    }
  } finally {
    isLoading.value = false;
    console.log('[DocsContent] loadPage завершен:', {
      hasPage: !!page.value,
      isLoading: isLoading.value,
      pageId: props.pageId
    });
  }
}

// Форматирование контента
const formatContent = computed(() => {
  if (!page.value || !page.value.content) return '';
  let content = page.value.content;
  const title = page.value.title || '';
  
  // Удаляем первый заголовок из контента, если он совпадает с title страницы
  // Это предотвращает дублирование заголовка
  
  // Сначала проверяем, есть ли заголовок в HTML формате (если контент уже HTML)
  if (content.includes('<h1') || content.includes('<H1')) {
    // Удаляем заголовки h1 из HTML, если они совпадают с title
    content = content.replace(/<h1[^>]*>([^<]*)<\/h1>/gi, (match, headerText) => {
      const text = headerText.trim();
      if (text.toLowerCase() === title.toLowerCase()) {
        return ''; // Удаляем заголовок
      }
      return match; // Оставляем заголовок
    });
  }
  
  // Удаляем заголовки markdown (# Title, ## Title и т.д.) в начале контента
  const lines = content.split('\n');
  let startIndex = 0;
  
  // Пропускаем пустые строки в начале
  while (startIndex < lines.length && lines[startIndex].trim() === '') {
    startIndex++;
  }
  
  // Проверяем, является ли первая непустая строка заголовком markdown
  if (startIndex < lines.length) {
    const firstLine = lines[startIndex];
    const headerMatch = firstLine.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const headerText = headerMatch[2].trim();
      // Если заголовок совпадает с title страницы, удаляем его
      if (headerText.toLowerCase() === title.toLowerCase()) {
        lines.splice(startIndex, 1);
        // Удаляем следующую пустую строку, если есть
        if (startIndex < lines.length && lines[startIndex].trim() === '') {
          lines.splice(startIndex, 1);
        }
        content = lines.join('\n');
      }
    }
    
    // Также проверяем, не является ли первая строка просто текстом, совпадающим с заголовком
    const firstLineText = firstLine.trim();
    if (firstLineText.toLowerCase() === title.toLowerCase() && !firstLineText.match(/^[#<]/)) {
      // Если первая строка - это просто текст, совпадающий с заголовком, удаляем её
      lines.splice(startIndex, 1);
      // Удаляем следующую пустую строку, если есть
      if (startIndex < lines.length && lines[startIndex].trim() === '') {
        lines.splice(startIndex, 1);
      }
      content = lines.join('\n');
    }
  }
  
  // Конфигурация DOMPurify для разрешения медиа-контента
  const sanitizeConfig = {
    ADD_TAGS: ['video', 'source', 'img', 'iframe', 'pre', 'code'],
    ADD_ATTR: [
      'controls', 'autoplay', 'loop', 'muted', 'poster', 'preload', 'playsinline',
      'src', 'alt', 'title', 'width', 'height', 'style', 'class', 'loading',
      'frameborder', 'allowfullscreen', 'allow'
    ],
    ALLOW_DATA_ATTR: true,
    // Сохраняем пробелы в HTML
    KEEP_CONTENT: true,
    // Не удаляем пробелы внутри тегов
    FORBID_TAGS: [],
    FORBID_ATTR: []
  };
  
  // Проверяем, является ли контент HTML (содержит HTML теги)
  const isHtml = /<[a-z][\s\S]*>/i.test(content);
  
  // Проверяем, является ли контент markdown
  const isMarkdown = !isHtml && /^#{1,6}\s|^\*\s|^\-\s|^\d+\.\s|```|\[.+\]\(.+\)|!\[.+\]\(.+\)/m.test(content);
  
  if (isMarkdown) {
    const rawHtml = marked.parse(content);
    // Разрешаем теги video, source, img и их атрибуты для корректного отображения медиа
    let sanitizedHtml = DOMPurify.sanitize(rawHtml, sanitizeConfig);
    
    // Преобразуем iframe с видео-файлами в тег video для корректного воспроизведения
    // Quill вставляет видео как iframe, но для локальных файлов нужен тег video
    sanitizedHtml = sanitizedHtml.replace(/<iframe([^>]*?)src=["']([^"']+)["']([^>]*?)><\/iframe>/gi, (match, attrs1, url, attrs2) => {
      // Проверяем, является ли это видео-файл из нашей системы (по URL)
      if (url.includes('/api/uploads/media/') && url.includes('/file')) {
        // Преобразуем в тег video для локальных видео-файлов
        return `<video controls class="ql-video" style="max-width: 100%; width: 100%; height: auto; min-height: 400px; border-radius: 8px; margin: 1.5rem 0; display: block;" src="${url}"></video>`;
      }
      // Оставляем iframe для внешних видео (YouTube, Vimeo и т.д.)
      return match;
    });
    
    // Еще раз удаляем заголовки h1 из HTML после парсинга markdown
    sanitizedHtml = sanitizedHtml.replace(/<h1[^>]*>([^<]*)<\/h1>/gi, (match, headerText) => {
      const text = headerText.trim();
      if (text.toLowerCase() === title.toLowerCase()) {
        return ''; // Удаляем заголовок
      }
      return match; // Оставляем заголовок
    });
    
    // Удаляем только пустые теги в начале, но сохраняем пробелы внутри контента
    sanitizedHtml = sanitizedHtml.replace(/^(<br\s*\/?>|<p>\s*<\/p>)+/i, '');
    // Обрезаем только пробелы в самом начале и конце, но не внутри
    sanitizedHtml = sanitizedHtml.replace(/^\s+/, '').replace(/\s+$/, '');
    
    return sanitizedHtml;
  } else if (isHtml) {
    // Если контент уже в HTML формате, санитизируем его с сохранением медиа
    let sanitizedHtml = DOMPurify.sanitize(content, sanitizeConfig);
    
    // Преобразуем iframe с видео-файлами в тег video для корректного воспроизведения
    // Quill вставляет видео как iframe, но для локальных файлов нужен тег video
    sanitizedHtml = sanitizedHtml.replace(/<iframe([^>]*?)src=["']([^"']+)["']([^>]*?)><\/iframe>/gi, (match, attrs1, url, attrs2) => {
      // Проверяем, является ли это видео-файл из нашей системы (по URL)
      if (url.includes('/api/uploads/media/') && url.includes('/file')) {
        // Преобразуем в тег video для локальных видео-файлов
        return `<video controls class="ql-video" style="max-width: 100%; width: 100%; height: auto; min-height: 400px; border-radius: 8px; margin: 1.5rem 0; display: block;" src="${url}"></video>`;
      }
      // Оставляем iframe для внешних видео (YouTube, Vimeo и т.д.)
      return match;
    });
    
    // Удаляем заголовки h1 из HTML, если они совпадают с title
    sanitizedHtml = sanitizedHtml.replace(/<h1[^>]*>([^<]*)<\/h1>/gi, (match, headerText) => {
      const text = headerText.trim();
      if (text.toLowerCase() === title.toLowerCase()) {
        return ''; // Удаляем заголовок
      }
      return match; // Оставляем заголовок
    });
    
    // Обрезаем только пробелы в самом начале и конце, но не внутри
    sanitizedHtml = sanitizedHtml.replace(/^\s+/, '').replace(/\s+$/, '');
    return sanitizedHtml;
  } else {
    // Для обычного текста также удаляем первую строку, если она совпадает с заголовком
    const textLines = content.split('\n');
    if (textLines.length > 0 && textLines[0].trim().toLowerCase() === title.toLowerCase()) {
      textLines.shift();
      // Удаляем следующую пустую строку, если есть
      if (textLines.length > 0 && textLines[0].trim() === '') {
        textLines.shift();
      }
      content = textLines.join('\n');
    }
    return content.replace(/\n/g, '<br>');
  }
});

function formatDate(date) {
  if (!date) return 'Не указана';
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function navigateTo(path) {
  // Поддержка разных форматов путей
  const match1 = path.match(/\/content\/published\/(\d+)/);
  const match2 = path.match(/\/content\/published\?page=(\d+)/);
  const match3 = path.match(/\/public\/page\/(\d+)/);
  
  const pageId = match1?.[1] || match2?.[1] || match3?.[1];
  if (pageId) {
    router.push({ name: 'content-published', query: { page: pageId } });
  }
}

// Редактирование документа
function editPage() {
  if (!page.value || !page.value.id) return;
  router.push({ name: 'content-create', query: { edit: page.value.id } });
}

// Подтверждение удаления документа
async function confirmDeletePage() {
  if (!page.value || !page.value.id) return;
  
  if (!confirm(`Вы уверены, что хотите удалить документ "${page.value.title}"?\n\nЭто действие нельзя отменить.`)) {
    return;
  }
  
  try {
    console.log('[DocsContent] Удаление документа:', page.value.id);
    await pagesService.deletePage(page.value.id);
    console.log('[DocsContent] Документ успешно удален');
    
    // Возвращаемся к списку документов
    emit('back');
    
    // Уведомляем другие компоненты об обновлении
    window.dispatchEvent(new CustomEvent('docs-structure-updated'));
  } catch (error) {
    console.error('[DocsContent] Ошибка удаления документа:', error);
    alert('Ошибка удаления: ' + (error.response?.data?.error || error.message || 'Неизвестная ошибка'));
  }
}

// Ручная переиндексация документа в векторный поиск
async function reindexPage() {
  if (!page.value || !page.value.id) return;
  try {
    await api.post(`/pages/${page.value.id}/reindex`);
    alert('Индексация выполнена');
  } catch (error) {
    console.error('[DocsContent] Ошибка индексации документа:', error);
    alert('Ошибка индексации: ' + (error.response?.data?.error || error.message || 'Неизвестная ошибка'));
  }
}

// Отслеживаем изменения pageId
watch(() => props.pageId, (newId, oldId) => {
  console.log('[DocsContent] pageId изменился:', { oldId, newId });
  if (newId && newId !== oldId) {
    console.log('[DocsContent] Загружаем страницу:', newId);
    loadPage();
  } else if (!newId) {
    // Если pageId стал null, очищаем страницу
    page.value = null;
    navigation.value = null;
    breadcrumbs.value = [];
  }
}, { immediate: true });

// Обработка ошибок загрузки видео
function setupVideoErrorHandlers() {
  nextTick(() => {
    const videoElements = document.querySelectorAll('.content-text video, .page-article video');
    videoElements.forEach((video) => {
      video.addEventListener('error', (e) => {
        console.error('Ошибка загрузки видео:', e);
        const error = e.target.error;
        let errorMessage = 'Неизвестная ошибка';
        
        if (error) {
          switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
              errorMessage = 'Загрузка видео была прервана';
              break;
            case error.MEDIA_ERR_NETWORK:
              errorMessage = 'Ошибка сети при загрузке видео';
              break;
            case error.MEDIA_ERR_DECODE:
              errorMessage = 'Ошибка декодирования видео';
              break;
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage = 'Формат видео не поддерживается';
              break;
            default:
              errorMessage = `Ошибка загрузки видео (код: ${error.code})`;
          }
        }
        
        // Показываем сообщение об ошибке вместо видео
        const errorDiv = document.createElement('div');
        errorDiv.className = 'video-error';
        errorDiv.style.cssText = 'padding: 20px; background: #fee; border: 1px solid #fcc; border-radius: 8px; margin: 1.5rem 0; color: #c33;';
        errorDiv.textContent = `❌ ${errorMessage}`;
        video.parentNode?.replaceChild(errorDiv, video);
      });
    });
  });
}

// Отслеживание изменений page для диагностики
watch(() => page.value, (newPage, oldPage) => {
  console.log('[DocsContent] page.value изменился:', {
    wasNull: oldPage === null,
    isNull: newPage === null,
    hasTitle: !!newPage?.title,
    hasContent: !!newPage?.content,
    pageId: newPage?.id,
    slug: newPage?.slug
  });
}, { deep: true });

// Отслеживание изменений контента для добавления обработчиков ошибок
watch(() => page.value?.content, () => {
  if (page.value?.content) {
    setupVideoErrorHandlers();
  }
});

onMounted(() => {
  if (props.pageId) {
    loadPage();
  }
  setupVideoErrorHandlers();
});
</script>

<style scoped>
.docs-content {
  flex: 1;
  max-width: 900px;
  margin: 0 auto;
  padding: 40px;
  min-height: 100%;
  width: 100%;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  margin-bottom: 16px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  color: #495057;
  text-decoration: none;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #e9ecef;
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  font-size: 0.9rem;
  flex-wrap: wrap;
}

.breadcrumb-item {
  color: #6c757d;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color 0.2s;
}

.breadcrumb-item:hover:not(.active) {
  color: var(--color-primary);
}

.breadcrumb-item.active {
  color: #495057;
  font-weight: 500;
}

.breadcrumb-separator {
  font-size: 0.7rem;
  color: #adb5bd;
}

.page-header {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 2px solid #e9ecef;
}

.page-header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-header-actions {
  display: flex;
  gap: 8px;
}

.page-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  background: #fff;
  color: #495057;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.page-action-btn:hover {
  border-color: var(--color-primary);
}

.page-edit-btn:hover {
  background: #e7f3ff;
  color: var(--color-primary);
}

.page-delete-btn:hover {
  background: #fee;
  color: #dc3545;
  border-color: #dc3545;
}

.page-header h1 {
  margin: 0 0 16px 0;
  font-size: 2.5rem;
  color: var(--color-primary);
  font-weight: 700;
  line-height: 1.2;
}

.page-summary {
  font-size: 1.1rem;
  color: #6c757d;
  margin-bottom: 16px;
  line-height: 1.6;
}

.page-meta {
  display: flex;
  gap: 20px;
  font-size: 0.9rem;
  color: #6c757d;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-item i {
  font-size: 0.85rem;
}

.page-article {
  margin-bottom: 48px;
}

.content-text {
  line-height: 1.7;
  color: #333;
}

.content-text :deep(h1),
.content-text :deep(h2),
.content-text :deep(h3),
.content-text :deep(h4) {
  color: var(--color-primary);
  margin-top: 2rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

.content-text :deep(h1) {
  font-size: 2rem;
  border-bottom: 2px solid #e9ecef;
  padding-bottom: 0.5rem;
}

.content-text :deep(h2) {
  font-size: 1.5rem;
}

.content-text :deep(h3) {
  font-size: 1.25rem;
}

.content-text :deep(p) {
  margin-bottom: 1rem;
}

.content-text :deep(ul),
.content-text :deep(ol) {
  margin: 1rem 0;
  padding-left: 2rem;
}

.content-text :deep(li) {
  margin: 0.5rem 0;
}

.content-text :deep(code) {
  background: #f4f4f4;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.content-text :deep(pre) {
  background: #f4f4f4;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1.5rem 0;
}

.content-text :deep(pre code) {
  background: none;
  padding: 0;
}

.content-text :deep(blockquote) {
  border-left: 4px solid var(--color-primary);
  padding-left: 1rem;
  margin: 1.5rem 0;
  color: #666;
  font-style: italic;
}

.content-text :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5rem 0;
}

.content-text :deep(table th),
.content-text :deep(table td) {
  border: 1px solid #ddd;
  padding: 0.75rem;
  text-align: left;
}

.content-text :deep(table th) {
  background: #f8f9fa;
  font-weight: 600;
}

.content-text :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
}

.content-text :deep(a:hover) {
  text-decoration: underline;
}

/* Стили для изображений в контенте */
.content-text :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1.5rem 0;
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.content-text :deep(img:hover) {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Стили для видео в контенте */
.content-text :deep(video) {
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

.content-text :deep(video.ql-video) {
  width: 100%;
  max-width: 100%;
  min-height: 400px;
}

.content-text :deep(video:focus) {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Стили для iframe в контенте (для видео) */
.content-text :deep(iframe) {
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

.content-text :deep(iframe.ql-video) {
  min-height: 400px;
  aspect-ratio: 16 / 9;
}

.content-text :deep(iframe:focus) {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.file-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 2rem 0;
}

.pdf-embed {
  width: 100%;
  height: 70vh;
  border: 1px solid #e9ecef;
  border-radius: 8px;
}

.image-preview {
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.btn-outline {
  background: white;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.btn-outline:hover {
  background: var(--color-primary);
  color: white;
}

.empty-content {
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
}

.empty-content i {
  font-size: 3rem;
  margin-bottom: 16px;
  display: block;
}

.page-navigation {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 48px;
  padding-top: 32px;
  border-top: 2px solid #e9ecef;
}

.nav-link {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  text-decoration: none;
  color: #495057;
  transition: all 0.2s;
}

.nav-link:hover:not(.disabled) {
  border-color: var(--color-primary);
  background: #f8f9fa;
  color: var(--color-primary);
}

.nav-link.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-prev {
  text-align: left;
}

.nav-next {
  text-align: right;
}

.nav-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #6c757d;
  margin-bottom: 8px;
  font-weight: 500;
}

.nav-next .nav-label {
  justify-content: flex-end;
}

.nav-title {
  font-weight: 600;
  color: #333;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 60px 20px;
}

.loading-spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  font-size: 4rem;
  color: #ff9800;
  margin-bottom: 20px;
}

.error-state h3 {
  color: var(--color-primary);
  margin: 0 0 10px 0;
}

.error-state p {
  color: #6c757d;
  margin: 0;
}

@media (max-width: 768px) {
  .docs-content {
    padding: 20px;
    min-height: auto;
    width: 100%;
    max-width: 100%;
    display: block;
    visibility: visible;
    opacity: 1;
  }

  .page-header h1 {
    font-size: 2rem;
  }

  .page-article {
    width: 100%;
    overflow-x: auto;
  }

  .content-text {
    width: 100%;
    overflow-x: auto;
    word-wrap: break-word;
  }

  .file-preview {
    width: 100%;
  }

  .pdf-embed {
    width: 100%;
    height: 60vh;
    min-height: 400px;
  }

  .image-preview {
    width: 100%;
    max-width: 100%;
  }

  .page-navigation {
    grid-template-columns: 1fr;
  }

  .nav-next {
    text-align: left;
  }

  .nav-next .nav-label {
    justify-content: flex-start;
  }
}
</style>

