<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  Вертикальный столбик действий поверх медиа (лента и страница объявления).
-->

<template>
  <div
    ref="rootEl"
    class="blog-media-rail"
    :class="{
      'blog-media-rail--compact': compact,
      'blog-media-rail--more-open': moreOpen,
      /* Лента всегда; объявление — только на мобилке */
      'blog-media-rail--collapse': collapses,
      'blog-media-rail--desktop': !isMobile,
      'blog-media-rail--compact-menu': compactOverflowMenu,
    }"
    @click.stop
  >
    <button
      v-if="showComments"
      type="button"
      class="blog-media-rail__btn"
      :title="t('blog.comments.action')"
      @click="$emit('comments')"
    >
      <span class="blog-media-rail__count">{{ commentsCount }}</span>
      <span class="blog-media-rail__icon">
        <BlogGlyph name="comment" :size="railGlyphSize" />
      </span>
    </button>
    <ListingContactActions
      v-if="pageId"
      icon-only
      :page-id="pageId"
      :page-slug="pageSlug"
      :owner-user-id="ownerUserId"
      :is-authenticated="isAuthenticated"
    />
    <button
      v-if="showSubscribe"
      type="button"
      class="blog-media-rail__btn"
      :class="{ 'blog-media-rail__btn--ok': subscribeActive }"
      :title="t('blog.subscribe.button')"
      @click="onSubscribe"
    >
      <span class="blog-media-rail__icon">
        <BlogGlyph name="bell" :filled="subscribeActive" :size="railGlyphSize" />
      </span>
    </button>

    <!-- Десктоп объявления: пункты в столбике. Лента / мобилка: панель через Teleport вне карточки -->
    <Teleport to="body" :disabled="!collapses">
      <div
        v-show="!collapses || moreOpen"
        ref="overflowEl"
        class="blog-media-rail__overflow"
        :class="{
          'blog-media-rail__overflow--portal': collapses && moreOpen,
          'blog-media-rail__overflow--compact': collapses && moreOpen && compactOverflowMenu,
        }"
        :style="collapses && moreOpen ? menuStyle : undefined"
        :role="moreOpen ? 'menu' : undefined"
        :aria-hidden="overflowHidden"
        @click.stop
      >
        <button
          type="button"
          class="blog-media-rail__btn"
          :role="moreOpen ? 'menuitem' : undefined"
          :class="{ 'blog-media-rail__btn--liked': liked }"
          :title="t('blog.likes.action')"
          :aria-pressed="liked"
          @click="$emit('select', 'heart')"
        >
          <span class="blog-media-rail__icon">
            <BlogGlyph name="heart" :filled="liked" :size="railGlyphSize" />
          </span>
          <span class="blog-media-rail__label">{{ t('blog.likes.action') }}</span>
          <span class="blog-media-rail__count">{{ likesCount }}</span>
        </button>
        <span
          class="blog-media-rail__btn blog-media-rail__btn--static"
          :role="moreOpen ? 'menuitem' : undefined"
          :title="t('blog.views.label')"
        >
          <span class="blog-media-rail__count">{{ viewsCount || 0 }}</span>
          <span class="blog-media-rail__icon">
            <BlogGlyph name="views" :size="railGlyphSize" />
          </span>
          <span class="blog-media-rail__label">{{ t('blog.views.label') }}</span>
        </span>
        <button
          type="button"
          class="blog-media-rail__btn"
          :role="moreOpen ? 'menuitem' : undefined"
          :class="{ 'blog-media-rail__btn--ok': sharedOk }"
          :title="sharedOk ? t('blog.share.copied') : t('blog.share.action')"
          @click="onShare"
        >
          <span class="blog-media-rail__icon">
            <BlogGlyph :name="sharedOk ? 'check' : 'share'" :size="railGlyphSize" />
          </span>
          <span class="blog-media-rail__label">{{
            sharedOk ? t('blog.share.copied') : t('blog.share.action')
          }}</span>
        </button>
        <button
          type="button"
          class="blog-media-rail__btn"
          :role="moreOpen ? 'menuitem' : undefined"
          :class="{ 'blog-media-rail__btn--ok': savedOk }"
          :title="t('blog.bookmark.action')"
          @click="onBookmark"
        >
          <span class="blog-media-rail__icon">
            <BlogGlyph name="bookmark" :filled="savedOk" :size="railGlyphSize" />
          </span>
          <span class="blog-media-rail__label">{{ t('blog.bookmark.action') }}</span>
        </button>
      </div>
    </Teleport>

    <button
      ref="moreBtnEl"
      type="button"
      class="blog-media-rail__btn blog-media-rail__more-btn"
      :title="t('blog.mediaRail.more')"
      :aria-label="t('blog.mediaRail.more')"
      :aria-expanded="moreOpen"
      aria-haspopup="menu"
      @click="toggleMore"
    >
      <span class="blog-media-rail__icon">
        <BlogGlyph name="more" :size="railGlyphSize" />
      </span>
    </button>
    <span
      v-if="showAuthor && authorIdLabel"
      class="blog-media-rail__author"
      :title="authorIdLabel"
    >{{ authorIdLabel }}</span>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNotifications } from '../../composables/useNotifications';
import { copyUrlForBookmark, isApplePlatform, shareOrCopyUrl } from '../../utils/browserBookmark';
import { emptyReactionCounts } from '../../constants/blogReactions';
import BlogGlyph from './BlogGlyph.vue';
import ListingContactActions from './ListingContactActions.vue';

const MOBILE_MQ = '(max-width: 768px)';

const props = defineProps({
  counts: {
    type: Object,
    default: () => emptyReactionCounts(),
  },
  myReaction: { type: String, default: null },
  commentsCount: { type: Number, default: 0 },
  viewsCount: { type: Number, default: 0 },
  pageId: { type: Number, default: null },
  pageSlug: { type: String, default: '' },
  ownerUserId: { type: [Number, String], default: null },
  isAuthenticated: { type: Boolean, default: false },
  articleUrl: { type: String, default: '' },
  pageTitle: { type: String, default: '' },
  compact: { type: Boolean, default: false },
  showSubscribe: { type: Boolean, default: false },
  subscribeActive: { type: Boolean, default: false },
  /** Страница объявления: аватар автора под столбиком. На ленте не показываем. */
  showAuthor: { type: Boolean, default: false },
  /** Лента: иконка комментариев. На странице объявления скрываем — блок ниже фото. */
  showComments: { type: Boolean, default: true },
  /** Лента: всегда меню «⋯». Объявление без пропа — «⋯» только на мобилке. */
  collapseOverflow: { type: Boolean, default: false },
});

const emit = defineEmits(['select', 'comments', 'subscribe']);

const { t } = useI18n();
const { showSuccessMessage, showErrorMessage } = useNotifications();
const sharedOk = ref(false);
const savedOk = ref(false);
const moreOpen = ref(false);
const rootEl = ref(null);
const moreBtnEl = ref(null);
const overflowEl = ref(null);
const menuStyle = ref({});
const isMobile = ref(
  typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false
);
let mobileMq = null;
let sharedOkTimer = null;

/** Лента всегда; страница объявления — только ≤768 */
const collapses = computed(() => props.collapseOverflow || isMobile.value);

const overflowHidden = computed(() => collapses.value && !moreOpen.value);

/** Один размер для столбика и меню «⋯»: мобилка 20, десктоп 18. */
const railGlyphSize = computed(() => (isMobile.value ? 20 : 18));

const liked = computed(() => props.myReaction === 'heart');
const likesCount = computed(() => Number(props.counts?.heart || 0));

/** Компактная панель на десктопной ленте */
const compactOverflowMenu = computed(() => !isMobile.value && props.collapseOverflow);

const authorIdLabel = computed(() => {
  const id = Number(props.ownerUserId);
  return Number.isInteger(id) && id > 0 ? String(id) : '';
});

function updateMenuPosition() {
  const btn = moreBtnEl.value;
  if (!btn || typeof window === 'undefined') return;
  const r = btn.getBoundingClientRect();
  menuStyle.value = {
    position: 'fixed',
    right: `${Math.max(8, window.innerWidth - r.left + 8)}px`,
    bottom: `${Math.max(8, window.innerHeight - r.bottom)}px`,
    zIndex: 10050,
  };
}

function bindMenuPositionListeners(on) {
  if (typeof window === 'undefined') return;
  if (on) {
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);
  } else {
    window.removeEventListener('scroll', updateMenuPosition, true);
    window.removeEventListener('resize', updateMenuPosition);
  }
}

function syncMobile() {
  isMobile.value = Boolean(mobileMq?.matches);
  if (!collapses.value) moreOpen.value = false;
}

function toggleMore() {
  moreOpen.value = !moreOpen.value;
}

function closeMore() {
  moreOpen.value = false;
}

function handleDocumentClick(event) {
  if (!moreOpen.value) return;
  const target = event.target;
  if (rootEl.value?.contains(target) || overflowEl.value?.contains(target)) return;
  closeMore();
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') closeMore();
}

async function onShare() {
  await sharePost();
  closeMore();
}

async function onBookmark() {
  await saveToBrowserBookmarks();
  closeMore();
}

function onSubscribe() {
  closeMore();
  emit('subscribe');
}

watch(moreOpen, async (open) => {
  bindMenuPositionListeners(false);
  if (open && collapses.value) {
    await nextTick();
    updateMenuPosition();
    bindMenuPositionListeners(true);
  }
});

onMounted(() => {
  if (typeof window !== 'undefined') {
    mobileMq = window.matchMedia(MOBILE_MQ);
    syncMobile();
    mobileMq.addEventListener('change', syncMobile);
  }
  document.addEventListener('click', handleDocumentClick, true);
  document.addEventListener('keydown', handleDocumentKeydown);
});

onBeforeUnmount(() => {
  if (mobileMq) {
    mobileMq.removeEventListener('change', syncMobile);
  }
  document.removeEventListener('click', handleDocumentClick, true);
  document.removeEventListener('keydown', handleDocumentKeydown);
  bindMenuPositionListeners(false);
  if (sharedOkTimer) clearTimeout(sharedOkTimer);
});

async function sharePost() {
  const result = await shareOrCopyUrl({
    url: props.articleUrl,
    title: props.pageTitle || (typeof document !== 'undefined' ? document.title : ''),
  });
  if (result === 'aborted') return;
  if (result === 'failed') {
    showErrorMessage(t('blog.share.failed'));
    return;
  }
  sharedOk.value = true;
  if (sharedOkTimer) clearTimeout(sharedOkTimer);
  sharedOkTimer = setTimeout(() => { sharedOk.value = false; }, 1500);
  if (result === 'copied') {
    showSuccessMessage(t('blog.share.copied'));
  }
}

async function saveToBrowserBookmarks() {
  await copyUrlForBookmark(props.articleUrl);
  savedOk.value = true;
  setTimeout(() => { savedOk.value = false; }, 2000);
  showSuccessMessage(
    isApplePlatform() ? t('blog.bookmark.hintMac') : t('blog.bookmark.hintWin')
  );
}
</script>

<style scoped>
.blog-media-rail {
  --rail-icon: 18px;
  --rail-hit: 36px;
  --rail-gap: 12px;
  --rail-icon-count-gap: 8px;
  --rail-count-min: 3ch;
  --rail-edge-gap: 16px;
  --rail-count-size: 12px;
  position: absolute;
  right: max(var(--rail-edge-gap), env(safe-area-inset-right, 0px));
  bottom: 24px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  gap: var(--rail-gap);
  max-height: calc(100% - 12px);
  color: #fff;
  font-size: var(--rail-count-size);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  box-sizing: border-box;
}

.blog-media-rail--compact {
  --rail-gap: 10px;
  bottom: 20px;
}

.blog-media-rail > * {
  pointer-events: auto;
}

.blog-media-rail__overflow {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--rail-gap);
  pointer-events: auto;
}

.blog-media-rail__label {
  display: none;
}

.blog-media-rail__btn,
.blog-media-rail :deep(.listing-contact__icon-btn) {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: var(--rail-icon-count-gap);
  margin: 0;
  padding: 0;
  min-width: var(--rail-hit);
  min-height: var(--rail-hit);
  border: none;
  border-radius: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55));
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.blog-media-rail__btn:hover,
.blog-media-rail :deep(.listing-contact__icon-btn:hover:not(:disabled)) {
  background: transparent;
  color: #fff;
  opacity: 0.88;
  transform: scale(1.06);
}

.blog-media-rail__btn--static {
  cursor: default;
}

.blog-media-rail__btn--static:hover {
  opacity: 1;
  transform: none;
}

.blog-media-rail__btn--ok {
  color: #7dffb3;
}

.blog-media-rail__btn--liked {
  color: #ff3040;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
}

.blog-media-rail__icon,
.blog-media-rail :deep(.listing-contact__icon-wrap) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--rail-icon);
  height: var(--rail-hit);
  flex-shrink: 0;
  background: none;
  border: none;
  box-shadow: none;
}

.blog-media-rail__icon :deep(.blog-glyph),
.blog-media-rail :deep(.listing-contact__icon-btn .blog-glyph) {
  width: var(--rail-icon) !important;
  height: var(--rail-icon) !important;
  overflow: visible;
}

.blog-media-rail__icon :deep(.blog-glyph path),
.blog-media-rail__icon :deep(.blog-glyph circle),
.blog-media-rail :deep(.listing-contact__icon-btn .blog-glyph path),
.blog-media-rail :deep(.listing-contact__icon-btn .blog-glyph circle) {
  stroke-width: 2;
}

.blog-media-rail__count {
  order: -1;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  min-width: var(--rail-count-min);
  margin: 0;
  padding: 0;
  text-align: right;
}

.blog-media-rail :deep(.listing-contact--icon) {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.blog-media-rail :deep(.listing-contact__text) {
  display: none;
}

.blog-media-rail :deep(.listing-contact__icon-btn) {
  flex-direction: row;
  width: var(--rail-hit);
  height: var(--rail-hit);
  min-width: var(--rail-hit);
  min-height: var(--rail-hit);
  padding: 0;
  opacity: 1;
}

.blog-media-rail :deep(.listing-contact__icon-btn:disabled) {
  opacity: 0.45;
  cursor: default;
  transform: none;
}

.blog-media-rail__btn.blog-media-rail__more-btn {
  display: none;
}

.blog-media-rail__author {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: var(--rail-hit);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55));
}

.blog-media-rail--collapse .blog-media-rail__btn.blog-media-rail__more-btn {
  display: flex;
}

.blog-media-rail--collapse .blog-media-rail__overflow:not(.blog-media-rail__overflow--portal) {
  display: none;
}

/* Панель вне карточки (Teleport → body) */
.blog-media-rail__overflow--portal {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  min-width: 196px;
  max-width: min(240px, calc(100vw - 24px));
  padding: 6px;
  border-radius: 12px;
  background: rgba(18, 18, 18, 0.92);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  color: #fff;
  box-sizing: border-box;
  --rail-icon: 20px;
  --rail-hit: 36px;
  --rail-icon-count-gap: 8px;
}

.blog-media-rail__overflow--portal.blog-media-rail__overflow--compact {
  min-width: 160px;
  max-width: min(200px, calc(100vw - 24px));
  padding: 4px;
  border-radius: 10px;
  gap: 0;
  --rail-icon: 18px;
}

.blog-media-rail__overflow--portal .blog-media-rail__btn {
  display: grid;
  grid-template-columns: var(--rail-icon) minmax(0, 1fr) auto;
  grid-template-areas: "icon label count";
  align-items: center;
  justify-content: start;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  min-width: 0;
  padding: 8px 10px;
  box-sizing: border-box;
  border-radius: 8px;
  filter: none;
  color: #fff;
}

.blog-media-rail__overflow--portal.blog-media-rail__overflow--compact .blog-media-rail__btn {
  gap: 6px;
  min-height: calc(var(--rail-icon) + 8px);
  padding: 4px 6px;
  border-radius: 6px;
}

.blog-media-rail__overflow--portal .blog-media-rail__icon {
  grid-area: icon;
  width: var(--rail-icon);
  height: var(--rail-icon);
  min-height: var(--rail-icon);
}

.blog-media-rail__overflow--portal .blog-media-rail__label {
  display: block;
  grid-area: label;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  text-align: left;
  text-shadow: none;
}

.blog-media-rail__overflow--portal.blog-media-rail__overflow--compact .blog-media-rail__label,
.blog-media-rail__overflow--portal.blog-media-rail__overflow--compact .blog-media-rail__count {
  font-size: 12px;
}

.blog-media-rail__overflow--portal .blog-media-rail__count {
  grid-area: count;
  order: 0;
  font-size: 13px;
  text-align: right;
  text-shadow: none;
}

.blog-media-rail__overflow--portal .blog-media-rail__btn:hover {
  background: rgba(255, 255, 255, 0.1);
  opacity: 1;
  transform: none;
}

.blog-media-rail--desktop {
  --rail-icon: 18px;
  --rail-hit: 36px;
  --rail-gap: 12px;
  --rail-icon-count-gap: 8px;
  --rail-count-size: 12px;
}

.blog-media-rail--desktop.blog-media-rail--compact {
  --rail-gap: 10px;
}

@media (min-width: 769px) {
  .blog-media-rail {
    --rail-icon: 18px;
    --rail-hit: 36px;
    --rail-gap: 12px;
    --rail-icon-count-gap: 8px;
    --rail-count-size: 12px;
  }

  .blog-media-rail--compact {
    --rail-gap: 10px;
  }
}

@media (max-width: 1024px) {
  .blog-media-rail {
    --rail-edge-gap: 20px;
    bottom: 20px;
  }

  .blog-media-rail--compact {
    bottom: 16px;
  }

  .blog-media-rail--desktop {
    --rail-gap: 12px;
  }
}

@media (max-width: 768px) {
  .blog-media-rail {
    --rail-icon: 20px;
    --rail-hit: 36px;
    --rail-gap: 10px;
    --rail-icon-count-gap: 8px;
    --rail-count-size: 12px;
    right: max(var(--rail-edge-gap), env(safe-area-inset-right, 0px));
    bottom: 12px;
  }

  .blog-media-rail--compact {
    --rail-gap: 8px;
    bottom: 12px;
  }

  .blog-media-rail__btn {
    gap: var(--rail-icon-count-gap);
  }

  .blog-media-rail__btn:hover,
  .blog-media-rail :deep(.listing-contact__icon-btn:hover:not(:disabled)) {
    transform: none;
  }

  .blog-media-rail__count {
    font-size: 13px;
    line-height: 1;
  }
}

@media (max-width: 380px) {
  .blog-media-rail {
    --rail-gap: 8px;
    right: max(var(--rail-edge-gap), env(safe-area-inset-right, 0px));
    bottom: 12px;
  }

  .blog-media-rail--compact {
    --rail-gap: 6px;
  }
}
</style>
