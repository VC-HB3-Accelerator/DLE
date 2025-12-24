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
    <div class="blog-page">
      <!-- Если открыта отдельная статья, показываем только её -->
      <div v-if="currentPageId || currentSlug" class="article-view">
        <DocsContent :page-id="currentSlug || currentPageId" :hide-back-button="true" @back="goToIndex" />
      </div>

      <!-- Иначе показываем список статей -->
      <template v-else>
        <!-- Загрузка -->
        <div v-if="isLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>Загрузка статей...</p>
        </div>

        <!-- Пустое состояние -->
        <div v-else-if="filteredPages.length === 0" class="empty-state">
          <div class="empty-icon"><i class="fas fa-book-open"></i></div>
          <h3>Нет статей в блоге</h3>
          <p>Статьи появятся здесь после их публикации редакторами</p>
        </div>

        <!-- Список статей -->
        <div v-else class="blog-articles">
          <article
            v-for="page in filteredPages"
            :key="page.id"
            class="blog-article"
            @click="openArticle(page)"
          >
            <div class="article-header">
              <h2 class="article-title">{{ page.title }}</h2>
              <div v-if="page.category" class="article-category">
                <i class="fas fa-folder"></i>
                {{ formatCategoryName(page.category) }}
              </div>
            </div>
            
            <div v-if="page.summary" class="article-summary">
              {{ page.summary }}
            </div>
            
            <div class="article-meta">
              <span class="article-date">
                <i class="fas fa-calendar"></i>
                {{ formatDate(page.created_at) }}
              </span>
              <span class="article-read-more">
                Читать далее →
              </span>
            </div>
          </article>
        </div>
      </template>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../components/BaseLayout.vue';
import DocsContent from '../components/docs/DocsContent.vue';
import pagesService from '../services/pagesService';

const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});

const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();

const pages = ref([]);
const isLoading = ref(false);

const currentSlug = computed(() => {
  return route.params.slug || null;
});

const currentPageId = computed(() => {
  // Если есть slug, используем его для загрузки страницы
  if (currentSlug.value) {
    return currentSlug.value; // Временно используем slug как идентификатор
  }
  
  // Fallback на старый способ через query параметр
  const queryPage = route.query.page;
  if (queryPage) {
    const pageId = typeof queryPage === 'string' ? parseInt(queryPage, 10) : queryPage;
    if (!isNaN(pageId)) {
      return pageId;
    }
  }
  return null;
});

const filteredPages = computed(() => {
  return pages.value;
});

function formatCategoryName(name) {
  if (name === 'uncategorized') return 'Без категории';
  if (!name || name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function openArticle(page) {
  // Проверяем, что page - это объект
  if (!page || typeof page !== 'object') {
    console.error('[BlogView] openArticle: невалидный объект страницы');
    return;
  }
  
  // Используем slug если есть, иначе fallback на id
  if (page.slug && typeof page.slug === 'string' && page.slug.trim() !== '') {
    router.push({ name: 'blog-article', params: { slug: page.slug.trim() } }).catch(err => {
      console.error('[BlogView] Ошибка навигации:', err);
    });
  } else if (page.id) {
    // Fallback на старый способ через query параметр
    router.push({ name: 'blog', query: { page: page.id } }).catch(err => {
      console.error('[BlogView] Ошибка навигации:', err);
    });
  } else {
    console.error('[BlogView] openArticle: у страницы нет ни slug, ни id');
  }
}

function goToIndex() {
  router.push({ name: 'blog' });
}


async function loadPages() {
  try {
    isLoading.value = true;
    const loadedPages = await pagesService.getBlogPages();
    
    if (!Array.isArray(loadedPages)) {
      console.error('[BlogView] loadedPages не является массивом:', typeof loadedPages, loadedPages);
      pages.value = [];
      return;
    }
    
    pages.value = loadedPages;
  } catch (e) {
    console.error('[BlogView] Ошибка загрузки страниц:', e);
    pages.value = [];
  } finally {
    isLoading.value = false;
  }
}

// Установка мета-тегов для страницы блога
function updateBlogMetaTags() {
  const title = 'Блог';
  const description = 'Публикации и статьи';
  const canonicalUrl = `${window.location.origin}/blog`;
  
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
  updateOrCreateMeta('og:type', 'website', 'property');
  updateOrCreateMeta('og:url', canonicalUrl, 'property');
  
  // Robots meta
  updateOrCreateMeta('robots', 'index, follow');
}

// Добавляем JSON-LD разметку для списка статей
function addBlogJsonLd() {
  // Удаляем старую разметку, если есть
  const oldScript = document.querySelector('script[type="application/ld+json"][data-blog-list]');
  if (oldScript) {
    oldScript.remove();
  }
  
  if (pages.value.length === 0) return;
  
  const blogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    'name': 'Блог',
    'description': 'Публикации и статьи',
    'url': `${window.location.origin}/blog`,
      'blogPost': pages.value.slice(0, 10).map(page => {
        const url = (page.slug && typeof page.slug === 'string' && page.slug.trim() !== '')
          ? `${window.location.origin}/blog/${encodeURIComponent(page.slug)}`
          : (page.id ? `${window.location.origin}/blog?page=${page.id}` : `${window.location.origin}/blog`);
        
        return {
          '@type': 'BlogPosting',
          'headline': page.title || '',
          'description': page.summary || '',
          'datePublished': page.created_at || '',
          'url': url
        };
      })
  };
  
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-blog-list', 'true');
  script.textContent = JSON.stringify(blogJsonLd);
  document.head.appendChild(script);
}

// Следим за изменением currentPageId/currentSlug и обновляем мета-теги
watch(() => currentPageId.value || currentSlug.value, (newId) => {
  if (!newId) {
    // Если вернулись к списку, обновляем мета-теги для списка
    updateBlogMetaTags();
    addBlogJsonLd();
  }
});

// Обновляем JSON-LD при загрузке страниц
watch(() => pages.value, () => {
  if (!currentPageId.value && !currentSlug.value) {
    addBlogJsonLd();
  }
}, { immediate: true });

onMounted(async () => {
  await loadPages();
  
  // Устанавливаем мета-теги только если не открыта отдельная статья
  if (!currentPageId.value && !currentSlug.value) {
    updateBlogMetaTags();
    addBlogJsonLd();
  }
});
</script>

<style scoped>
.blog-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
  min-height: calc(100vh - 200px);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.loading-spinner {
  border: 3px solid var(--color-light, #f3f3f3);
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

.empty-icon {
  font-size: 3rem;
  color: var(--color-grey, #6c757d);
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-state h3 {
  color: var(--color-primary);
  margin: 0 0 10px 0;
  font-size: var(--font-size-xl, 18px);
  font-weight: 600;
}

.empty-state p {
  color: var(--color-grey, #6c757d);
  margin: 0;
  font-size: var(--font-size-md, 14px);
}

.blog-articles {
  display: flex;
  flex-direction: column;
  gap: 30px;
  margin-bottom: 40px;
}

.blog-article {
  background: var(--color-white, #fff);
  border: 1px solid var(--color-border, #e9ecef);
  border-radius: 12px;
  padding: 25px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-sm, 0 2px 4px rgba(0, 0, 0, 0.05));
  display: flex;
  flex-direction: column;
  height: 100%;
}

.blog-article:hover {
  box-shadow: var(--shadow-lg, 0 8px 16px rgba(0, 0, 0, 0.1));
  transform: translateY(-4px);
  border-color: var(--color-primary);
}

.article-header {
  margin-bottom: 15px;
}

.article-title {
  margin: 0 0 10px 0;
  color: var(--color-primary);
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.3;
  transition: color 0.2s ease;
}

.blog-article:hover .article-title {
  color: var(--color-primary-dark, #45a049);
}

.article-category {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--color-grey, #6c757d);
  background: var(--color-light, #f8f9fa);
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: 500;
}

.article-summary {
  color: var(--color-text, #495057);
  line-height: 1.6;
  margin-bottom: 15px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex-grow: 1;
  font-size: var(--font-size-md, 14px);
}

.article-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: var(--color-grey, #6c757d);
  padding-top: 15px;
  border-top: 1px solid var(--color-border, #e9ecef);
  margin-top: auto;
}

.article-date {
  display: flex;
  align-items: center;
  gap: 6px;
}

.article-read-more {
  color: var(--color-primary);
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.blog-article:hover .article-read-more {
  color: var(--color-primary-dark, #45a049);
  transform: translateX(4px);
}

.article-view {
  margin-top: 30px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  margin-bottom: 20px;
  background: var(--color-light, #f8f9fa);
  border: 1px solid var(--color-border, #e9ecef);
  border-radius: 6px;
  color: var(--color-text, #495057);
  text-decoration: none;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.back-btn:hover {
  background: var(--color-grey-light, #e9ecef);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

@media (max-width: 768px) {
  .blog-page {
    padding: 20px 15px;
  }

  .blog-articles {
    gap: 20px;
  }

  .article-title {
    font-size: 1.25rem;
  }

  .article-summary {
    -webkit-line-clamp: 2;
  }
}

@media (max-width: 480px) {
  .blog-page {
    padding: 15px 10px;
  }

  .blog-article {
    padding: 20px;
  }

  .article-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>

