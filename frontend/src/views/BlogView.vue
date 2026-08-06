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
    :document-scroll="true"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="blog-page" :class="{ 'blog-page--article': currentPageId || currentSlug }">
      <!-- Если открыта отдельная статья, показываем только её -->
      <div v-if="currentPageId || currentSlug" class="article-view">
        <DocsContent :page-id="currentSlug || currentPageId" :hide-back-button="true" @back="goToIndex" />
      </div>

      <!-- Иначе показываем список статей -->
      <template v-else>
        <BlogFeedToolbar
          v-model="activeFilter"
          :filters="feedFilters"
          :can-manage="canManageFeed"
          @open-settings="openFeedSettings"
        />

        <!-- Загрузка -->
        <div v-if="isLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>{{ t('blog.loading') }}</p>
        </div>

        <!-- Ошибка загрузки -->
        <div v-else-if="loadError" class="error-state">
          <div class="error-icon"><UiGlyph name="warning" :size="48" /></div>
          <h3>{{ t('blog.loadErrorTitle') }}</h3>
          <p>{{ loadError }}</p>
          <button type="button" class="retry-button" @click="loadPages">
            {{ t('blog.loadErrorRetry') }}
          </button>
        </div>

        <!-- Пустое состояние -->
        <div v-else-if="filteredPages.length === 0" class="empty-state">
          <div class="empty-icon"><BlogGlyph name="book" /></div>
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
import BlogFeedToolbar from '../components/blog/BlogFeedToolbar.vue';
import BlogGlyph from '../components/blog/BlogGlyph.vue';
import UiGlyph from '../components/UiGlyph.vue';
import pagesService from '../services/pagesService';
import blogFeedService from '../services/blogFeedService';
import { usePermissions } from '../composables/usePermissions';
import { PERMISSIONS } from '../composables/permissions.js';

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
const { hasPermission } = usePermissions();

const pages = ref([]);
const isLoading = ref(false);
const loadError = ref('');
const feedFilters = ref([]);
const activeFilter = ref('');
const loadPagesRequestId = ref(0);
const canManageFeed = computed(() => hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS));

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

function openFeedSettings() {
  router.push({ name: 'blog-feed-settings' });
}

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


function readFilterFromRoute() {
  const q = route.query.filter;
  return typeof q === 'string' && q.trim() ? q.trim() : '';
}

function syncFilterQuery(slug) {
  if (currentPageId.value || currentSlug.value) return;
  const current = typeof route.query.filter === 'string' ? route.query.filter : '';
  if (current === slug) return;
  const query = { ...route.query };
  delete query.subscribed;
  if (slug) query.filter = slug;
  else delete query.filter;
  router.replace({ name: 'blog', query }).catch(() => {});
}

async function loadFeedFilters() {
  try {
    const filters = await blogFeedService.getFeedFilters();
    feedFilters.value = Array.isArray(filters) ? filters : [];
    if (!activeFilter.value) {
      const defaultFilter = feedFilters.value.find((f) => f.is_default) || feedFilters.value[0];
      activeFilter.value = defaultFilter?.slug || 'new';
    } else if (!feedFilters.value.some((f) => f.slug === activeFilter.value)) {
      const defaultFilter = feedFilters.value.find((f) => f.is_default) || feedFilters.value[0];
      activeFilter.value = defaultFilter?.slug || 'new';
    }
  } catch (e) {
    console.error('[BlogView] Ошибка загрузки фильтров:', e);
    feedFilters.value = [];
    if (!activeFilter.value) {
      activeFilter.value = 'new';
    }
  }
}

async function loadPages() {
  const requestId = ++loadPagesRequestId.value;
  try {
    isLoading.value = true;
    loadError.value = '';
    const loadedPages = await pagesService.getBlogPages({
      filter: activeFilter.value || undefined,
    });

    if (requestId !== loadPagesRequestId.value) return;
    
    pages.value = loadedPages;
  } catch (e) {
    if (requestId !== loadPagesRequestId.value) return;
    console.error('[BlogView] Ошибка загрузки страниц:', e);
    loadError.value = e.response?.data?.error || e.message || t('blog.loadErrorDefault');
    pages.value = [];
  } finally {
    if (requestId === loadPagesRequestId.value) {
      isLoading.value = false;
    }
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

watch(activeFilter, async (slug, prev) => {
  if (!slug) return;
  if (prev) {
    syncFilterQuery(slug);
  }
  if (!prev || slug === prev) return;
  if (currentPageId.value || currentSlug.value) return;
  await loadPages();
});

watch(
  () => route.query.filter,
  async (filterQuery) => {
    if (currentPageId.value || currentSlug.value) return;
    const next = typeof filterQuery === 'string' && filterQuery.trim()
      ? filterQuery.trim()
      : '';
    if (!next || next === activeFilter.value) return;
    if (feedFilters.value.length && !feedFilters.value.some((f) => f.slug === next)) return;
    activeFilter.value = next;
  }
);

onMounted(async () => {
  const fromUrl = readFilterFromRoute();
  if (fromUrl) {
    activeFilter.value = fromUrl;
  }

  await loadFeedFilters();
  await loadPages();

  if (route.query.subscribed === '1') {
    const query = {};
    if (activeFilter.value) query.filter = activeFilter.value;
    router.replace({ name: 'blog', query });
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
  width: 100%;
  max-width: 640px;
  min-width: 0;
  margin: 0 auto;
  padding: var(--block-padding) var(--spacing-lg) 48px;
  min-height: calc(100vh - 200px);
  box-sizing: border-box;
  overflow-x: hidden;
}

.blog-page--article {
  max-width: 920px;
  padding-top: var(--spacing-xl);
}

.loading-state,
.empty-state,
.error-state {
  text-align: center;
  padding: 60px var(--spacing-lg);
  max-width: 100%;
  box-sizing: border-box;
}

.error-icon {
  font-size: 2.5rem;
  color: var(--color-danger, #c0392b);
  margin-bottom: var(--spacing-md);
  opacity: 0.85;
}

.error-state h3 {
  color: var(--color-dark);
  margin: 0 0 var(--spacing-sm);
  font-size: var(--font-size-xl);
  font-weight: 700;
}

.error-state p {
  color: var(--color-grey);
  margin: 0 0 var(--spacing-lg);
  font-size: var(--font-size-md);
}

.retry-button {
  padding: 10px 20px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md, 8px);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--font-size-md);
  cursor: pointer;
}

.retry-button:hover {
  opacity: 0.9;
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
  display: flex;
  justify-content: center;
  margin-bottom: var(--spacing-md);
  color: var(--color-grey);
  opacity: 0.7;
}

.empty-icon :deep(.blog-glyph) {
  width: 2.5rem;
  height: 2.5rem;
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
  min-width: 0;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

.article-view {
  margin-top: 0;
  max-width: 100%;
  min-width: 0;
  width: 100%;
  overflow-x: hidden;
}

@media (max-width: 768px) {
  .blog-page {
    padding: var(--block-padding-mobile) 0 40px;
  }

  .blog-page--article {
    padding-left: 0;
    padding-right: 0;
  }
}

@media (max-width: 480px) {
  .blog-page {
    padding: var(--spacing-sm) 0 40px;
  }

  .loading-state,
  .empty-state,
  .error-state {
    padding-left: var(--spacing-sm);
    padding-right: var(--spacing-sm);
  }
}


/* TZ package R — .actions не включать: ломает строку карточки блога */
@media (max-width: 768px) {
  .page, .panel, .view, .container, [class*="container"], [class*="panel"], [class*="wrapper"], [class*="management"], [class*="settings"] {
    max-width: 100%;
    box-sizing: border-box;
  }
  .form-row, .row, .toolbar, .header-row, .filters {
    flex-wrap: wrap;
  }
  [class*="grid"]:not(.blog-feed), .form-row {
    grid-template-columns: 1fr !important;
  }
}
</style>

