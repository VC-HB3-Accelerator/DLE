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
    <div class="content-create-page page-with-close">
      <PageCloseButton :fallback="{ name: 'content-list' }" />
      <!-- Основной контент с тенью -->
      <div class="content-block">
        <form class="content-form" @submit.prevent="handleSubmit">
          <!-- Параметры документа -->
          <div class="form-section">
            <h2>{{ t('content.editor.documentParams') }}</h2>
            <div v-if="!isListingSimple" class="form-group">
              <label for="visibility">{{ t('content.editor.visibility') }}</label>
              <select v-model="form.visibility" id="visibility" class="form-select">
                <option value="public">{{ t('content.editor.visibilityPublic') }}</option>
                <option value="internal">{{ t('content.editor.visibilityInternal') }}</option>
              </select>
            </div>
            <div class="form-group" v-if="!isListingSimple && form.visibility === 'internal'">
              <label for="required-permission">{{ t('content.editor.accessLevel') }}</label>
              <select
                v-model="form.requiredPermission"
                id="required-permission"
                class="form-select"
              >
                <option value="">{{ t('content.editor.selectRole') }}</option>
                <option :value="PERMISSIONS.VIEW_BASIC_DOCS">{{ t('content.editor.roleUser') }}</option>
                <option :value="PERMISSIONS.VIEW_LEGAL_DOCS">{{ t('content.editor.roleReader') }}</option>
                <option :value="PERMISSIONS.MANAGE_LEGAL_DOCS">{{ t('content.editor.roleEditor') }}</option>
              </select>
            </div>
            <div v-if="!isListingSimple" class="form-group">
              <label for="format">{{ t('content.editor.format') }}</label>
              <select v-model="form.format" id="format" class="form-select">
                <option value="html">{{ t('content.editor.formatHtml') }}</option>
                <option value="pdf" disabled>{{ t('content.editor.formatPdfSoon') }}</option>
                <option value="image" disabled>{{ t('content.editor.formatImageSoon') }}</option>
              </select>
            </div>
            <div class="form-group" v-if="!isListingSimple && form.visibility === 'public'">
              <label class="checkbox-label">
                <input
                  v-model="form.showInBlog"
                  type="checkbox"
                  class="form-checkbox"
                />
                <span>{{ t('content.editor.showInBlog') }}</span>
              </label>
              <p class="form-hint">
                {{ t('content.editor.showInBlogHint') }}
              </p>
            </div>
            <div class="form-group" v-if="!isListingSimple && form.visibility === 'public' && form.showInBlog">
              <span class="form-label-text">{{ t('content.editor.feedFilters') }}</span>
              <p class="form-hint">{{ t('content.editor.feedFiltersHint') }}</p>
              <div v-if="feedFilterOptionsError" class="form-hint form-hint--error">
                {{ feedFilterOptionsError }}
              </div>
              <div v-else-if="!feedFilterOptions.length" class="form-hint">
                {{ t('content.editor.feedFiltersEmpty') }}
              </div>
              <div v-else class="feed-filters-checkboxes">
                <label
                  v-for="flt in feedFilterOptions"
                  :key="flt.id"
                  class="checkbox-label"
                >
                  <input
                    type="checkbox"
                    class="form-checkbox"
                    :value="flt.id"
                    v-model="form.feedFilterIds"
                  />
                  <span>{{ flt.label_ru || flt.label_en || flt.slug }}</span>
                </label>
              </div>
            </div>
            <div class="form-group" v-if="form.visibility === 'public' && form.showInBlog">
              <span class="form-label-text">{{ t('content.editor.catalogFilters') }}</span>
              <p v-if="!isListingSimple" class="form-hint">{{ t('content.editor.catalogFiltersHint') }}</p>
              <div v-if="isListingSimple" class="listing-chips" role="list">
                <button
                  v-if="catalogSectionLabel || catalogSectionId"
                  type="button"
                  class="listing-chips__chip"
                  role="listitem"
                  :title="t('catalogFilters.removeChip', { label: catalogSectionLabel || catalogSectionId })"
                  @click="clearListingFrom('section')"
                >
                  <span class="listing-chips__text">{{ catalogSectionLabel || catalogSectionId }}</span>
                  <span class="listing-chips__x" aria-hidden="true">×</span>
                </button>
                <button
                  v-for="chip in listingChips"
                  :key="chip.key"
                  type="button"
                  class="listing-chips__chip"
                  role="listitem"
                  :title="t('catalogFilters.removeChip', { label: chip.label })"
                  @click="clearListingFrom(chip.key)"
                >
                  <span class="listing-chips__text">{{ chip.label }}</span>
                  <span class="listing-chips__x" aria-hidden="true">×</span>
                </button>
              </div>
              <CatalogEntityAttrsEditor
                v-else
                v-model:section-id="catalogSectionId"
                v-model:attrs="catalogAttrs"
              />
            </div>
            <p v-if="!isListingSimple" class="form-hint">
              {{ t('content.editor.variablesHint') }}
            </p>
          </div>
          <!-- Основная информация -->
          <div class="form-section">
            <h2>{{ t('content.editor.mainInfo') }}</h2>
            <div class="form-group">
              <label for="title">{{ t('content.editor.pageTitle') }}</label>
              <input 
                v-model="form.title" 
                id="title" 
                type="text" 
                required 
                :placeholder="isListingSimple ? t('content.listingGallery.titlePlaceholder') : t('content.editor.pageTitlePlaceholder')"
                class="form-input"
                @input="onMainTitleInput"
              />
            </div>
            <div class="form-group">
              <label for="summary">{{ t('content.editor.summary') }}</label>
              <textarea 
                v-model="form.summary" 
                id="summary" 
                required 
                rows="3" 
                :placeholder="isListingSimple ? t('content.listingGallery.summaryPlaceholder') : t('content.editor.summaryPlaceholder')"
                class="form-textarea"
                @input="onMainSummaryInput"
              />
            </div>
            <div v-if="!isListingSimple" class="form-group">
              <label for="category">{{ t('content.editor.category') }}</label>
              <div class="category-select-wrapper">
                <select 
                  v-model="form.category" 
                  id="category" 
                  class="form-select"
                >
                  <option value="">{{ t('content.editor.noCategory') }}</option>
                  <option v-for="cat in categories" :key="cat" :value="cat">
                    {{ cat }}
                  </option>
                </select>
                <button 
                  type="button" 
                  class="btn btn-outline btn-add-section"
                  @click="handleAddSection"
                >
                  <UiGlyph name="plus" />
                  {{ t('content.editor.addCategory') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Контент / галерея объявления -->
          <div class="form-section">
            <h2>{{ isListingSimple ? t('content.listingGallery.sectionTitle') : t('content.editor.contentSection') }}</h2>
            <div v-if="isListingSimple" class="form-group">
              <ListingMediaGallery v-model="listingMedia" :disabled="isSubmitting" />
            </div>
            <div class="form-group" v-else-if="form.format === 'html'">
              <label for="content">{{ t('content.editor.mainContent') }}</label>
              <RichTextEditor
                v-model="form.content"
                :placeholder="t('content.editor.mainContentPlaceholder')"
              />
              <div class="content-stats">
                <span>{{ t('content.editor.wordCount', { count: wordCount }) }}</span>
                <span>{{ t('content.editor.charCount', { count: characterCount }) }}</span>
              </div>
            </div>
            <div class="form-group" v-else>
              <label for="file">{{ t('content.editor.file') }}</label>
              <input id="file" type="file" accept="application/pdf,image/png,image/jpeg" @change="onFileChange" class="form-input" />
              <p class="form-hint" v-if="fileName">{{ t('content.editor.fileSelected', { name: fileName }) }}</p>
            </div>
          </div>

          <!-- SEO настройки -->
          <div class="form-section">
            <h2>{{ t('content.editor.seoSettings') }}</h2>
            <div class="form-group">
              <label for="seo-title">Meta Title</label>
              <input
                v-model="form.seo.title"
                id="seo-title"
                type="text"
                :readonly="isListingSimple"
                :placeholder="t('content.editor.seoTitlePlaceholder')"
                class="form-input"
                @input="seoManual.title = true"
              />
            </div>
            <div class="form-group">
              <label for="seo-description">Meta Description</label>
              <textarea
                v-model="form.seo.description"
                id="seo-description"
                rows="3"
                :readonly="isListingSimple"
                :placeholder="t('content.editor.seoDescPlaceholder')"
                class="form-textarea"
                @input="seoManual.description = true"
              />
            </div>
            <div class="form-group">
              <label for="seo-keywords">Keywords</label>
              <input
                v-model="form.seo.keywords"
                id="seo-keywords"
                type="text"
                :readonly="isListingSimple"
                :placeholder="t('content.editor.seoKeywordsPlaceholder')"
                class="form-input"
                @input="seoManual.keywords = true"
              />
              <p v-if="isListingSimple" class="form-hint">{{ t('content.listingGallery.keywordsHint') }}</p>
            </div>
            <div v-if="!isListingSimple" class="form-group">
              <label for="seo-og-image">{{ t('content.editor.seoOgImage') }}</label>
              <p class="form-hint">{{ t('content.editor.seoOgImageHint') }}</p>
              <div class="og-image-row">
                <button
                  id="seo-og-image"
                  type="button"
                  class="btn btn-primary"
                  :disabled="ogImageUploading"
                  @click="openOgPicker"
                >
                  {{ t('content.editor.seoOgImagePick') }}
                </button>
                <button
                  v-if="form.seo.og_image"
                  type="button"
                  class="btn btn-outline og-image-clear"
                  :disabled="ogImageUploading"
                  @click="clearOgImage"
                >
                  {{ t('content.editor.seoOgImageClear') }}
                </button>
              </div>
              <p v-if="ogImageUploading" class="form-hint">{{ t('content.editor.seoOgImageUploading') }}</p>
              <div v-if="ogImagePreviewUrl" class="og-image-preview">
                <img :src="ogImagePreviewUrl" :alt="t('content.editor.seoOgImage')" />
              </div>
              <ContentMediaPickerModal
                :open="ogPickerOpen"
                kind="image"
                @cancel="closeOgPicker"
                @device="onOgPickerDevice"
                @select="onOgPickerSelect"
              />
              <input
                ref="ogImageInputRef"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                class="og-image-hidden-file"
                @change="onOgImageChange"
              >
            </div>
          </div>


          <!-- Кнопки действий -->
          <div class="form-actions">
            <button type="button" class="btn btn-outline" :disabled="isSubmitting" @click="openPreview">
              <UiGlyph name="eye" />
              {{ t('content.editor.preview') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
              <UiGlyph name="globe" />
              {{ submitButtonLabel }}
            </button>
            <template v-if="canModerate && isEditMode && form.status === 'pending'">
              <button type="button" class="btn btn-primary" :disabled="isSubmitting" @click="moderateApprove">
                {{ t('content.moderation.approve') }}
              </button>
              <button type="button" class="btn btn-outline" :disabled="isSubmitting" @click="moderateReturn">
                {{ t('content.moderation.return') }}
              </button>
            </template>
          </div>
        </form>
      </div>
    </div>
    <Teleport to="body">
      <div
        v-if="previewOpen"
        class="preview-overlay"
        @click.self="closePreview"
      >
        <div class="preview-dialog" role="dialog" aria-modal="true" :aria-label="t('content.editor.preview')">
          <div class="preview-dialog__bar">
            <div class="preview-dialog__bar-text">
              <strong>{{ t('content.editor.preview') }}</strong>
              <span>{{ t('content.editor.previewNotPublished') }}</span>
            </div>
            <button type="button" class="preview-dialog__close" @click="closePreview">
              {{ t('common.close') }}
            </button>
          </div>
          <div class="preview-dialog__body">
            <p v-if="!isListingSimple && form.format !== 'html'" class="preview-dialog__empty">
              {{ t('content.editor.previewFileOnly') }}
            </p>
            <!-- Предпросмотр объявления: как карточка ленты -->
            <article v-else-if="isListingSimple" class="preview-listing-card">
              <div v-if="listingMediaHasSlides" class="preview-listing-card__media">
                <ListingMediaCarousel :media="listingMedia" :alt="form.title" />
              </div>
              <div v-else class="preview-listing-card__media preview-listing-card__media--empty">
                {{ t('content.listingGallery.previewNoMedia') }}
              </div>

              <div class="preview-listing-card__actions">
                <button
                  type="button"
                  class="preview-listing-card__icon-btn"
                  disabled
                  :title="t('blog.listingContact.call')"
                  :aria-label="t('blog.listingContact.call')"
                >
                  <BlogGlyph name="phone" />
                </button>
              </div>

              <div class="preview-listing-card__body">
                <h2 class="preview-listing-card__title">
                  {{ form.title.trim() || t('content.listingGallery.titlePlaceholder') }}
                </h2>
                <div v-if="listingPreviewTags.length" class="preview-listing-card__tags">
                  <span
                    v-for="(tag, idx) in listingPreviewTags"
                    :key="`pt-${idx}`"
                    class="preview-listing-card__tag"
                  >{{ tag }}</span>
                </div>
                <p v-if="form.summary.trim()" class="preview-listing-card__summary">{{ form.summary }}</p>
                <p v-else class="preview-dialog__empty">{{ t('content.listingGallery.summaryPlaceholder') }}</p>
              </div>
            </article>
            <article v-else class="preview-article">
              <h1>{{ form.title.trim() || t('content.editor.pageTitlePlaceholder') }}</h1>
              <p v-if="form.summary.trim()" class="preview-article__summary">{{ form.summary }}</p>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div
                v-if="previewHtml"
                class="preview-article__content"
                v-html="previewHtml"
              />
              <p v-else class="preview-dialog__empty">{{ t('content.editor.previewEmpty') }}</p>
            </article>
          </div>
        </div>
      </div>
    </Teleport>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../components/BaseLayout.vue';
import PageCloseButton from '../components/PageCloseButton.vue';
import RichTextEditor from '../components/editor/RichTextEditor.vue';
import ContentMediaPickerModal from '../components/content/ContentMediaPickerModal.vue';
import ListingMediaGallery from '../components/content/ListingMediaGallery.vue';
import ListingMediaCarousel from '../components/blog/ListingMediaCarousel.vue';
import BlogGlyph from '../components/blog/BlogGlyph.vue';
import pagesService from '../services/pagesService';
import blogFeedService from '../services/blogFeedService';
import CatalogEntityAttrsEditor from '../components/catalog/CatalogEntityAttrsEditor.vue';
import {
  catalogEntityPayloadFromEditor,
  catalogSelectionFromQuery,
  editorStateFromCatalog,
  fetchCatalogSections,
} from '../services/catalogFiltersService';
import { uploadContentMedia } from '../composables/useChunkedMediaUpload';
import { PERMISSIONS } from './permissions.js';
import { usePermissions } from '../composables/usePermissions';
import UiGlyph from '../components/UiGlyph.vue';
import { sanitizeCmsHtml, CMS_HTML_SANITIZE } from '../utils/sanitizeCmsHtml';

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
const { t, locale } = useI18n();
const PERMISSIONS_REF = PERMISSIONS; // для шаблона

// Проверка прав доступа
const { hasPermission, isEditor } = usePermissions();
const canEditContent = computed(() =>
  hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS)
  || hasPermission(PERMISSIONS.CREATE_OWN_ARTICLES)
  || hasPermission(PERMISSIONS.VIEW_DOMAIN_ARTICLES)
  || hasPermission(PERMISSIONS.APPROVE_DOMAIN_PUBLICATIONS)
);
const canModerate = computed(() => hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS));
const submitButtonLabel = computed(() => {
  if (isSubmitting.value) {
    return canModerate.value ? t('content.editor.publishing') : t('content.moderation.submitting');
  }
  if (canModerate.value) return t('content.editor.publish');
  return t('content.moderation.submitForReview');
});

// Режим редактирования
const isEditMode = computed(() => !!route.query.edit);
const editId = computed(() => route.query.edit);

// Состояние формы
const form = ref({
  title: '',
  summary: '',
  content: '',
  seo: {
    title: '',
    description: '',
    keywords: '',
    og_image: ''
  },
  settings: {
    autoPublish: false
  },
  status: 'draft',
  visibility: 'public',
  requiredPermission: '',
  format: 'html',
  category: '',
  showInBlog: false,
  feedFilterIds: []
});

const catalogSectionId = ref('');
const catalogAttrs = ref([]);
const catalogSectionLabel = ref('');
/** Объявление ленты: упрощённый UI (формат скрыт, фильтры чипами, галерея). */
const isListingSimple = computed(() => (
  form.value.visibility === 'public' && form.value.showInBlog === true
));
const listingMedia = ref({ photos: [], video: null });
const listingFilterKeys = ref([]);
const listingChips = computed(() => {
  const map = {};
  for (const row of catalogAttrs.value || []) {
    if (row?.key && row?.value) map[row.key] = String(row.value);
  }
  const keys = listingFilterKeys.value.length
    ? listingFilterKeys.value
    : Object.keys(map);
  const out = [];
  for (const key of keys) {
    if (map[key]) out.push({ key, label: map[key] });
  }
  return out;
});

const listingPreviewTags = computed(() => catalogFacetParts());

const listingMediaHasSlides = computed(() => {
  const photos = Array.isArray(listingMedia.value?.photos)
    ? listingMedia.value.photos.filter(Boolean)
    : [];
  return photos.length > 0 || Boolean(listingMedia.value?.video);
});
const seoManual = ref({ title: false, description: false, keywords: false });
const mainManual = ref({ title: false, summary: false });
const feedFilterOptions = ref([]);
const feedFilterOptionsError = ref('');

function catalogFacetParts() {
  const parts = [];
  if (catalogSectionLabel.value) parts.push(catalogSectionLabel.value);
  const map = {};
  for (const row of catalogAttrs.value || []) {
    if (row?.key && row?.value) map[row.key] = String(row.value).trim();
  }
  const keys = listingFilterKeys.value.length
    ? listingFilterKeys.value
    : Object.keys(map);
  for (const key of keys) {
    if (map[key]) parts.push(map[key]);
  }
  return parts;
}

function syncAutoFillFromCatalog({ forceMain = false } = {}) {
  if (isEditMode.value && !isListingSimple.value) return;
  const parts = catalogFacetParts();
  const joinedKw = parts.length ? parts.join(', ') : '';

  // Объявление ленты: фильтры → только SEO keywords; title/summary пишет пользователь и зеркалятся в Meta.
  if (isListingSimple.value) {
    form.value.seo.keywords = joinedKw;
    if (String(form.value.title || '').trim()) {
      form.value.seo.title = String(form.value.title).trim();
    }
    if (String(form.value.summary || '').trim()) {
      form.value.seo.description = String(form.value.summary).trim();
    }
    return;
  }

  if (!parts.length) return;
  const joinedTitle = parts.join(' · ');
  if (forceMain || (!mainManual.value.title && !String(form.value.title || '').trim())) {
    form.value.title = joinedTitle;
  }
  if (forceMain || (!mainManual.value.summary && !String(form.value.summary || '').trim())) {
    form.value.summary = joinedKw;
  }
  if (!seoManual.value.title) {
    form.value.seo.title = String(form.value.title || '').trim() || joinedTitle;
  }
  if (!seoManual.value.description) {
    form.value.seo.description = String(form.value.summary || '').trim() || joinedKw;
  }
  if (!seoManual.value.keywords) {
    form.value.seo.keywords = joinedKw;
  }
}

function clearListingFrom(key) {
  if (key === 'section') {
    catalogSectionId.value = '';
    catalogSectionLabel.value = '';
    catalogAttrs.value = [];
    listingFilterKeys.value = [];
    syncAutoFillFromCatalog();
    return;
  }
  const keys = listingFilterKeys.value.length
    ? listingFilterKeys.value
    : (catalogAttrs.value || []).map((r) => r.key).filter(Boolean);
  const keep = [];
  for (const k of keys) {
    if (k === key) break;
    const row = (catalogAttrs.value || []).find((r) => r.key === k);
    if (row?.value) keep.push({ key: k, value: String(row.value) });
  }
  catalogAttrs.value = keep;
  syncAutoFillFromCatalog();
}

function escapeHtmlAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function listingMediaToHtml(media) {
  const photos = Array.isArray(media?.photos) ? media.photos.filter(Boolean) : [];
  const video = media?.video || null;
  const parts = ['<div class="listing-media">'];
  for (const url of photos) {
    parts.push(`<p><img src="${escapeHtmlAttr(url)}" alt=""></p>`);
  }
  if (video) {
    parts.push(`<p><video src="${escapeHtmlAttr(video)}" controls preload="metadata"></video></p>`);
  }
  parts.push('</div>');
  return parts.join('');
}

function applyListingMediaToForm() {
  const photos = Array.isArray(listingMedia.value?.photos) ? listingMedia.value.photos.filter(Boolean) : [];
  const video = listingMedia.value?.video || null;
  form.value.format = 'html';
  form.value.content = listingMediaToHtml({ photos, video });
  if (photos[0]) form.value.seo.og_image = photos[0];
  form.value.settings = {
    ...(form.value.settings || {}),
    autoPublish: false,
    compose_mode: 'listing',
    listing_media: { photos, video },
  };
}

function onMainTitleInput() {
  mainManual.value.title = true;
  if (isListingSimple.value || !seoManual.value.title) {
    form.value.seo.title = String(form.value.title || '').trim();
  }
}

function onMainSummaryInput() {
  mainManual.value.summary = true;
  if (isListingSimple.value || !seoManual.value.description) {
    form.value.seo.description = String(form.value.summary || '').trim();
  }
}

async function loadFeedFilterOptions() {
  feedFilterOptionsError.value = '';
  try {
    const settings = await blogFeedService.getFeedSettings();
    feedFilterOptions.value = (settings.filters || [])
      .filter((f) => f.id != null && f.is_active !== false)
      .map((f) => ({
        id: f.id,
        slug: f.slug,
        label_ru: f.label_ru,
        label_en: f.label_en,
      }));
  } catch (e) {
    console.warn('[ContentPageView] feed filters:', e.message || e);
    feedFilterOptions.value = [];
    const status = e?.response?.status;
    feedFilterOptionsError.value =
      status === 403
        ? t('content.editor.feedFiltersForbidden')
        : (e?.response?.data?.error || e?.message || t('content.editor.feedFiltersLoadError'));
  }
}

// Список категорий
const categories = ref([]);

const isSubmitting = ref(false);
const fileBlob = ref(null);
const fileName = ref('');
const ogImageUploading = ref(false);
const ogImageInputRef = ref(null);
const ogPickerOpen = ref(false);

const ogImagePreviewUrl = computed(() => {
  const url = form.value.seo?.og_image;
  if (!url) return '';
  if (String(url).startsWith('http') || String(url).startsWith('data:')) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${String(url).startsWith('/') ? '' : '/'}${url}`;
});

const previewOpen = ref(false);
const previewHtml = computed(() => {
  const raw = isListingSimple.value
    ? listingMediaToHtml(listingMedia.value)
    : (form.value.content || '');
  if (!String(raw).trim()) return '';
  return sanitizeCmsHtml(raw, { config: CMS_HTML_SANITIZE });
});

function onPreviewKeydown(e) {
  if (e.key === 'Escape') closePreview();
}

function openPreview() {
  previewOpen.value = true;
}

function closePreview() {
  previewOpen.value = false;
}

watch(previewOpen, (open) => {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) document.addEventListener('keydown', onPreviewKeydown);
  else document.removeEventListener('keydown', onPreviewKeydown);
});

function openOgPicker() {
  ogPickerOpen.value = true;
}

function closeOgPicker() {
  ogPickerOpen.value = false;
}

function onOgPickerDevice() {
  closeOgPicker();
  nextTick(() => {
    if (ogImageInputRef.value) ogImageInputRef.value.click();
  });
}

function onOgPickerSelect(item) {
  closeOgPicker();
  if (!item || !item.url) return;
  form.value.seo.og_image = item.url;
}

async function onOgImageChange(e) {
  const file = e.target?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert(t('content.editor.seoOgImageInvalid'));
    e.target.value = '';
    return;
  }
  ogImageUploading.value = true;
  try {
    const data = await uploadContentMedia(file);
    const url = data && data.url;
    if (!url) {
      throw new Error(t('content.editor.seoOgImageUploadError'));
    }
    form.value.seo.og_image = url;
  } catch (error) {
    console.error('[ContentPageView] og image upload:', error);
    alert(
      error?.response?.data?.error
      || error?.message
      || t('content.editor.seoOgImageUploadError')
    );
  } finally {
    ogImageUploading.value = false;
    if (e?.target) e.target.value = '';
  }
}

function clearOgImage() {
  form.value.seo.og_image = '';
  if (ogImageInputRef.value) ogImageInputRef.value.value = '';
}

// Вычисляемые свойства
const wordCount = computed(() => {
  return form.value.content ? form.value.content.split(/\s+/).length : 0;
});

const characterCount = computed(() => {
  return form.value.content ? form.value.content.length : 0;
});

// Методы
async function deletePage() {
  if (!isEditMode.value || !editId.value) {
    return;
  }
  
  if (!confirm(t('content.editor.confirmDelete'))) {
    return;
  }
  
  try {
    await pagesService.deletePage(editId.value);
    router.push({ name: 'content-list' });
  } catch (error) {
    console.error('Ошибка удаления страницы:', error);
    alert(t('content.editor.deleteError') + (error?.response?.data?.error || error?.message || t('common.unknownError')));
  }
}

function onFileChange(e) {
  const f = e.target.files && e.target.files[0];
  if (f) {
    fileBlob.value = f;
    fileName.value = f.name;
  } else {
    fileBlob.value = null;
    fileName.value = '';
  }
}

// Загрузка категорий
async function loadCategories() {
  try {
    const cats = await pagesService.getCategories();
    categories.value = cats || [];
  } catch (error) {
    console.error('Ошибка загрузки категорий:', error);
    categories.value = [];
  }
}

// Обработка добавления нового раздела
async function handleAddSection() {
  const newCategory = prompt(t('content.editor.newCategoryPrompt'));
  if (!newCategory || !newCategory.trim()) {
    return;
  }
  
  const trimmedCategory = newCategory.trim();
  const normalizedCategory = trimmedCategory.toLowerCase();
  
  // Проверяем, не существует ли уже такая категория
  if (categories.value.includes(normalizedCategory)) {
    alert(t('content.editor.categoryExists'));
    form.value.category = normalizedCategory;
    return;
  }
  
  try {
    // Создаем категорию через API
    await pagesService.createCategory(
      normalizedCategory,
      trimmedCategory, // display_name
      null, // description
      0 // order_index
    );
    
    // Обновляем список категорий
    await loadCategories();
    
    // Устанавливаем созданную категорию в форму
    form.value.category = normalizedCategory;
    
    alert(t('content.editor.categoryCreated', { name: trimmedCategory }));
  } catch (error) {
    console.error('[ContentPageView] Ошибка создания раздела:', error);
    const errorMessage = error.response?.data?.error || error.message || t('common.unknownError');
    
    // Если категория уже существует на сервере, просто добавляем её в список
    if (error.response?.status === 409) {
      await loadCategories();
      form.value.category = normalizedCategory;
      alert(t('content.editor.categoryExists'));
    } else {
      alert(t('content.editor.categoryCreateError') + errorMessage);
    }
  }
}

// Загрузка данных для редактирования
async function loadPageForEdit() {
  if (!isEditMode.value || !editId.value) return;
  
  try {
    const page = await pagesService.getPage(editId.value);
    if (page) {
      form.value.title = page.title || '';
      form.value.summary = page.summary || '';
      form.value.content = page.content || '';
      form.value.seo.title = page.seo?.title || '';
      form.value.seo.description = page.seo?.description || '';
      form.value.seo.keywords = page.seo?.keywords || '';
      form.value.seo.og_image = page.seo?.og_image || page.seo?.image || '';
      form.value.status = page.status || 'draft';
      form.value.visibility = page.visibility || 'public';
      form.value.requiredPermission = page.required_permission || '';
      form.value.format = page.format || 'html';
      form.value.category = page.category || '';
      form.value.showInBlog = page.show_in_blog === true || page.show_in_blog === 'true';
      form.value.feedFilterIds = Array.isArray(page.feed_filter_ids)
        ? page.feed_filter_ids.map((id) => Number(id)).filter((id) => !Number.isNaN(id))
        : [];
      const settings = page.settings && typeof page.settings === 'object' ? page.settings : {};
      form.value.settings = { autoPublish: false, ...settings };
      const lm = settings.listing_media;
      if (lm && typeof lm === 'object') {
        listingMedia.value = {
          photos: Array.isArray(lm.photos) ? lm.photos.filter(Boolean) : [],
          video: lm.video || null,
        };
      } else {
        listingMedia.value = { photos: [], video: null };
      }
      const cat = editorStateFromCatalog(page);
      catalogSectionId.value = cat.sectionId || '';
      catalogAttrs.value = cat.attrs || [];
      if (page.catalog_section) {
        catalogSectionLabel.value = locale.value === 'en'
          ? (page.catalog_section.label_en || page.catalog_section.label_ru || page.catalog_section.slug || '')
          : (page.catalog_section.label_ru || page.catalog_section.label_en || page.catalog_section.slug || '');
        listingFilterKeys.value = Array.isArray(page.catalog_section.filter_keys)
          ? page.catalog_section.filter_keys
          : [];
      }
      if (catalogSectionId.value && !listingFilterKeys.value.length) {
        try {
          const sections = await fetchCatalogSections({ all: 0 });
          const match = sections.find((s) => s.id === catalogSectionId.value);
          if (match) {
            listingFilterKeys.value = match.filter_keys || [];
            if (!catalogSectionLabel.value) {
              catalogSectionLabel.value = locale.value === 'en'
                ? (match.label_en || match.label_ru || match.slug)
                : (match.label_ru || match.label_en || match.slug);
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки страницы для редактирования:', error);
    alert(t('content.editor.loadError'));
  }
}

async function handleSubmit() {
  if (!form.value.title.trim()) {
    alert(t('content.editor.titleRequired'));
    return;
  }

  if (!form.value.summary.trim()) {
    alert(t('content.editor.summaryRequired'));
    return;
  }

  if (isListingSimple.value) {
    form.value.format = 'html';
    form.value.visibility = 'public';
    form.value.showInBlog = true;
    const photos = Array.isArray(listingMedia.value?.photos) ? listingMedia.value.photos.filter(Boolean) : [];
    if (!photos.length) {
      alert(t('content.listingGallery.photoRequired'));
      return;
    }
    applyListingMediaToForm();
  } else if (form.value.format === 'html') {
    // Проверяем, что контент не пустой (учитываем только видимый текст, без HTML тегов)
    const textContent = form.value.content.replace(/<[^>]*>/g, '').trim();
    if (!textContent) {
      alert(t('content.editor.contentRequired'));
      return;
    }
  } else {
    if (!fileBlob.value) {
      alert(t('content.editor.fileRequired'));
      return;
    }
  }

  try {
    isSubmitting.value = true;
    const feedFilterIdsPayload = (form.value.visibility === 'public' && form.value.showInBlog)
      ? (form.value.feedFilterIds || []).map((id) => Number(id)).filter((id) => !Number.isNaN(id))
      : [];
    const catalogPayload = (form.value.visibility === 'public' && form.value.showInBlog)
      ? catalogEntityPayloadFromEditor({
          sectionId: catalogSectionId.value,
          attrs: catalogAttrs.value,
        })
      : { catalog_section_id: null, catalog_attrs: [] };
    
    let page;
    if (isEditMode.value) {
      // Режим редактирования
      if (form.value.format === 'html') {
        const pageData = {
          title: form.value.title.trim(),
          summary: form.value.summary.trim(),
          // Сохраняем контент без обрезки пробелов в начале/конце, чтобы сохранить форматирование
          // Удаляем только пробелы в самом начале и конце, но сохраняем пробелы внутри
          content: form.value.content.replace(/^\s+/, '').replace(/\s+$/, ''),
          seo: form.value.seo,
          status: canModerate.value ? 'published' : 'pending',
          submit_for_review: !canModerate.value,
          settings: form.value.settings,
          visibility: form.value.visibility,
          required_permission: form.value.visibility === 'internal' && form.value.requiredPermission
            ? form.value.requiredPermission.trim()
            : null,
          format: form.value.format,
          mime_type: 'text/html',
          storage_type: 'embedded',
          category: form.value.category || null,
          show_in_blog: form.value.visibility === 'public' ? form.value.showInBlog : false,
          feed_filter_ids: feedFilterIdsPayload,
          catalog_section_id: catalogPayload.catalog_section_id,
          catalog_attrs: catalogPayload.catalog_attrs,
        };
        page = await pagesService.updatePage(editId.value, pageData);
      } else {
        // Отправляем как FormData для редактирования
        const fd = new FormData();
        fd.append('title', form.value.title.trim());
        fd.append('summary', form.value.summary.trim());
        fd.append('seo', JSON.stringify(form.value.seo));
        fd.append('status', canModerate.value ? 'published' : 'pending');
        fd.append('submit_for_review', canModerate.value ? 'false' : 'true');
        fd.append('settings', JSON.stringify(form.value.settings));
        fd.append('visibility', form.value.visibility);
        // Всегда отправляем required_permission:
        // - Если visibility = public, отправляем пустую строку (будет установлен null на бэкенде)
        // - Если visibility = internal, отправляем значение или пустую строку
        if (form.value.visibility === 'internal' && form.value.requiredPermission) {
          fd.append('required_permission', form.value.requiredPermission.trim());
        } else {
          // Явно устанавливаем пустое значение для public страниц
          fd.append('required_permission', '');
        }
        fd.append('format', form.value.format);
        if (form.value.visibility === 'public') {
          fd.append('show_in_blog', form.value.showInBlog ? 'true' : 'false');
        } else {
          fd.append('show_in_blog', 'false');
        }
        fd.append('category', form.value.category || '');
        fd.append('feed_filter_ids', JSON.stringify(feedFilterIdsPayload));
        fd.append('catalog_section_id', catalogPayload.catalog_section_id || '');
        fd.append('catalog_attrs', JSON.stringify(catalogPayload.catalog_attrs || []));
        if (fileBlob.value) {
          fd.append('file', fileBlob.value);
        }
        page = await pagesService.updatePage(editId.value, fd, true);
      }
    } else {
      // Режим создания
      if (form.value.format === 'html') {
        const pageData = {
          title: form.value.title.trim(),
          summary: form.value.summary.trim(),
          // Сохраняем контент без обрезки пробелов в начале/конце, чтобы сохранить форматирование
          // Удаляем только пробелы в самом начале и конце, но сохраняем пробелы внутри
          content: form.value.content.replace(/^\s+/, '').replace(/\s+$/, ''),
          seo: form.value.seo,
          status: canModerate.value ? 'published' : 'pending',
          submit_for_review: !canModerate.value,
          settings: form.value.settings,
          visibility: form.value.visibility,
          required_permission: form.value.visibility === 'internal' && form.value.requiredPermission
            ? form.value.requiredPermission.trim()
            : null,
          format: form.value.format,
          mime_type: 'text/html',
          storage_type: 'embedded',
          category: form.value.category || null,
          show_in_blog: form.value.visibility === 'public' ? form.value.showInBlog : false,
          feed_filter_ids: feedFilterIdsPayload,
          catalog_section_id: catalogPayload.catalog_section_id,
          catalog_attrs: catalogPayload.catalog_attrs,
        };
        page = await pagesService.createPage(pageData);
      } else {
        // Отправляем как FormData
        const fd = new FormData();
        fd.append('title', form.value.title.trim());
        fd.append('summary', form.value.summary.trim());
        fd.append('seo', JSON.stringify(form.value.seo));
        fd.append('status', canModerate.value ? 'published' : 'pending');
        fd.append('submit_for_review', canModerate.value ? 'false' : 'true');
        fd.append('settings', JSON.stringify(form.value.settings));
        fd.append('visibility', form.value.visibility);
        // Всегда отправляем required_permission:
        // - Если visibility = public, отправляем пустую строку (будет установлен null на бэкенде)
        // - Если visibility = internal, отправляем значение или пустую строку
        if (form.value.visibility === 'internal' && form.value.requiredPermission) {
          fd.append('required_permission', form.value.requiredPermission.trim());
        } else {
          // Явно устанавливаем пустое значение для public страниц
          fd.append('required_permission', '');
        }
        fd.append('format', form.value.format);
        if (form.value.visibility === 'public') {
          fd.append('show_in_blog', form.value.showInBlog ? 'true' : 'false');
        } else {
          fd.append('show_in_blog', 'false');
        }
        fd.append('category', form.value.category || '');
        fd.append('feed_filter_ids', JSON.stringify(feedFilterIdsPayload));
        fd.append('catalog_section_id', catalogPayload.catalog_section_id || '');
        fd.append('catalog_attrs', JSON.stringify(catalogPayload.catalog_attrs || []));
        fd.append('file', fileBlob.value);
        page = await pagesService.createPage(fd, true);
      }
    }
    
    if (!page || !page.id) {
      throw new Error(isEditMode.value ? t('content.editor.notUpdated') : t('content.editor.notCreated'));
    }

    if (page.feed_filter_error) {
      alert(t('content.editor.feedFilterSyncError', { message: page.feed_filter_error }));
    }

    const seo = page.seoHtml || null;
    const inBlog = form.value.visibility === 'public' && form.value.showInBlog;

    if (seo && seo.ready && seo.url) {
      const openBlog = inBlog && window.confirm(
        `${t('content.editor.seoReady')}\n\n${t('content.editor.openInBlogConfirm')}`
      );
      if (openBlog) {
        const path = inBlog
          ? `/blog/${encodeURIComponent(page.slug)}`
          : `/content/published/${encodeURIComponent(page.slug)}`;
        window.open(path, '_blank');
      }
    } else if (page.visibility === 'public' && page.status === 'published' && page.slug && seo && !seo.skipped) {
      alert(
        `${t('content.editor.seoNotReady')}\n${seo.error ? seo.error : ''}\n\n${t('content.editor.seoNotReadyHint')}`
      );
    }

    // Перенаправляем на список блога или страниц
    if (inBlog && seo?.ready) {
      router.push({ name: 'blog' });
    } else if (!canModerate.value && page.status === 'pending') {
      router.push({ name: 'content-list' });
    } else {
      router.push({ name: 'content-list' });
    }
  } catch (error) {
    console.error('Ошибка при создании страницы:', error);
    const msg =
      error?.response?.data?.error ||
      error?.message ||
      error;
    alert(t('content.editor.createError') + msg);
  } finally {
    isSubmitting.value = false;
  }
}

async function moderateApprove() {
  if (!editId.value) return;
  isSubmitting.value = true;
  try {
    await pagesService.approvePage(editId.value);
    router.push({ name: 'content-moderation' });
  } catch (e) {
    alert(e?.response?.data?.error || e.message || e);
  } finally {
    isSubmitting.value = false;
  }
}

async function moderateReturn() {
  if (!editId.value) return;
  isSubmitting.value = true;
  try {
    await pagesService.returnPage(editId.value);
    router.push({ name: 'content-moderation' });
  } catch (e) {
    alert(e?.response?.data?.error || e.message || e);
  } finally {
    isSubmitting.value = false;
  }
}

// Следим за изменением видимости и сбрасываем showInBlog для internal страниц
watch(() => form.value.visibility, (newVisibility) => {
  if (newVisibility === 'internal') {
    form.value.showInBlog = false;
    form.value.feedFilterIds = [];
  }
});

watch(() => form.value.showInBlog, (on) => {
  if (!on) form.value.feedFilterIds = [];
});

// Загрузка данных при монтировании
onMounted(async () => {
  if (!props.isAuthenticated || !canEditContent.value) {
    router.push({ name: 'content-list' });
    return;
  }
  
  // Загружаем категории и фильтры ленты
  await Promise.all([loadCategories(), loadFeedFilterOptions()]);
  
  if (isEditMode.value) {
    await loadPageForEdit();
  } else {
    const vis = route.query.visibility;
    if (vis === 'internal' || vis === 'public') {
      form.value.visibility = vis;
    }
    // Создание из /blog (visibility=public) → пост должен попасть в общую ленту после модерации
    const blogFlag = route.query.show_in_blog ?? route.query.showInBlog;
    if (blogFlag === '1' || blogFlag === 'true' || blogFlag === true) {
      form.value.showInBlog = true;
      form.value.visibility = 'public';
    } else if (vis === 'public') {
      form.value.showInBlog = true;
    }
    const fromQuery = catalogSelectionFromQuery(route.query);
    if (fromQuery.section || Object.keys(fromQuery).some((k) => k !== 'section' && fromQuery[k])) {
      form.value.showInBlog = true;
      form.value.visibility = 'public';
      try {
        const sections = await fetchCatalogSections({ all: 0 });
        const match = sections.find((s) => s.slug === fromQuery.section || s.id === fromQuery.section);
        if (match) {
          catalogSectionId.value = match.id;
          catalogSectionLabel.value = locale.value === 'en'
            ? (match.label_en || match.label_ru || match.slug)
            : (match.label_ru || match.label_en || match.slug);
          listingFilterKeys.value = Array.isArray(match.filter_keys) ? match.filter_keys : [];
        }
        const allowedKeys = new Set(match?.filter_keys || []);
        catalogAttrs.value = Object.entries(fromQuery)
          .filter(([k, v]) => k !== 'section' && v && (!allowedKeys.size || allowedKeys.has(k)))
          .map(([key, value]) => ({ key, value: String(value) }));
        await nextTick();
        syncAutoFillFromCatalog({ forceMain: true });
      } catch (e) {
        console.warn('[ContentPageView] catalog query prefill:', e);
      }
    }
  }
});

watch(isListingSimple, (on) => {
  if (on) form.value.format = 'html';
});

watch(
  catalogAttrs,
  () => {
    if (!isEditMode.value) syncAutoFillFromCatalog();
  },
  { deep: true }
);

watch(catalogSectionId, async (id) => {
  if (isEditMode.value || !id) {
    if (!id) catalogSectionLabel.value = '';
    return;
  }
  try {
    const sections = await fetchCatalogSections({ all: 0 });
    const match = sections.find((s) => s.id === id);
    if (match) {
      catalogSectionLabel.value = locale.value === 'en'
        ? (match.label_en || match.label_ru || match.slug)
        : (match.label_ru || match.label_en || match.slug);
      syncAutoFillFromCatalog();
    }
  } catch {
    /* ignore */
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', onPreviewKeydown);
  document.body.style.overflow = '';
});
</script>

<style scoped>
.content-create-page {
  position: relative;
  padding: 20px;
  width: 100%;
  background: transparent;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.header-content {
  flex: 1;
}

.header-content h1 {
  color: var(--color-primary);
  font-size: 2.5rem;
  margin: 0 0 10px 0;
}

.header-content p {
  color: var(--color-grey-dark);
  font-size: 1.1rem;
  margin: 0;
}



.content-block {
  background: transparent;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
}

.content-form {
  background: var(--theme-bg, #fff);
  border-radius: var(--radius-sm);
  padding: 30px;
  border: 1px solid transparent;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

.form-section {
  margin-bottom: 30px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-section h2 {
  color: var(--color-primary);
  margin: 0 0 20px 0;
  font-size: 1.3rem;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 10px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--color-grey-dark);
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-sm);
  font-size: 1rem;
  transition: border-color 0.3s ease;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(45, 114, 217, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-hint {
  margin: 0 0 8px;
  font-size: 0.85rem;
  color: var(--color-grey-dark, #606266);
  line-height: 1.4;
}

.og-image-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.og-image-clear {
  flex: 0 0 auto;
}

.og-image-hidden-file {
  display: none;
}

.og-image-preview {
  margin-top: 12px;
  max-width: 320px;
  border: 1px solid var(--color-border, #dcdfe6);
  border-radius: 8px;
  overflow: hidden;
  background: #f5f7fa;
}

.og-image-preview img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 200px;
  object-fit: contain;
  margin: 0;
  box-shadow: none;
  border-radius: 0;
}

.content-stats {
  display: flex;
  gap: 20px;
  margin-top: 8px;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
}

.listing-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.listing-chips__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: var(--radius-sm, 6px);
  background: var(--color-light, #eef1f4);
  color: var(--color-dark, #222);
  font-size: var(--font-size-sm, 0.875rem);
  cursor: pointer;
}

.listing-chips__chip:hover {
  opacity: 0.88;
}

.listing-chips__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listing-chips__x {
  flex-shrink: 0;
  font-size: 1rem;
  line-height: 1;
  opacity: 0.7;
}

.form-input[readonly],
.form-textarea[readonly] {
  background: var(--color-light, #f5f6f8);
  cursor: default;
}

/* Стили для видео в редакторе */
.content-form :deep(video) {
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

.content-form :deep(video.ql-video) {
  width: 100%;
  max-width: 100%;
  min-height: 400px;
}

.content-form :deep(video:focus) {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Стили для iframe в редакторе (для внешних видео) */
.content-form :deep(iframe) {
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

.content-form :deep(iframe.ql-video) {
  min-height: 400px;
  aspect-ratio: 16 / 9;
}

.content-form :deep(iframe:focus) {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Стили для изображений в редакторе */
.content-form :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1.5rem 0;
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.category-select-wrapper {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.category-select-wrapper .form-select {
  flex: 1;
}

.btn-add-section {
  white-space: nowrap;
  padding: 12px 16px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-weight: normal;
}

.form-hint--error {
  color: var(--color-danger);
}

.feed-filters-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.form-label-text {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
}

.form-checkbox {
  width: auto;
  margin: 0;
}

.form-actions {
  display: flex;
  gap: 15px;
  justify-content: flex-end;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.btn {
  padding: 12px 24px;
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

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
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
  .page-header {
    flex-direction: column;
    gap: 15px;
  }
  
  .header-content h1 {
    font-size: 2rem;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .content-stats {
    flex-direction: column;
    gap: 5px;
  }
}

.preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: center;
  align-items: stretch;
  padding: 16px;
  box-sizing: border-box;
}

.preview-dialog {
  background: var(--theme-bg, #fff);
  border-radius: 12px;
  width: min(920px, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.2);
}

.preview-dialog__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid #e9ecef;
  flex-shrink: 0;
}

.preview-dialog__bar-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.preview-dialog__bar-text strong {
  font-size: 1rem;
  color: var(--color-dark, #1f2a37);
}

.preview-dialog__bar-text span {
  font-size: 0.85rem;
  color: var(--color-grey-dark, #606266);
}

.preview-dialog__close {
  border: 1px solid var(--color-primary);
  background: #fff;
  color: var(--color-primary);
  border-radius: var(--radius-sm, 8px);
  padding: 8px 14px;
  cursor: pointer;
  font: inherit;
  flex-shrink: 0;
}

.preview-dialog__close:hover {
  background: var(--color-primary);
  color: #fff;
}

.preview-dialog__body {
  overflow: auto;
  padding: 24px 28px 40px;
  flex: 1;
}

.preview-dialog__empty {
  margin: 0;
  color: var(--color-grey-dark, #606266);
}

.preview-article h1 {
  margin: 0 0 12px;
  font-size: 1.85rem;
  line-height: 1.25;
  color: var(--color-dark, #1f2a37);
}

.preview-article__summary {
  margin: 0 0 20px;
  color: var(--color-grey-dark, #606266);
  font-size: 1.05rem;
  line-height: 1.5;
}

.preview-article__content {
  line-height: 1.65;
  color: var(--color-dark, #1f2a37);
}

.preview-article__content :deep(img),
.preview-article__content :deep(video),
.preview-article__content :deep(iframe) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1.25rem 0;
  border-radius: 8px;
}

.preview-article__content :deep(iframe),
.preview-article__content :deep(video) {
  width: 100%;
  min-height: 280px;
}

.preview-listing-card {
  max-width: 560px;
  margin: 0 auto;
  border: 1px solid color-mix(in srgb, var(--theme-text, #111) 8%, transparent);
  border-radius: 14px;
  overflow: hidden;
  background: var(--color-white, #fff);
}

.preview-listing-card__media {
  width: 100%;
  aspect-ratio: 4 / 3;
  background: #111;
  overflow: hidden;
}

.preview-listing-card__media img,
.preview-listing-card__media video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.preview-listing-card__media--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-grey);
  background: var(--color-light, #f4f6f8);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: 16px;
}

.preview-listing-card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-text, #111) 8%, transparent);
}

.preview-listing-card__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 8px;
  border: none;
  border-radius: var(--radius-md, 8px);
  background: transparent;
  color: var(--theme-text, #111);
  opacity: 0.7;
  cursor: default;
}

.preview-listing-card__body {
  padding: 14px 16px 18px;
}

.preview-listing-card__title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--theme-text, #111);
}

.preview-listing-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 10px;
}

.preview-listing-card__tag {
  display: inline-flex;
  max-width: 100%;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-text, #111) 6%, transparent);
  color: var(--theme-text-muted, var(--color-grey));
  font-size: 12px;
  line-height: 1.3;
}

.preview-listing-card__summary {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--theme-text, #222);
  white-space: pre-wrap;
}

@media (max-width: 640px) {
  .preview-overlay {
    padding: 0;
  }
  .preview-dialog {
    border-radius: 0;
  }
  .preview-dialog__body {
    padding: 16px 16px 32px;
  }
}
</style> 