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
    <div class="internal-page page-with-close">
      <PageCloseButton :fallback="{ name: 'content-list' }" />

      <div v-if="currentPageId" class="internal-page__reader">
        <DocsContent :page-id="currentPageId" @back="goToIndex" />
      </div>

      <div v-else class="internal-page__list-wrap">
        <BlogFeedToolbar v-model="activeFilter" :filters="sectionFilters" />

        <div v-if="canManageLegalDocs && address" class="internal-page__access">
          <label for="permission-filter">{{ t('content.internal.accessLevelLabel') }}</label>
          <select v-model="permissionFilter" id="permission-filter" class="internal-page__access-select">
            <option value="">{{ t('content.internal.allLevels') }}</option>
            <option :value="PERMISSIONS.VIEW_BASIC_DOCS">{{ t('content.internal.permissionUsers') }}</option>
            <option :value="PERMISSIONS.VIEW_LEGAL_DOCS">{{ t('content.internal.permissionReaders') }}</option>
            <option :value="PERMISSIONS.MANAGE_LEGAL_DOCS">{{ t('content.internal.permissionEditors') }}</option>
          </select>
        </div>

        <div v-if="isLoading" class="internal-page__state">
          <div class="internal-page__spinner" />
          <p>{{ t('content.internal.loading') }}</p>
        </div>

        <div v-else-if="filteredPages.length === 0" class="internal-page__state">
          <div class="internal-page__empty-icon"><UiGlyph name="file" :size="40" /></div>
          <h3>{{ t('content.internal.emptyTitle') }}</h3>
        </div>

        <ul v-else class="internal-page__list">
          <li
            v-for="page in filteredPages"
            :key="page.id"
            class="internal-page__item"
          >
            <button type="button" class="internal-page__item-main" @click="openInternal(page.id)">
              <span class="internal-page__item-title">{{ page.title }}</span>
              <span
                v-if="page.summary && page.summary.trim() !== (page.title || '').trim()"
                class="internal-page__item-summary"
              >{{ page.summary }}</span>
              <span class="internal-page__item-meta">
                <span v-if="page.category" class="internal-page__item-cat">
                  {{ formatCategoryName(page.category) }}
                </span>
                <span class="internal-page__item-badge">{{ t('content.internal.internalBadge') }}</span>
                <span v-if="page.created_at" class="internal-page__item-date">
                  {{ formatDate(page.created_at) }}
                </span>
              </span>
            </button>

            <div v-if="canManageDocs" class="internal-page__item-actions">
              <button
                type="button"
                class="internal-page__action"
                :title="t('content.publishedList.editDocument')"
                @click="editPage(page.id)"
              >
                <UiGlyph name="edit" />
              </button>
              <button
                type="button"
                class="internal-page__action"
                :title="t('content.publishedList.editStructure')"
                @click="editPageStructure(page)"
              >
                <UiGlyph name="settings" />
              </button>
              <button
                type="button"
                class="internal-page__action internal-page__action--danger"
                :title="t('content.publishedList.deleteDocument')"
                @click="confirmDeletePage(page)"
              >
                <UiGlyph name="trash" />
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
              list="internal-categories-list"
            />
            <datalist id="internal-categories-list">
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
import PageCloseButton from '@/components/PageCloseButton.vue';
import DocsContent from '../../components/docs/DocsContent.vue';
import BlogFeedToolbar from '../../components/blog/BlogFeedToolbar.vue';
import UiGlyph from '../../components/UiGlyph.vue';
import pagesService from '../../services/pagesService';
import { useAuthContext } from '../../composables/useAuth';
import { usePermissions } from '../../composables/usePermissions';
import { PERMISSIONS } from './permissions.js';

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
const { address } = useAuthContext();
const { hasPermission } = usePermissions();

const canManageLegalDocs = computed(() => hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS));
const canManageDocs = canManageLegalDocs;

const pages = ref([]);
const isLoading = ref(false);
const activeFilter = ref(ALL_FILTER);
const permissionFilter = ref('');
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
  return null;
});

function normalizeCategory(page) {
  const raw = String(page?.category || '').trim().toLowerCase();
  return raw || 'uncategorized';
}

function userCanSeePage(p) {
  if (!p.required_permission) return true;
  if (p.required_permission === PERMISSIONS.VIEW_BASIC_DOCS) {
    return hasPermission(PERMISSIONS.VIEW_BASIC_DOCS);
  }
  if (p.required_permission === PERMISSIONS.VIEW_LEGAL_DOCS) {
    return hasPermission(PERMISSIONS.VIEW_LEGAL_DOCS);
  }
  if (p.required_permission === PERMISSIONS.MANAGE_LEGAL_DOCS) {
    return hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS);
  }
  return true;
}

const visiblePages = computed(() => {
  if (!Array.isArray(pages.value)) return [];
  return pages.value.filter((p) => {
    if (p.visibility !== 'internal' || p.status !== 'published') return false;
    if (permissionFilter.value && p.required_permission !== permissionFilter.value) return false;
    return userCanSeePage(p);
  });
});

const sectionFilters = computed(() => {
  const filters = [{
    slug: ALL_FILTER,
    label_ru: t('content.internal.filterAll'),
    label_en: t('content.internal.filterAll'),
    is_default: true,
  }];
  const seen = new Set();
  visiblePages.value.forEach((page) => {
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
  let list = [...visiblePages.value];
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
  if (fromRoute && activeFilter.value === fromRoute) return;
  activeFilter.value = ALL_FILTER;
});

function applySectionFromRoute() {
  const raw = route.query.section;
  if (typeof raw === 'string' && raw.trim()) {
    activeFilter.value = raw.trim().toLowerCase();
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
  if (curSection === nextSection || (!curSection && !nextSection)) return;
  router.replace({ name: 'content-internal', query: nextQuery }).catch(() => {});
}

watch(() => route.query.section, () => { applySectionFromRoute(); });
watch(activeFilter, (slug) => { syncSectionToRoute(slug); });

function openInternal(id) {
  const query = { page: id };
  if (activeFilter.value && activeFilter.value !== ALL_FILTER) {
    query.section = activeFilter.value;
  }
  router.push({ name: 'content-internal', query }).catch(() => {});
}

function goToIndex() {
  const query = {};
  if (activeFilter.value && activeFilter.value !== ALL_FILTER) {
    query.section = activeFilter.value;
  } else if (typeof route.query.section === 'string' && route.query.section.trim()) {
    query.section = route.query.section.trim().toLowerCase();
  }
  router.push({ name: 'content-internal', query });
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
    allCategories.value = Array.isArray(categories) ? categories : [];
  } catch {
    allCategories.value = [];
  }
}

const availableParents = computed(() => {
  if (!editingPage.value) return [];
  return visiblePages.value.filter((page) =>
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
    const loaded = await pagesService.getInternalPages();
    pages.value = Array.isArray(loaded) ? loaded : [];
  } catch {
    pages.value = [];
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  applySectionFromRoute();
  await loadPages();
  if (canManageDocs.value) await loadCategories();
  applySectionFromRoute();
  window.addEventListener('docs-structure-updated', loadPages);
});

onBeforeUnmount(() => {
  window.removeEventListener('docs-structure-updated', loadPages);
});
</script>

<style scoped>
.internal-page {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 40px);
  background: transparent;
}

.internal-page__list-wrap {
  padding: 8px 24px 32px;
  max-width: 920px;
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
}

.internal-page__access {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0 4px;
  font-size: 0.9rem;
  color: #606266;
}

.internal-page__access-select {
  padding: 8px 12px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: #fff;
  font: inherit;
}

.internal-page__reader {
  flex: 1;
  overflow: auto;
  background: #fff;
}

.internal-page__state {
  text-align: center;
  padding: 64px 16px;
  color: #6c757d;
}

.internal-page__spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 12px;
  border: 3px solid #e9ecef;
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: internal-spin 0.8s linear infinite;
}

@keyframes internal-spin {
  to { transform: rotate(360deg); }
}

.internal-page__empty-icon {
  font-size: 2.5rem;
  margin-bottom: 10px;
  color: #adb5bd;
}

.internal-page__list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.internal-page__item {
  display: flex;
  align-items: stretch;
  gap: 8px;
  background: var(--theme-bg, #fff);
  border: 1px solid var(--color-border, #e9ecef);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.internal-page__item:hover {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border, #e9ecef));
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

.internal-page__item-main {
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

.internal-page__item-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: #262626;
  line-height: 1.35;
}

.internal-page__item-summary {
  font-size: 0.9rem;
  color: #6c757d;
  line-height: 1.4;
}

.internal-page__item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 2px;
  font-size: 0.8rem;
  color: #909399;
}

.internal-page__item-badge {
  color: #8a6d3b;
}

.internal-page__item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border-left: 1px solid var(--color-border, #f0f0f0);
}

.internal-page__action {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #606266;
  cursor: pointer;
}

.internal-page__action:hover {
  background: #f5f7fa;
  color: var(--color-primary);
}

.internal-page__action--danger:hover {
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
  .internal-page__list-wrap {
    padding-left: 16px;
    padding-right: 16px;
  }

  .internal-page__item {
    flex-direction: column;
  }

  .internal-page__item-actions {
    border-left: none;
    border-top: 1px solid #f0f0f0;
    justify-content: flex-end;
  }

  .internal-page__access {
    flex-wrap: wrap;
  }
}
</style>
