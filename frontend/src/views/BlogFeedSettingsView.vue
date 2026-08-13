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
    <div class="feed-settings page-with-close">
      <PageCloseButton :fallback="{ name: 'blog' }" />

      <div class="feed-settings__panel">
        <h2>{{ t('blog.feedSettings.title') }}</h2>
        <p class="feed-settings__intro">{{ t('blog.feedSettings.intro') }}</p>

        <div v-if="isLoading" class="feed-settings__loading">
          {{ t('common.loading') }}
        </div>

        <div v-else-if="!canManage" class="feed-settings__denied">
          {{ t('blog.feedSettings.noPermission') }}
        </div>

        <template v-else>
          <section class="feed-settings__section">
            <div class="feed-settings__section-header">
              <h3>{{ t('blog.feedSettings.filtersTitle') }}</h3>
              <button type="button" class="btn btn-primary btn-sm" :disabled="isSaving" @click="addFilter">
                {{ t('blog.feedSettings.addFilter') }}
              </button>
            </div>

            <div
              v-for="(filter, index) in filters"
              :key="filter.key"
              class="feed-settings__card"
            >
              <div class="feed-settings__card-header">
                <span>{{ filter.label_ru || filter.label_en || t('blog.feedSettings.filterN', { n: index + 1 }) }}</span>
                <button
                  type="button"
                  class="btn btn-danger btn-sm"
                  :disabled="isSaving || filters.length <= 1"
                  @click="removeFilter(index)"
                >
                  {{ t('common.delete') }}
                </button>
              </div>

              <div class="feed-settings__grid">
                <label class="feed-settings__field">
                  <span>{{ t('blog.feedSettings.labelRu') }}</span>
                  <input v-model="filter.label_ru" type="text" :disabled="isSaving" />
                </label>
                <label class="feed-settings__field">
                  <span>{{ t('blog.feedSettings.labelEn') }}</span>
                  <input v-model="filter.label_en" type="text" :disabled="isSaving" />
                </label>
                <label class="feed-settings__field">
                  <span>{{ t('blog.feedSettings.slug') }}</span>
                  <input v-model="filter.slug" type="text" :disabled="isSaving" />
                </label>
                <label class="feed-settings__field">
                  <span>{{ t('blog.feedSettings.sortBy') }}</span>
                  <select v-model="filter.sort_by" :disabled="isSaving">
                    <option
                      v-for="opt in sortByOptions"
                      :key="opt"
                      :value="opt"
                    >
                      {{ t(`blog.feedSettings.sortOptions.${opt}`) }}
                    </option>
                  </select>
                </label>
              </div>

              <div class="feed-settings__checks">
                <label>
                  <input v-model="filter.is_active" type="checkbox" :disabled="isSaving" />
                  {{ t('blog.feedSettings.active') }}
                </label>
                <label>
                  <input
                    type="radio"
                    name="default-filter"
                    :checked="filter.is_default"
                    :disabled="isSaving || !filter.is_active"
                    @change="setDefaultFilter(index)"
                  />
                  {{ t('blog.feedSettings.default') }}
                </label>
                <div class="feed-settings__order">
                  <button type="button" class="btn btn-outline btn-sm btn-icon" :disabled="isSaving || index === 0" @click="moveFilter(index, -1)">↑</button>
                  <button type="button" class="btn btn-outline btn-sm btn-icon" :disabled="isSaving || index === filters.length - 1" @click="moveFilter(index, 1)">↓</button>
                </div>
              </div>

              <div class="feed-settings__articles">
                <p class="feed-settings__hint feed-settings__hint--tight">
                  {{ t('blog.feedSettings.filterArticlesHint') }}
                </p>
                <label class="feed-settings__field feed-settings__field--inline">
                  <span>{{ t('blog.feedSettings.addArticleToFilter') }}</span>
                  <select
                    :value="articlePickByFilter[filter.key] || ''"
                    :disabled="isSaving"
                    @change="onAddArticleToFilter(index, $event)"
                  >
                    <option value="">{{ t('blog.feedSettings.selectArticle') }}</option>
                    <option
                      v-for="page in availablePagesForFilter(filter)"
                      :key="page.id"
                      :value="String(page.id)"
                    >
                      {{ page.title || page.slug || `#${page.id}` }}
                    </option>
                  </select>
                </label>
                <ul v-if="filter.page_ids?.length" class="feed-settings__pins">
                  <li
                    v-for="(pageId, pIndex) in filter.page_ids"
                    :key="`${filter.key}-${pageId}`"
                    class="feed-settings__pin"
                  >
                    <span class="feed-settings__pin-title">{{ pageTitle(pageId) }}</span>
                    <div class="feed-settings__order">
                      <button type="button" class="btn btn-outline btn-sm btn-icon" :disabled="isSaving || pIndex === 0" @click="moveFilterArticle(index, pIndex, -1)">↑</button>
                      <button
                        type="button"
                        class="btn btn-outline btn-sm btn-icon"
                        :disabled="isSaving || pIndex === filter.page_ids.length - 1"
                        @click="moveFilterArticle(index, pIndex, 1)"
                      >↓</button>
                      <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        :disabled="isSaving"
                        @click="removeFilterArticle(index, pIndex)"
                      >
                        {{ t('common.delete') }}
                      </button>
                    </div>
                  </li>
                </ul>
                <div v-else class="feed-settings__empty feed-settings__empty--warn">
                  {{ t('blog.feedSettings.noFilterArticles') }}
                  <strong>{{ t('blog.feedSettings.emptyPageIdsMeansAll') }}</strong>
                </div>
              </div>
            </div>
          </section>

          <section class="feed-settings__section">
            <div class="feed-settings__section-header">
              <h3>{{ t('blog.feedSettings.pinsTitle') }}</h3>
            </div>
            <p class="feed-settings__hint">{{ t('blog.feedSettings.pinsHint') }}</p>

            <label class="feed-settings__field feed-settings__field--inline">
              <span>{{ t('blog.feedSettings.addPin') }}</span>
              <select v-model="pinToAdd" :disabled="isSaving" @change="addPin">
                <option value="">{{ t('blog.feedSettings.selectArticle') }}</option>
                <option
                  v-for="page in availablePinPages"
                  :key="page.id"
                  :value="String(page.id)"
                >
                  {{ page.title || page.slug || `#${page.id}` }}
                </option>
              </select>
            </label>

            <div v-if="!pins.length" class="feed-settings__empty">
              {{ t('blog.feedSettings.noPins') }}
            </div>

            <ul v-else class="feed-settings__pins">
              <li
                v-for="(pin, index) in pins"
                :key="pin.page_id"
                class="feed-settings__pin"
              >
                <span class="feed-settings__pin-title">
                  {{ pinTitle(pin) }}
                  <em v-if="pin.is_pinned_badge">{{ t('blog.feedSettings.pinnedBadge') }}</em>
                </span>
                <div class="feed-settings__order">
                  <button type="button" class="btn btn-outline btn-sm btn-icon" :disabled="isSaving || index === 0" @click="movePin(index, -1)">↑</button>
                  <button type="button" class="btn btn-outline btn-sm btn-icon" :disabled="isSaving || index === pins.length - 1" @click="movePin(index, 1)">↓</button>
                  <button type="button" class="btn btn-danger btn-sm" :disabled="isSaving" @click="removePin(index)">
                    {{ t('common.delete') }}
                  </button>
                </div>
              </li>
            </ul>
          </section>

          <p v-if="saveError" class="feed-settings__error">{{ saveError }}</p>
          <p v-if="saveSuccess" class="feed-settings__success">{{ saveSuccess }}</p>

          <div class="feed-settings__actions">
            <button type="button" class="btn btn-primary" :disabled="isSaving" @click="handleSave">
              {{ isSaving ? t('common.saving') : t('common.save') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import blogFeedService from '../services/blogFeedService';
import pagesService from '../services/pagesService';
import { usePermissions } from '../composables/usePermissions';
import { PERMISSIONS } from '../composables/permissions.js';

defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false },
});

defineEmits(['auth-action-completed']);

const { t } = useI18n();
const { hasPermission } = usePermissions();

const canManage = computed(() => hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS));

const isLoading = ref(true);
const isSaving = ref(false);
const saveError = ref('');
const saveSuccess = ref('');
const filters = ref([]);
const pins = ref([]);
const blogPages = ref([]);
const pinToAdd = ref('');
const articlePickByFilter = ref({});
const sortByOptions = ref(['new', 'views', 'likes', 'comments', 'popular']);

const pageTitleById = computed(() => {
  const map = new Map();
  for (const page of blogPages.value) {
    map.set(page.id, page.title || page.slug || `#${page.id}`);
  }
  return map;
});

const availablePinPages = computed(() => {
  const pinnedIds = new Set(pins.value.map((p) => p.page_id));
  return blogPages.value.filter((p) => !pinnedIds.has(p.id));
});

function pageTitle(pageId) {
  return pageTitleById.value.get(pageId) || `#${pageId}`;
}

function availablePagesForFilter(filter) {
  const taken = new Set(filter.page_ids || []);
  return blogPages.value.filter((p) => !taken.has(p.id));
}

function makeKey() {
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createFilter(data = {}, index = 0) {
  return {
    key: makeKey(),
    id: data.id ?? null,
    slug: data.slug || '',
    label_ru: data.label_ru || '',
    label_en: data.label_en || '',
    sort_by: data.sort_by || 'new',
    is_default: Boolean(data.is_default),
    is_active: data.is_active !== false,
    position: data.position ?? index,
    page_ids: Array.isArray(data.page_ids) ? [...data.page_ids] : [],
  };
}

function pinTitle(pin) {
  return pageTitleById.value.get(pin.page_id) || pin.title || `#${pin.page_id}`;
}

function addFilter() {
  filters.value.push(createFilter({
    slug: `filter-${filters.value.length + 1}`,
    label_ru: '',
    label_en: '',
    sort_by: 'new',
    is_default: false,
    is_active: true,
    page_ids: [],
  }, filters.value.length));
}

function removeFilter(index) {
  if (filters.value.length <= 1) return;
  const wasDefault = filters.value[index].is_default;
  filters.value.splice(index, 1);
  if (wasDefault && filters.value.length) {
    const firstActive = filters.value.find((f) => f.is_active) || filters.value[0];
    firstActive.is_default = true;
  }
}

function setDefaultFilter(index) {
  filters.value = filters.value.map((f, i) => ({
    ...f,
    is_default: i === index,
    is_active: i === index ? true : f.is_active,
  }));
}

function moveFilter(index, delta) {
  const next = index + delta;
  if (next < 0 || next >= filters.value.length) return;
  const list = [...filters.value];
  const [item] = list.splice(index, 1);
  list.splice(next, 0, item);
  filters.value = list;
}

function onAddArticleToFilter(filterIndex, event) {
  const pageId = parseInt(event?.target?.value, 10);
  const filter = filters.value[filterIndex];
  if (filter) {
    articlePickByFilter.value = { ...articlePickByFilter.value, [filter.key]: '' };
  }
  if (!pageId || Number.isNaN(pageId) || !filter) return;
  if (!Array.isArray(filter.page_ids)) filter.page_ids = [];
  if (filter.page_ids.includes(pageId)) return;
  filter.page_ids.push(pageId);
}

function removeFilterArticle(filterIndex, articleIndex) {
  const filter = filters.value[filterIndex];
  if (!filter?.page_ids) return;
  filter.page_ids.splice(articleIndex, 1);
}

function moveFilterArticle(filterIndex, articleIndex, delta) {
  const filter = filters.value[filterIndex];
  if (!filter?.page_ids) return;
  const next = articleIndex + delta;
  if (next < 0 || next >= filter.page_ids.length) return;
  const list = [...filter.page_ids];
  const [item] = list.splice(articleIndex, 1);
  list.splice(next, 0, item);
  filter.page_ids = list;
}

function addPin() {
  const pageId = parseInt(pinToAdd.value, 10);
  pinToAdd.value = '';
  if (!pageId || Number.isNaN(pageId)) return;
  if (pins.value.some((p) => p.page_id === pageId)) return;
  const page = blogPages.value.find((p) => p.id === pageId);
  pins.value.push({
    page_id: pageId,
    title: page?.title || page?.slug || `#${pageId}`,
    is_pinned_badge: true,
  });
}

function removePin(index) {
  pins.value.splice(index, 1);
}

function movePin(index, delta) {
  const next = index + delta;
  if (next < 0 || next >= pins.value.length) return;
  const list = [...pins.value];
  const [item] = list.splice(index, 1);
  list.splice(next, 0, item);
  pins.value = list;
}

async function loadData() {
  isLoading.value = true;
  saveError.value = '';
  try {
    const [pages, settings] = await Promise.all([
      pagesService.getBlogPages(),
      canManage.value ? blogFeedService.getFeedSettings() : Promise.resolve(null),
    ]);
    blogPages.value = Array.isArray(pages) ? pages : [];
    if (settings) {
      filters.value = (settings.filters || []).map((f, i) => createFilter(f, i));
      pins.value = (settings.pins || []).map((p) => ({
        page_id: p.page_id,
        title: p.title,
        is_pinned_badge: true,
      }));
      if (Array.isArray(settings.sort_by_options) && settings.sort_by_options.length) {
        sortByOptions.value = settings.sort_by_options;
      }
    }
  } catch (error) {
    console.error('[BlogFeedSettingsView] load:', error);
    saveError.value = error.response?.data?.error || error.message || t('blog.feedSettings.loadError');
  } finally {
    isLoading.value = false;
  }
}

async function handleSave() {
  if (!canManage.value) return;
  saveError.value = '';
  saveSuccess.value = '';

  const missingLabel = filters.value.some(
    (f) => !String(f.label_ru || '').trim() && !String(f.label_en || '').trim()
  );
  if (missingLabel) {
    saveError.value = t('blog.feedSettings.labelRequired');
    return;
  }

  isSaving.value = true;
  try {
    const payload = {
      filters: filters.value.map((f, i) => ({
        slug: f.slug,
        label_ru: f.label_ru,
        label_en: f.label_en,
        sort_by: f.sort_by,
        is_default: f.is_default,
        is_active: f.is_active,
        position: i,
        page_ids: Array.isArray(f.page_ids) ? f.page_ids : [],
      })),
      pins: pins.value.map((p, i) => ({
        page_id: p.page_id,
        position: i,
      })),
    };
    const settings = await blogFeedService.saveFeedSettings(payload);
    filters.value = (settings.filters || []).map((f, i) => createFilter(f, i));
    pins.value = (settings.pins || []).map((p) => ({
      page_id: p.page_id,
      title: p.title,
      is_pinned_badge: true,
    }));
    saveSuccess.value = t('blog.feedSettings.saveSuccess');
  } catch (error) {
    console.error('[BlogFeedSettingsView] save:', error);
    saveError.value = error.response?.data?.error || error.message || t('blog.feedSettings.saveError');
  } finally {
    isSaving.value = false;
  }
}

watch(canManage, (ok, wasOk) => {
  if (ok && !wasOk) {
    loadData();
  }
});

onMounted(loadData);
</script>

<style scoped>
.feed-settings {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--block-padding) var(--spacing-lg) 48px;
  position: relative;
}

.feed-settings__panel {
  background: transparent;
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: none;
}

.feed-settings__panel h2 {
  margin: 0 0 8px;
  color: var(--theme-text, #262626);
  font-size: 1.4rem;
}

.feed-settings__hint {
  margin: 0 0 20px;
  color: var(--color-grey-dark);
  font-size: var(--font-size-sm);
}

.feed-settings__hint--tight {
  margin: 12px 0 8px;
}

.feed-settings__articles {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-grey-light);
}

.feed-settings__section {
  margin-bottom: 28px;
}

.feed-settings__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.feed-settings__section-header h3 {
  margin: 0;
  color: var(--color-dark);
  font-size: 1.1rem;
}

.feed-settings__card {
  background: var(--color-white);
  border: 1px solid var(--color-grey-light);
  border-radius: var(--radius-md);
  padding: 14px;
  margin-bottom: 10px;
}

.feed-settings__card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
}

.feed-settings__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.feed-settings__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-grey-dark);
}

.feed-settings__field--inline {
  margin-bottom: 12px;
}

.feed-settings__field input,
.feed-settings__field select {
  height: 38px;
  border: 1px solid var(--color-grey-light);
  border-radius: var(--radius-md);
  padding: 0 10px;
  font-size: var(--font-size-sm);
  background: var(--color-white);
}

.feed-settings__checks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  margin-top: 12px;
  font-size: var(--font-size-sm);
}

.feed-settings__order {
  display: inline-flex;
  gap: 6px;
  margin-left: auto;
  flex-wrap: wrap;
}

.feed-settings__pins {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feed-settings__pin {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: var(--color-white);
  border: 1px solid var(--color-grey-light);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}

.feed-settings__pin-title {
  font-size: var(--font-size-sm);
  font-weight: 500;
  min-width: 0;
}

.feed-settings__pin-title em {
  margin-left: 6px;
  font-style: normal;
  color: var(--color-primary);
  font-size: 0.75rem;
}

.feed-settings__empty,
.feed-settings__loading,
.feed-settings__denied {
  color: var(--theme-text-muted);
  font-size: var(--font-size-sm);
  padding: 12px 0;
}

.feed-settings__empty--warn {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-warning) 10%, white);
  color: var(--theme-text);
}

.feed-settings__error {
  color: var(--color-error);
  font-size: var(--font-size-sm);
}

.feed-settings__success {
  color: var(--color-primary-dark);
  font-size: var(--font-size-sm);
}

.feed-settings__actions {
  margin-top: 16px;
}

@media (max-width: 768px) {
  .feed-settings {
    padding: var(--block-padding-mobile) var(--spacing-sm) 40px;
  }

  .feed-settings__grid {
    grid-template-columns: 1fr;
  }

  .feed-settings__pin {
    flex-direction: column;
    align-items: flex-start;
  }

  .feed-settings__order {
    margin-left: 0;
  }
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
