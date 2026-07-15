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
  <BaseLayout 
    :is-authenticated="isAuthenticated" 
    :identities="identities" 
    :token-balances="tokenBalances" 
    :is-loading-tokens="isLoadingTokens" 
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="blog-page" :class="{ 'blog-page--article': currentPageId || currentSlug }">
      <!-- Если открыта отдельная статья, показываем только её -->
      <div v-if="currentPageId || currentSlug" class="article-view">
        <DocsContent :page-id="currentSlug || currentPageId" :hide-back-button="true" @back="goToIndex" />
      </div>

      <!-- Иначе показываем список статей -->
      <template v-else>
        <!-- Загрузка -->
        <div v-if="isLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>{{ t('blog.loading') }}</p>
        </div>

        <!-- Пустое состояние -->
        <div v-else-if="filteredPages.length === 0" class="empty-state">
          <div class="empty-icon"><i class="fas fa-book-open"></i></div>
          <h3>{{ t('blog.emptyTitle') }}</h3>
          <p>{{ t('blog.emptyDescription') }}</p>
        </div>

        <!-- Лента статей (feed) -->
        <div v-else class="blog-feed">
          <BlogFeedCard
            v-for="page in filteredPages"
            :key="page.id"
            :page="page"
            :is-authenticated="isAuthenticated"
            :article-url="getArticleUrl(page)"
            @open-article="openArticleForEngagement"
            @open-comments="(p) => openArticleForEngagement(p, 'comments')"
          />
        </div>
      </template>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../components/BaseLayout.vue';
import DocsContent from '../components/docs/DocsContent.vue';
import BlogFeedCard from '../components/blog/BlogFeedCard.vue';
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
const { t } = useI18n();

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

function getArticleUrl(page) {
  if (!page?.slug) return `${window.location.origin}/blog`;
  return `${window.location.origin}/blog/${encodeURIComponent(page.slug.trim())}`;
}

function openArticleForEngagement(page, scrollTo = null) {
  // Проверяем, что page - это объект
  if (!page || typeof page !== 'object') {
    console.error('[BlogView] openArticle: невалидный объект страницы');
    return;
  }
  
  // Используем slug если есть, иначе fallback на id
  if (page.slug && typeof page.slug === 'string' && page.slug.trim() !== '') {
    const query = scrollTo === 'comments' ? { scroll: 'comments' } : undefined;
    router.push({ name: 'blog-article', params: { slug: page.slug.trim() }, query }).catch(err => {
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
  const title = t('blog.title');
  const description = t('blog.description');
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
    'name': t('blog.title'),
    'description': t('blog.description'),
    'url': `${window.location.origin}/blog`,
      'blogPost': pages.value
      .filter(page => page.slug && typeof page.slug === 'string' && page.slug.trim() !== '')
      .slice(0, 10)
      .map(page => {
        const url = `${window.location.origin}/blog/${encodeURIComponent(page.slug.trim())}`;

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
  
  if (route.query.subscribed === '1') {
    router.replace({ name: 'blog', query: {} });
  }

  // Устанавливаем мета-теги только если не открыта отдельная статья
  if (!currentPageId.value && !currentSlug.value) {
    updateBlogMetaTags();
    addBlogJsonLd();
  }
});
</script>

<style scoped>
.blog-page {
  max-width: 640px;
  margin: 0 auto;
  padding: var(--block-padding) var(--spacing-lg) 48px;
  min-height: calc(100vh - 200px);
}

.blog-page--article {
  max-width: 920px;
  padding-top: var(--spacing-xl);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 60px var(--spacing-lg);
}

.loading-spinner {
  border: 3px solid var(--color-light);
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto var(--spacing-lg);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 2.5rem;
  color: var(--color-grey);
  margin-bottom: var(--spacing-md);
  opacity: 0.7;
}

.empty-state h3 {
  color: var(--color-dark);
  margin: 0 0 var(--spacing-sm);
  font-size: var(--font-size-xl);
  font-weight: 700;
}

.empty-state p {
  color: var(--color-grey);
  margin: 0;
  font-size: var(--font-size-md);
}

.blog-feed {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.article-view {
  margin-top: 0;
  max-width: 100%;
}

@media (max-width: 480px) {
  .blog-page {
    padding: var(--block-padding-mobile) var(--spacing-sm) 40px;
  }
}
</style>

