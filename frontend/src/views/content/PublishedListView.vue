<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="published-page">
      <div class="published-page__toolbar">
        <button class="published-page__close" type="button" :title="t('common.close')" @click="goBack">×</button>
      </div>

      <!-- Просмотр одного документа -->
      <div v-if="currentPageId" class="published-page__reader">
        <DocsContent :page-id="currentPageId" @back="goToIndex" />
      </div>

      <!-- Список документов -->
      <div v-else class="published-page__list-wrap">
        <BlogFeedToolbar v-model="activeFilter" :filters="sectionFilters" />

        <div v-if="isLoading" class="published-page__state">
          <div class="published-page__spinner" />
          <p>{{ t('content.publishedList.loading') }}</p>
        </div>

        <div v-else-if="filteredPages.length === 0" class="published-page__state">
          <div class="published-page__empty-icon"><i class="fas fa-file-alt" /></div>
          <h3>{{ t('content.publishedList.emptyTitle') }}</h3>
        </div>

        <ul v-else class="published-page__list">
          <li
            v-for="page in filteredPages"
            :key="page.id"
            class="published-page__item"
          >
            <button type="button" class="published-page__item-main" @click="openPublic(page.id)">
              <span class="published-page__item-title">{{ page.title }}</span>
              <span v-if="page.summary" class="published-page__item-summary">{{ page.summary }}</span>
              <span class="published-page__item-meta">
                <span v-if="page.category" class="published-page__item-cat">
                  {{ formatCategoryName(page.category) }}
                </span>
                <span v-if="page.created_at" class="published-page__item-date">
                  {{ formatDate(page.created_at) }}
                </span>
              </span>
            </button>

            <div v-if="canManageDocs" class="published-page__item-actions">
              <button
                type="button"
                class="published-page__action"
                :title="t('content.publishedList.editDocument')"
                @click="editPage(page.id)"
              >
                <i class="fas fa-edit" />
              </button>
              <button
                type="button"
                class="published-page__action"
                :title="t('content.publishedList.editStructure')"
                @click="editPageStructure(page)"
              >
                <i class="fas fa-cog" />
              </button>
              <button
                type="button"
                class="published-page__action published-page__action--danger"
                :title="t('content.publishedList.deleteDocument')"
                @click="confirmDeletePage(page)"
              >
                <i class="fas fa-trash" />
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div v-if="showEditPageModal && editingPage" class="modal-overlay" @click="showEditPageModal = false">
      <div class="modal-content modal-large" @click.stop>
        <div class="modal-header">
          <h3>{{ t('content.publishedList.structureModalTitle') }}</h3>
          <button class="modal-close" type="button" @click="showEditPageModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>{{ t('content.publishedList.documentLabel') }}</label>
            <div class="form-readonly">{{ editingPage.title }}</div>
          </div>
          <div class="form-group">
            <label>{{ t('content.publishedList.parentDocumentLabel') }}</label>
            <select v-model="editingPage.parent_id" class="form-input">
              <option :value="null">{{ t('content.publishedList.noParent') }}</option>
              <option
                v-for="parent in availableParents"
                :key="parent.id"
                :value="parent.id"
              >
                {{ parent.title }}
              </option>
            </select>
            <small class="form-hint">{{ t('content.publishedList.parentHint') }}</small>
          </div>
          <div class="form-group">
            <label>{{ t('content.publishedList.categoryLabel') }}</label>
            <input
              v-model="editingPage.category"
              type="text"
              class="form-input"
              :placeholder="t('content.publishedList.categoryPlaceholder')"
              list="published-categories-list"
            />
            <datalist id="published-categories-list">
              <option v-for="cat in allCategories" :key="cat" :value="cat">
                {{ formatCategoryName(cat) }}
              </option>
            </datalist>
            <small class="form-hint">{{ t('content.publishedList.categoryHint') }}</small>
          </div>
          <div class="form-group">
            <label>{{ t('content.publishedList.sortOrderLabel') }}</label>
            <input
              v-model.number="editingPage.order_index"
              type="number"
              min="0"
              class="form-input"
              placeholder="0"
            />
            <small class="form-hint">{{ t('content.publishedList.sortOrderHint') }}</small>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input v-model="editingPage.is_index_page" type="checkbox" class="form-checkbox" />
              {{ t('content.publishedList.indexPageCheckbox') }}
            </label>
            <small class="form-hint">{{ t('content.publishedList.indexPageHint') }}</small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" type="button" @click="showEditPageModal = false">
            {{ t('common.cancel') }}
          </button>
          <button class="btn btn-primary" type="button" :disabled="isSaving" @click="savePageStructure">
            {{ isSaving ? t('common.saving') : t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import DocsContent from '../../components/docs/DocsContent.vue';
import BlogFeedToolbar from '../../components/blog/BlogFeedToolbar.vue';
import pagesService from '../../services/pagesService';
import { usePermissions } from '../../composables/usePermissions';
import { PERMISSIONS } from '../../composables/permissions';

const ALL_FILTER = 'all';
const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});

defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const { hasPermission } = usePermissions();

const canManageDocs = computed(() => hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS));

const pages = ref([]);
const isLoading = ref(false);
const activeFilter = ref(ALL_FILTER);
const showEditPageModal = ref(false);
const editingPage = ref(null);
const isSaving = ref(false);
const allCategories = ref([]);

const currentPageId = computed(() => {
  const queryPage = route.query.page;
  if (queryPage) {
    const pageId = typeof queryPage === 'string' ? parseInt(queryPage, 10) : queryPage;
    if (!Number.isNaN(pageId)) return pageId;
  }
  if (route.name === 'public-page-view' && route.params.id) {
    const pageId = typeof route.params.id === 'string' ? parseInt(route.params.id, 10) : route.params.id;
    if (!Number.isNaN(pageId)) return pageId;
  }
  return null;
});

function normalizeCategory(page) {
  const raw = String(page?.category || '').trim().toLowerCase();
  return raw || 'uncategorized';
}

function isBlogPage(page) {
  if (page?.show_in_blog === true || page?.show_in_blog === 'true') return true;
  const cat = normalizeCategory(page);
  return cat === 'блог' || cat === 'blog';
}

const documentPages = computed(() => {
  if (!Array.isArray(pages.value)) return [];
  return pages.value.filter((page) => !isBlogPage(page));
});

const sectionFilters = computed(() => {
  const labels = {
    [ALL_FILTER]: {
      label_ru: t('content.publishedList.filterAll'),
      label_en: t('content.publishedList.filterAll'),
    },
  };
  const seen = new Set();
  const filters = [{
    slug: ALL_FILTER,
    label_ru: labels[ALL_FILTER].label_ru,
    label_en: labels[ALL_FILTER].label_en,
    is_default: true,
  }];

  documentPages.value.forEach((page) => {
    const cat = normalizeCategory(page);
    if (seen.has(cat)) return;
    seen.add(cat);
    const label = formatCategoryName(cat);
    filters.push({
      slug: cat,
      label_ru: label,
      label_en: label,
      is_default: false,
    });
  });

  return filters;
});

const filteredPages = computed(() => {
  let list = [...documentPages.value];
  if (activeFilter.value && activeFilter.value !== ALL_FILTER) {
    list = list.filter((page) => normalizeCategory(page) === activeFilter.value);
  }

  return list.sort((a, b) => {
    const catCmp = normalizeCategory(a).localeCompare(normalizeCategory(b), 'ru');
    if (catCmp !== 0) return catCmp;
    const orderCmp = (a.order_index || 0) - (b.order_index || 0);
    if (orderCmp !== 0) return orderCmp;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
});

watch(sectionFilters, (filters) => {
  if (isLoading.value) return;
  if (filters.some((f) => f.slug === activeFilter.value)) return;
  const fromRoute = typeof route.query.section === 'string'
    ? route.query.section.trim().toLowerCase()
    : '';
  // Не сбрасываем раздел из URL, пока категории ещё не подтянулись
  if (fromRoute && activeFilter.value === fromRoute) return;
  activeFilter.value = ALL_FILTER;
});

function applySectionFromRoute() {
  const raw = route.query.section;
  if (typeof raw === 'string' && raw.trim()) {
    activeFilter.value = raw.trim().toLowerCase();
    return;
  }
  if (!route.query.section) {
    // не сбрасываем, если пользователь уже выбрал фильтр без query
  }
}

function syncSectionToRoute(slug) {
  if (currentPageId.value) return;
  const nextQuery = { ...route.query };
  delete nextQuery.page;
  if (!slug || slug === ALL_FILTER) {
    delete nextQuery.section;
  } else {
    nextQuery.section = slug;
  }
  const curSection = typeof route.query.section === 'string' ? route.query.section : undefined;
  const nextSection = nextQuery.section;
  if (curSection === nextSection || (!curSection && !nextSection)) {
    return;
  }
  router.replace({ name: 'content-published', query: nextQuery }).catch(() => {});
}

watch(
  () => route.query.section,
  () => {
    applySectionFromRoute();
  }
);

watch(activeFilter, (slug) => {
  syncSectionToRoute(slug);
});

function goBack() {
  router.push({ name: 'content-list' });
}

function openPublic(id) {
  const query = { page: id };
  if (activeFilter.value && activeFilter.value !== ALL_FILTER) {
    query.section = activeFilter.value;
  }
  router.push({ name: 'content-published', query }).catch(() => {});
}

function goToIndex() {
  const query = {};
  if (activeFilter.value && activeFilter.value !== ALL_FILTER) {
    query.section = activeFilter.value;
  } else if (typeof route.query.section === 'string' && route.query.section.trim()) {
    query.section = route.query.section.trim().toLowerCase();
  }
  router.push({ name: 'content-published', query });
}

function editPage(id) {
  router.push({ name: 'content-create', query: { edit: id } });
}

async function confirmDeletePage(page) {
  if (!confirm(t('content.publishedList.confirmDelete', { title: page.title }))) return;

  try {
    await pagesService.deletePage(page.id);
    await loadPages();
    window.dispatchEvent(new CustomEvent('docs-structure-updated'));
    if (currentPageId.value === page.id) goToIndex();
  } catch (error) {
    alert(t('content.publishedList.deleteError') + (error.response?.data?.error || error.message || t('common.unknownError')));
  }
}

function formatCategoryName(name) {
  if (name === 'uncategorized') return t('content.publishedList.uncategorized');
  if (!name || name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function editPageStructure(page) {
  editingPage.value = {
    id: page.id,
    title: page.title,
    category: page.category || null,
    parent_id: page.parent_id || null,
    order_index: page.order_index || 0,
    is_index_page: page.is_index_page || false,
  };
  loadCategories();
  showEditPageModal.value = true;
}

async function loadCategories() {
  try {
    const categories = await pagesService.getCategories();
    allCategories.value = Array.isArray(categories)
      ? categories.filter((cat) => {
        const n = String(cat || '').trim().toLowerCase();
        return n && n !== 'блог' && n !== 'blog';
      })
      : [];
  } catch {
    allCategories.value = [];
  }
}

const availableParents = computed(() => {
  if (!editingPage.value) return [];
  return documentPages.value.filter((page) =>
    page.id !== editingPage.value.id
    && page.category === editingPage.value.category
  );
});

async function savePageStructure() {
  if (!editingPage.value) return;

  try {
    isSaving.value = true;
    const category = editingPage.value.category
      ? editingPage.value.category.trim().toLowerCase()
      : null;

    await pagesService.updatePage(editingPage.value.id, {
      category,
      parent_id: editingPage.value.parent_id || null,
      order_index: editingPage.value.order_index || 0,
      is_index_page: editingPage.value.is_index_page || false,
    });

    showEditPageModal.value = false;
    editingPage.value = null;
    await Promise.all([loadPages(), loadCategories()]);
    window.dispatchEvent(new CustomEvent('docs-structure-updated'));
  } catch (error) {
    alert(t('content.publishedList.saveError') + (error.response?.data?.error || error.message || t('common.unknownError')));
  } finally {
    isSaving.value = false;
  }
}

async function loadPages() {
  try {
    isLoading.value = true;
    const loadedPages = await pagesService.getPublicPages();
    pages.value = Array.isArray(loadedPages) ? loadedPages : [];
  } catch {
    // keep previous
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  applySectionFromRoute();
  await loadPages();
  if (canManageDocs.value) await loadCategories();
  // если в URL раздел «политика…», а фильтр ещё all — применить снова после загрузки
  applySectionFromRoute();
  window.addEventListener('docs-structure-updated', loadPages);
});

onBeforeUnmount(() => {
  window.removeEventListener('docs-structure-updated', loadPages);
});
</script>

<style scoped>
.published-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 40px);
  background: #fafafa;
}

.published-page__toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px 0;
}

.published-page__close {
  border: none;
  background: transparent;
  color: #888;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.published-page__close:hover {
  background: #f0f0f0;
  color: #333;
}

.published-page__list-wrap {
  padding: 8px 24px 32px;
  max-width: 920px;
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
}

.published-page__reader {
  flex: 1;
  overflow: auto;
  background: #fff;
}

.published-page__state {
  text-align: center;
  padding: 64px 16px;
  color: #6c757d;
}

.published-page__spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 12px;
  border: 3px solid #e9ecef;
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: published-spin 0.8s linear infinite;
}

@keyframes published-spin {
  to { transform: rotate(360deg); }
}

.published-page__empty-icon {
  font-size: 2.5rem;
  margin-bottom: 10px;
  color: #adb5bd;
}

.published-page__list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.published-page__item {
  display: flex;
  align-items: stretch;
  gap: 8px;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.published-page__item:hover {
  border-color: rgba(45, 114, 217, 0.35);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

.published-page__item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 14px 16px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.published-page__item-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: #262626;
  line-height: 1.35;
}

.published-page__item-summary {
  font-size: 0.9rem;
  color: #6c757d;
  line-height: 1.4;
}

.published-page__item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 2px;
  font-size: 0.8rem;
  color: #909399;
}

.published-page__item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border-left: 1px solid #f0f0f0;
}

.published-page__action {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #606266;
  cursor: pointer;
}

.published-page__action:hover {
  background: #f5f7fa;
  color: var(--color-primary);
}

.published-page__action--danger:hover {
  color: #c0392b;
  background: #fef0f0;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  width: min(560px, 100%);
  max-height: 90vh;
  overflow: auto;
}

.modal-header,
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e9ecef;
}

.modal-footer {
  border-bottom: none;
  border-top: 1px solid #e9ecef;
  justify-content: flex-end;
}

.modal-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-close {
  border: none;
  background: transparent;
  font-size: 1.4rem;
  cursor: pointer;
  color: #888;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-input {
  height: 40px;
  padding: 0 12px;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font: inherit;
}

.form-readonly {
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.form-hint {
  color: #6c757d;
  font-size: 0.82rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn {
  border: none;
  border-radius: 8px;
  padding: 0.55rem 1rem;
  cursor: pointer;
  font-weight: 500;
}

.btn-secondary {
  background: #e9ecef;
  color: #343a40;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .published-page__list-wrap {
    padding-left: 16px;
    padding-right: 16px;
  }

  .published-page__item {
    flex-direction: column;
  }

  .published-page__item-actions {
    border-left: none;
    border-top: 1px solid #f0f0f0;
    justify-content: flex-end;
  }
}
</style>
