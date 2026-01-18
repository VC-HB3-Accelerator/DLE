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
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="public-page-view">
      <button class="close-btn" @click="goBack">×</button>

      <!-- Заголовок страницы -->
      <div class="page-header" v-if="page">
        <h1>{{ page.title }}</h1>
        <div class="page-meta">
          <span class="page-date">
            <i class="fas fa-calendar"></i>
            {{ formatDate(page.created_at) }}
          </span>
          <span class="page-status published">
            <i class="fas fa-circle"></i>
            Опубликовано
          </span>
          <span class="page-author" v-if="page.author_address">
            <i class="fas fa-user"></i>
            Автор: {{ formatAddress(page.author_address) }}
          </span>
        </div>
      </div>

      <!-- Основной контент -->
      <div class="content-block" v-if="page">
        <!-- Краткое описание -->
        <div v-if="page.summary" class="page-summary">
          <h2>Описание</h2>
          <p>{{ page.summary }}</p>
        </div>

        <!-- Основной контент -->
        <div class="page-content">
          <h2>Содержание</h2>
          <div class="content-text" v-if="page.format === 'html'" v-html="formatContent"></div>
          <div v-else-if="page.format === 'pdf' && page.file_path" class="file-preview">
            <embed :src="page.file_path" type="application/pdf" class="pdf-embed" />
            <a class="btn btn-outline" :href="page.file_path" target="_blank" download>Скачать PDF</a>
          </div>
          <div v-else-if="page.format === 'image' && page.file_path" class="file-preview">
            <img :src="page.file_path" alt="Документ" class="image-preview" />
            <a class="btn btn-outline" :href="page.file_path" target="_blank" download>Скачать изображение</a>
          </div>
          <div v-else class="content-text">Контент не добавлен</div>
        </div>

        <!-- SEO информация -->
        <div v-if="page.seo" class="page-seo">
          <h2>SEO информация</h2>
          <div class="seo-info">
            <div class="seo-item">
              <label>Meta Title:</label>
              <span>{{ page.seo.title || 'Не указан' }}</span>
            </div>
            <div class="seo-item">
              <label>Meta Description:</label>
              <span>{{ page.seo.description || 'Не указан' }}</span>
            </div>
            <div class="seo-item">
              <label>Keywords:</label>
              <span>{{ page.seo.keywords || 'Не указаны' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Загрузка -->
      <div v-else-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Загрузка страницы...</p>
      </div>

      <!-- Ошибка -->
      <div v-else class="error-state">
        <div class="error-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h3>Страница не найдена</h3>
        <p>Запрашиваемая страница не существует или не опубликована</p>
        <button class="btn btn-primary" @click="goBack">
          <i class="fas fa-arrow-left"></i>
          Вернуться к списку
        </button>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import pagesService from '../../services/pagesService';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Props
const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false
  },
  identities: {
    type: Array,
    default: () => []
  },
  tokenBalances: {
    type: Object,
    default: () => ({})
  },
  isLoadingTokens: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();

// Состояние
const page = ref(null);
const isLoading = ref(false);

// Методы
function goBack() {
  router.push({ name: 'content-list' });
}

function formatDate(date) {
  if (!date) return 'Не указана';
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatAddress(address) {
  if (!address) return '';
  // Показываем сокращенный адрес: 0x1234...5678
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const formatContent = computed(() => {
  if (!page.value || !page.value.content) return '';
  const content = page.value.content;
  
  // Проверяем, является ли контент markdown (содержит markdown синтаксис)
  const isMarkdown = /^#{1,6}\s|^\*\s|^\-\s|^\d+\.\s|```|\[.+\]\(.+\)|!\[.+\]\(.+\)/m.test(content);
  
  if (isMarkdown) {
    // Конвертируем markdown в HTML
    const rawHtml = marked.parse(content);
    return DOMPurify.sanitize(rawHtml);
  } else {
    // Простое форматирование - замена переносов строк на <br>
    return content.replace(/\n/g, '<br>');
  }
});

function formatContentAsFunc(content) {
  if (!content) return '';
  if (typeof content !== 'string') return '';
  return content.replace(/\n/g, '<br>');
}

async function loadPage() {
  try {
    isLoading.value = true;
    const pageId = route.params.id;
    page.value = await pagesService.getPublicPage(pageId);
  } catch (error) {
    console.error('Ошибка загрузки страницы:', error);
    page.value = null;
  } finally {
    isLoading.value = false;
  }
}

// Обработка ошибок загрузки видео
function setupVideoErrorHandlers() {
  nextTick(() => {
    const videoElements = document.querySelectorAll('.content-block video, .page-content video');
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

// Отслеживание изменений контента для добавления обработчиков ошибок
watch(() => page.value?.content, () => {
  if (page.value?.content) {
    setupVideoErrorHandlers();
  }
});

// Установка мета-тегов для SEO
function updatePageMetaTags() {
  if (!page.value) return;
  
  // Парсим seo, если это строка
  let seoData = page.value.seo;
  if (typeof seoData === 'string') {
    try {
      seoData = JSON.parse(seoData);
    } catch (e) {
      console.warn('Ошибка парсинга SEO данных:', e);
      seoData = null;
    }
  }
  
  const title = seoData?.title || page.value.title || 'Публичная страница';
  const description = seoData?.description || page.value.summary || '';
  const keywords = seoData?.keywords || '';
  
  // Определяем canonical URL
  const pageUrl = page.value.slug 
    ? `${window.location.origin}/content/published/${encodeURIComponent(page.value.slug)}`
    : `${window.location.origin}/content/published?page=${page.value.id}`;
  
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
  canonical.setAttribute('href', pageUrl);
  
  // Open Graph теги для социальных сетей
  updateOrCreateMeta('og:title', title, 'property');
  updateOrCreateMeta('og:description', description, 'property');
  updateOrCreateMeta('og:type', 'article', 'property');
  updateOrCreateMeta('og:url', pageUrl, 'property');
  
  // Robots meta
  updateOrCreateMeta('robots', 'index, follow');
  
  // Добавляем JSON-LD разметку для статьи
  addArticleJsonLd(page.value, pageUrl, seoData);
}

// Добавляем JSON-LD разметку для статьи
function addArticleJsonLd(pageData, canonicalUrl, seoData) {
  // Удаляем старую разметку, если есть
  const oldScript = document.querySelector('script[type="application/ld+json"][data-public-article]');
  if (oldScript) {
    oldScript.remove();
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
      'name': 'HB3 Accelerator'
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'HB3 Accelerator',
      'url': window.location.origin
    }
  };
  
  if (pageData.category) {
    articleJsonLd.articleSection = pageData.category;
  }
  
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-public-article', 'true');
  script.textContent = JSON.stringify(articleJsonLd);
  document.head.appendChild(script);
}

// Отслеживаем загрузку страницы и обновляем мета-теги
watch(() => page.value, (newPage) => {
  if (newPage) {
    updatePageMetaTags();
  }
}, { immediate: true });

// Загрузка данных
onMounted(() => {
  loadPage();
  setupVideoErrorHandlers();
});
</script>

<style scoped>
.public-page-view {
  padding: 20px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
  z-index: 10;
}

.close-btn:hover {
  color: #333;
}

.page-header {
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.page-header h1 {
  color: var(--color-primary);
  font-size: 2.5rem;
  margin: 0 0 15px 0;
  line-height: 1.2;
}

.page-meta {
  display: flex;
  gap: 20px;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
  flex-wrap: wrap;
}

.page-meta span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.page-status.published {
  color: #4caf50;
}

.content-block {
  background: #f8f9fa;
  border-radius: var(--radius-lg);
  padding: 30px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.page-summary,
.page-content,
.page-seo {
  margin-bottom: 30px;
}

.page-summary:last-child,
.page-content:last-child,
.page-seo:last-child {
  margin-bottom: 0;
}

.page-summary h2,
.page-content h2,
.page-seo h2 {
  color: var(--color-primary);
  font-size: 1.5rem;
  margin: 0 0 15px 0;
}

.page-summary p {
  color: var(--color-grey-dark);
  font-size: 1.1rem;
  line-height: 1.6;
  margin: 0;
}

.content-text,
.seo-content {
  color: var(--color-grey-dark);
  font-size: 1rem;
  line-height: 1.7;
}

/* Markdown стили */
.content-text h1 {
  color: var(--color-primary);
  font-size: 2rem;
  margin: 1.5rem 0 1rem;
  font-weight: 600;
}

.content-text h2 {
  color: var(--color-primary);
  font-size: 1.5rem;
  margin: 1.25rem 0 0.75rem;
  font-weight: 600;
}

.content-text h3 {
  color: var(--color-primary);
  font-size: 1.25rem;
  margin: 1rem 0 0.5rem;
  font-weight: 600;
}

.content-text h4 {
  color: var(--color-primary);
  font-size: 1.1rem;
  margin: 0.75rem 0 0.5rem;
  font-weight: 600;
}

.content-text p {
  margin: 0.75rem 0;
}

.content-text ul,
.content-text ol {
  margin: 1rem 0;
  padding-left: 2rem;
}

.content-text li {
  margin: 0.5rem 0;
}

.content-text code {
  background: #f4f4f4;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.content-text pre {
  background: #f4f4f4;
  padding: 1rem;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  margin: 1rem 0;
}

.content-text pre code {
  background: none;
  padding: 0;
}

.content-text blockquote {
  border-left: 4px solid var(--color-primary);
  padding-left: 1rem;
  margin: 1rem 0;
  color: #666;
}

.content-text table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.content-text table th,
.content-text table td {
  border: 1px solid #ddd;
  padding: 0.5rem;
  text-align: left;
}

.content-text table th {
  background: #f8f9fa;
  font-weight: 600;
}

.content-text a {
  color: var(--color-primary);
  text-decoration: none;
}

.content-text a:hover {
  text-decoration: underline;
}

.content-text hr {
  border: none;
  border-top: 2px solid #f0f0f0;
  margin: 2rem 0;
}

.content-text strong {
  font-weight: 600;
  color: #333;
}

.content-text em {
  font-style: italic;
}
.seo-info { display: grid; gap: 12px; }
.seo-item { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
.seo-item:last-child { border-bottom: none; }
.seo-item label { font-weight: 500; color: var(--color-grey-dark); min-width: 150px; }
.seo-item span { color: #333; flex: 1; margin-left: 20px; }

.file-preview { display: flex; flex-direction: column; gap: 12px; }
.pdf-embed { width: 100%; height: 70vh; border: 1px solid #e9ecef; border-radius: var(--radius-sm); }
.image-preview { max-width: 100%; border: 1px solid #e9ecef; border-radius: var(--radius-sm); }

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
  color: var(--color-grey-dark);
  margin: 0 0 25px 0;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
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

@media (max-width: 768px) {
  .public-page-view {
    padding: 15px;
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
  
  .page-meta {
    flex-direction: column;
    gap: 10px;
  }
  
  .content-block {
    padding: 20px;
  }
}
</style>
