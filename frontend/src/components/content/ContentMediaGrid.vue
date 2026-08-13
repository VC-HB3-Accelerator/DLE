<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->
<template>
  <div class="media-grid">
    <div class="media-grid__toolbar">
      <BlogFeedToolbar
        v-if="!forcedType"
        v-model="activeFilter"
        :filters="typeFilters"
      />
      <BlogFeedToolbar
        v-if="mode === 'manage'"
        v-model="sourceFilter"
        :filters="sourceFilters"
      />
      <div class="media-grid__search">
        <input
          v-model="searchInput"
          type="search"
          class="media-grid__search-input"
          :placeholder="t('content.media.searchPlaceholder')"
        >
        <UiGlyph name="search" class="media-grid__search-icon" :size="16" />
      </div>
    </div>

    <div v-if="isForbidden" class="media-grid__state">
      <div class="media-grid__empty-icon"><UiGlyph name="lock" :size="40" /></div>
      <h3>{{ t('content.media.forbidden') }}</h3>
    </div>
    <div v-else-if="isLoading && !items.length" class="media-grid__state">
      <div class="media-grid__spinner" />
      <p>{{ t('content.media.loading') }}</p>
    </div>
    <div v-else-if="!items.length" class="media-grid__state">
      <div class="media-grid__empty-icon"><UiGlyph name="file" :size="40" /></div>
      <h3>{{ t('content.media.empty') }}</h3>
    </div>
    <div v-else class="media-grid__cards">
      <article
        v-for="item in items"
        :key="itemKey(item)"
        class="media-card"
        :class="{ 'media-card--pick': mode === 'pick' }"
        @click="onCardClick(item)"
      >
        <div class="media-card__preview">
          <img
            v-if="item.media_type === 'image'"
            :src="item.url"
            :alt="item.file_name || ''"
            loading="lazy"
            class="media-card__img"
          >
          <div v-else-if="item.media_type === 'video'" class="media-card__poster">
            <UiGlyph name="play" :size="28" />
          </div>
          <div v-else class="media-card__poster">
            <UiGlyph name="file" :size="28" />
          </div>
          <span v-if="mode === 'manage'" class="media-card__badge">{{ sourceBadge(item) }}</span>
        </div>
        <p class="media-card__name" :title="item.file_name">{{ item.file_name }}</p>
        <div class="media-card__actions" @click.stop>
          <button
            type="button"
            class="media-card__btn"
            :title="t('content.media.preview')"
            @click="openPreview(item)"
          >
            <UiGlyph name="eye" :size="16" />
          </button>
          <button
            v-if="mode === 'manage'"
            type="button"
            class="media-card__btn media-card__btn--danger"
            :title="t('common.delete')"
            @click="onDelete(item)"
          >
            <UiGlyph name="trash" :size="16" />
          </button>
        </div>
      </article>
    </div>

    <div v-if="hasMore && !isForbidden" class="media-grid__more">
      <button type="button" class="media-grid__more-btn" :disabled="isLoading" @click="loadMore">
        {{ t('content.media.loadMore') }}
      </button>
    </div>

    <div v-if="previewItem" class="modal-overlay" @click="previewItem = null">
      <div class="modal-content media-lightbox" @click.stop>
        <div class="modal-header">
          <h3>{{ previewItem.file_name }}</h3>
          <button type="button" class="media-lightbox__close" @click="previewItem = null">×</button>
        </div>
        <div class="modal-body">
          <img
            v-if="previewItem.media_type === 'image'"
            :src="previewItem.url"
            :alt="previewItem.file_name || ''"
            class="media-lightbox__media"
          >
          <video
            v-else-if="previewItem.media_type === 'video'"
            :src="previewItem.url"
            controls
            preload="metadata"
            class="media-lightbox__media"
          />
          <audio
            v-else-if="previewItem.media_type === 'audio'"
            :src="previewItem.url"
            controls
            class="media-lightbox__audio"
          />
          <div v-else class="media-lightbox__file">
            <a :href="previewItem.url" target="_blank" rel="noopener">{{ previewItem.file_name }}</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BlogFeedToolbar from '../blog/BlogFeedToolbar.vue';
import UiGlyph from '../UiGlyph.vue';
import contentMediaService from '../../services/contentMediaService';

const props = defineProps({
  mode: { type: String, default: 'manage' },
  forcedType: { type: String, default: '' },
});

const emit = defineEmits(['select']);

const { t } = useI18n();
const LIMIT = 24;
const items = ref([]);
const total = ref(0);
const offset = ref(0);
const isLoading = ref(false);
const isForbidden = ref(false);
const searchInput = ref('');
const debouncedQ = ref('');
const activeFilter = ref(props.forcedType || 'all');
const sourceFilter = ref('all');
const previewItem = ref(null);
let searchTimer = null;

const typeFilters = computed(() => ([
  { slug: 'all', label_ru: t('content.media.filterAll'), label_en: t('content.media.filterAll') },
  { slug: 'image', label_ru: t('content.media.filterImage'), label_en: t('content.media.filterImage') },
  { slug: 'video', label_ru: t('content.media.filterVideo'), label_en: t('content.media.filterVideo') },
  { slug: 'audio', label_ru: t('content.media.filterAudio'), label_en: t('content.media.filterAudio') },
  { slug: 'file', label_ru: t('content.media.filterFile'), label_en: t('content.media.filterFile') },
]));

const sourceFilters = computed(() => ([
  { slug: 'all', label_ru: t('content.media.sourceAll'), label_en: t('content.media.sourceAll') },
  { slug: 'cms', label_ru: t('content.media.sourceCms'), label_en: t('content.media.sourceCms') },
  { slug: 'chat', label_ru: t('content.media.sourceChat'), label_en: t('content.media.sourceChat') },
  { slug: 'guest', label_ru: t('content.media.sourceGuest'), label_en: t('content.media.sourceGuest') },
]));

const mediaTypeQuery = computed(() => {
  if (props.forcedType) return props.forcedType;
  if (activeFilter.value && activeFilter.value !== 'all') return activeFilter.value;
  return undefined;
});

const listScope = computed(() => (props.mode === 'manage' ? 'all' : 'cms'));

const hasMore = computed(() => items.value.length < total.value);

function itemKey(item) {
  return `${item.source || 'cms'}:${item.id}`;
}

function sourceBadge(item) {
  const src = item.source || 'cms';
  if (src === 'chat') return t('content.media.badgeChat');
  if (src === 'guest') return t('content.media.badgeGuest');
  return t('content.media.badgeCms');
}

async function fetchPage({ append } = {}) {
  if (isLoading.value) return;
  isLoading.value = true;
  try {
    const res = await contentMediaService.list({
      media_type: mediaTypeQuery.value,
      q: debouncedQ.value || undefined,
      limit: LIMIT,
      offset: append ? offset.value : 0,
      scope: listScope.value,
      source: props.mode === 'manage' && sourceFilter.value !== 'all'
        ? sourceFilter.value
        : undefined,
    });
    isForbidden.value = false;
    const data = Array.isArray(res.data) ? res.data : [];
    total.value = Number(res.total) || 0;
    if (append) {
      items.value = items.value.concat(data);
    } else {
      items.value = data;
    }
    offset.value = items.value.length;
  } catch (err) {
    if (err.response && err.response.status === 403) {
      isForbidden.value = true;
      items.value = [];
      total.value = 0;
    }
  } finally {
    isLoading.value = false;
  }
}

function loadMore() {
  fetchPage({ append: true });
}

function reload() {
  offset.value = 0;
  fetchPage({ append: false });
}

function onCardClick(item) {
  // Пикер — только CMS (чат/гости сюда не приходят из-за scope=cms)
  if (props.mode === 'pick') {
    if ((item.source || 'cms') !== 'cms') return;
    emit('select', item);
  }
}

function openPreview(item) {
  previewItem.value = item;
}

async function onDelete(item) {
  const src = item.source || 'cms';
  const msg = (src === 'chat' || src === 'guest')
    ? t('content.media.confirmDeleteChat')
    : t('content.media.confirmDelete');
  if (!confirm(msg)) return;
  try {
    await contentMediaService.remove(item.id, src);
    items.value = items.value.filter((row) => itemKey(row) !== itemKey(item));
    total.value = Math.max(0, total.value - 1);
    if (previewItem.value && itemKey(previewItem.value) === itemKey(item)) {
      previewItem.value = null;
    }
  } catch (err) {
    alert(t('content.media.deleteFailed'));
  }
}

watch(searchInput, (value) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    debouncedQ.value = String(value || '').trim();
  }, 300);
});

watch([debouncedQ, activeFilter, sourceFilter], () => {
  reload();
});

watch(() => props.forcedType, (value) => {
  if (value) activeFilter.value = value;
});

onMounted(() => {
  reload();
});

defineExpose({ reload });
</script>

<style scoped>
.media-grid__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.media-grid__search {
  position: relative;
  flex: 1;
  min-width: 180px;
}

.media-grid__search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 32px 8px 12px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  font: inherit;
}

.media-grid__search-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #adb5bd;
}

.media-grid__state {
  text-align: center;
  padding: 64px 16px;
  color: #6c757d;
}

.media-grid__spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 12px;
  border: 3px solid #e9ecef;
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: media-spin 0.8s linear infinite;
}

@keyframes media-spin {
  to { transform: rotate(360deg); }
}

.media-grid__empty-icon {
  margin-bottom: 10px;
  color: #adb5bd;
}

.media-grid__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.media-card {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.media-card--pick {
  cursor: pointer;
}

.media-card--pick:hover {
  border-color: rgba(45, 114, 217, 0.35);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

.media-card__preview {
  height: 120px;
  background: #f1f3f5;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.media-card__badge {
  position: absolute;
  left: 8px;
  top: 8px;
  background: rgba(33, 37, 41, 0.75);
  color: #fff;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.media-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-card__poster {
  color: #868e96;
}

.media-card__name {
  margin: 8px 10px 0;
  font-size: 0.85rem;
  color: #495057;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  padding: 6px 8px 8px;
}

.media-card__btn {
  border: none;
  background: transparent;
  color: #6c757d;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.media-card__btn:hover {
  background: #f1f3f5;
  color: var(--color-primary);
}

.media-card__btn--danger:hover {
  color: #c92a2a;
}

.media-grid__more {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.media-grid__more-btn {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font: inherit;
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
  width: min(720px, 100%);
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  margin: 0;
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-body {
  padding: 16px 20px;
}

.media-lightbox__close {
  border: none;
  background: transparent;
  font-size: 1.4rem;
  cursor: pointer;
  line-height: 1;
  color: #868e96;
}

.media-lightbox__media {
  display: block;
  width: 100%;
  max-height: 70vh;
  border-radius: 8px;
}

.media-lightbox__audio {
  width: 100%;
}

.media-lightbox__file {
  padding: 12px 0;
  word-break: break-all;
}
</style>
