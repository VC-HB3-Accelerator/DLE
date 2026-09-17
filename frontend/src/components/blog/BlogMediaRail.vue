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
      'blog-media-rail--collapse': collapseActive,
      'blog-media-rail--expand': expandOverflow,
      'blog-media-rail--desktop': !isMobile,
      'blog-media-rail--compact-menu': compactOverflowMenu,
    }"
    @click.stop
  >
    <BlogReactions
      v-if="!likeInMore"
      stacked
      :counts="counts"
      :my-reaction="myReaction"
      :glyph-size="railGlyphSize"
      @select="$emit('select', $event)"
    />
    <button
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

    <div
      class="blog-media-rail__overflow"
      :role="moreOpen ? 'menu' : undefined"
      :aria-hidden="overflowHidden"
    >
      <button
        v-if="likeInMore"
        type="button"
        class="blog-media-rail__btn"
        :class="{ 'blog-media-rail__btn--like-on': likeActive }"
        :role="moreOpen ? 'menuitem' : undefined"
        :title="t('blog.likes.action')"
        :aria-pressed="likeActive"
        @click="onLike"
      >
        <span class="blog-media-rail__icon">
          <BlogGlyph name="heart" :filled="likeActive" :size="railGlyphSize" />
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

    <button
      v-if="collapseActive"
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNotifications } from '../../composables/useNotifications';
import { copyUrlForBookmark, isApplePlatform, shareOrCopyUrl } from '../../utils/browserBookmark';
import { emptyReactionCounts } from '../../constants/blogReactions';
import BlogReactions from './BlogReactions.vue';
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
  /** Страница объявления: аватар автора под «сохранить». На ленте не показываем. */
  showAuthor: { type: Boolean, default: false },
  /** Лента /blog: всегда меню «⋯». */
  collapseOverflow: { type: Boolean, default: false },
  /** Страница объявления: все действия в столбике, и на компьютере, и на телефоне. */
  expandOverflow: { type: Boolean, default: false },
  /** Лента /blog: лайк только внутри «⋯», не в столбике. */
  likeInMore: { type: Boolean, default: false },
});

const emit = defineEmits(['select', 'comments', 'subscribe']);

const { t } = useI18n();
const { showSuccessMessage, showErrorMessage } = useNotifications();
const sharedOk = ref(false);
const savedOk = ref(false);
const moreOpen = ref(false);
const rootEl = ref(null);
const isMobile = ref(
  typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false
);
let mobileMq = null;
let sharedOkTimer = null;

const collapseActive = computed(
  () => !props.expandOverflow && (isMobile.value || props.collapseOverflow)
);

const overflowHidden = computed(
  () => collapseActive.value && !moreOpen.value
);

/** Один размер для столбика и меню «⋯»: мобилка 20, десктоп 14. */
const railGlyphSize = computed(() => (isMobile.value ? 20 : 18));

/** Лента на десктопе: компактное меню ⋯ (синхронно с isMobile, не только @media). */
const compactOverflowMenu = computed(
  () => !isMobile.value && props.collapseOverflow && !props.expandOverflow
);

const authorIdLabel = computed(() => {
  const id = Number(props.ownerUserId);
  return Number.isInteger(id) && id > 0 ? String(id) : '';
});

const likesCount = computed(() => Number(props.counts?.heart || 0));
const likeActive = computed(() => props.myReaction === 'heart');

function syncMobile() {
  isMobile.value = Boolean(mobileMq?.matches);
  if (!collapseActive.value) moreOpen.value = false;
}

function toggleMore() {
  moreOpen.value = !moreOpen.value;
}

function closeMore() {
  moreOpen.value = false;
}

function handleDocumentClick(event) {
  if (!moreOpen.value) return;
  const root = rootEl.value;
  if (root && !root.contains(event.target)) closeMore();
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') closeMore();
}

async function onShare() {
  // Сначала share/copy (нужен user gesture), меню закрываем после.
  await sharePost();
  closeMore();
}

async function onBookmark() {
  await saveToBrowserBookmarks();
  closeMore();
}

function onLike() {
  emit('select', 'heart');
}

function onSubscribe() {
  closeMore();
  emit('subscribe');
}

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
  /* Как аватар слева: 16px, на ≤1024 — 20px + safe-area */
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
  --rail-gap: 18px;
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
}

.blog-media-rail__label {
  display: none;
}

.blog-media-rail__btn,
.blog-media-rail :deep(.blog-reactions__btn--stacked),
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
.blog-media-rail :deep(.blog-reactions__btn--stacked:hover),
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

.blog-media-rail :deep(.blog-reactions__btn--stacked.blog-reactions__btn--active),
.blog-media-rail__btn--like-on {
  color: #ff3040;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
}

.blog-media-rail__icon,
.blog-media-rail :deep(.blog-reactions__icon),
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
.blog-media-rail :deep(.blog-reactions__icon .blog-glyph),
.blog-media-rail :deep(.listing-contact__icon-btn .blog-glyph) {
  width: var(--rail-icon) !important;
  height: var(--rail-icon) !important;
  overflow: visible;
}

.blog-media-rail__icon :deep(.blog-glyph path),
.blog-media-rail__icon :deep(.blog-glyph circle),
.blog-media-rail :deep(.blog-reactions__icon .blog-glyph path),
.blog-media-rail :deep(.blog-reactions__icon .blog-glyph circle),
.blog-media-rail :deep(.listing-contact__icon-btn .blog-glyph path),
.blog-media-rail :deep(.listing-contact__icon-btn .blog-glyph circle) {
  stroke-width: 2;
}

.blog-media-rail__count,
.blog-media-rail :deep(.blog-reactions__count),
.blog-media-rail :deep(.blog-reactions__btn--stacked .blog-reactions__count) {
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

.blog-media-rail--collapse .blog-media-rail__overflow {
  display: none;
}

.blog-media-rail--collapse.blog-media-rail--more-open .blog-media-rail__overflow {
  display: flex;
  position: absolute;
  right: calc(100% + 8px);
  bottom: 0;
  z-index: 5;
  min-width: 196px;
  max-width: min(240px, calc(100vw - 72px));
  padding: 6px;
  border-radius: 12px;
  background: rgba(18, 18, 18, 0.88);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  align-items: stretch;
  gap: 2px;
}

.blog-media-rail--collapse.blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__btn--like-on {
  filter: none;
  color: #ff3040;
}

.blog-media-rail--collapse.blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__btn {
  display: grid;
  grid-template-columns: var(--rail-icon) minmax(0, 1fr) auto;
  grid-template-areas: "icon label count";
  align-items: center;
  justify-content: start;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 8px 10px;
  box-sizing: border-box;
  border-radius: 8px;
  filter: none;
}

.blog-media-rail--collapse.blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__icon {
  grid-area: icon;
}

.blog-media-rail--collapse.blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__label {
  grid-area: label;
}

.blog-media-rail--collapse.blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__count {
  grid-area: count;
  order: 0;
  font-size: 13px;
  text-align: right;
}

.blog-media-rail--collapse.blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__btn:hover {
  background: rgba(255, 255, 255, 0.1);
  opacity: 1;
  transform: none;
}

.blog-media-rail--collapse.blog-media-rail--more-open .blog-media-rail__label {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  text-align: left;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
}

.blog-media-rail--collapse.blog-media-rail--more-open .blog-media-rail__count {
  order: 0;
}

/* Десктоп: один размер для столбика и меню «⋯» */
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

/* Меню «⋯»: только раскладка панели, иконки = --rail-icon с рейла */
.blog-media-rail--compact-menu.blog-media-rail--more-open .blog-media-rail__overflow {
  min-width: 160px;
  max-width: min(200px, calc(100vw - 72px));
  padding: 4px;
  border-radius: 10px;
  gap: 0;
}

.blog-media-rail--compact-menu.blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__btn {
  grid-template-columns: var(--rail-icon) minmax(0, 1fr) auto;
  gap: 6px;
  min-width: 0;
  min-height: calc(var(--rail-icon) + 8px);
  padding: 4px 6px;
  border-radius: 6px;
}

.blog-media-rail--compact-menu.blog-media-rail--more-open .blog-media-rail__label,
.blog-media-rail--compact-menu.blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__count {
  font-size: 12px;
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

  .blog-media-rail--collapse.blog-media-rail--more-open .blog-media-rail__overflow {
    min-width: 160px;
    max-width: min(200px, calc(100vw - 72px));
    padding: 4px;
    border-radius: 10px;
    gap: 0;
  }

  .blog-media-rail--collapse.blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__btn {
    grid-template-columns: var(--rail-icon) minmax(0, 1fr) auto;
    gap: 6px;
    min-width: 0;
    min-height: calc(var(--rail-icon) + 8px);
    padding: 4px 6px;
    border-radius: 6px;
  }

  .blog-media-rail--collapse.blog-media-rail--more-open .blog-media-rail__label,
  .blog-media-rail--collapse.blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__count {
    font-size: 12px;
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

  .blog-media-rail__btn.blog-media-rail__more-btn {
    display: flex;
  }

  .blog-media-rail__overflow {
    display: none;
  }

  /* Страница объявления: столбик целиком, без «⋯» */
  .blog-media-rail--expand .blog-media-rail__btn.blog-media-rail__more-btn {
    display: none;
  }

  .blog-media-rail--expand .blog-media-rail__overflow,
  .blog-media-rail--expand.blog-media-rail--more-open .blog-media-rail__overflow {
    display: flex;
    position: static;
    right: auto;
    bottom: auto;
    z-index: auto;
    min-width: 0;
    max-width: none;
    padding: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    align-items: flex-end;
    gap: var(--rail-gap);
  }

  .blog-media-rail--expand .blog-media-rail__overflow .blog-media-rail__btn,
  .blog-media-rail--expand.blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__btn {
    display: flex;
    grid-template-columns: none;
    grid-template-areas: none;
    justify-content: flex-end;
    gap: var(--rail-icon-count-gap);
    width: auto;
    min-height: var(--rail-hit);
    padding: 0;
    border-radius: 0;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55));
  }

  .blog-media-rail--expand .blog-media-rail__label {
    display: none;
  }

  .blog-media-rail--more-open .blog-media-rail__overflow {
    display: flex;
    position: absolute;
    right: calc(100% + 8px);
    bottom: 0;
    z-index: 5;
    min-width: 196px;
    max-width: min(240px, calc(100vw - 72px));
    padding: 6px;
    border-radius: 12px;
    background: rgba(18, 18, 18, 0.88);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    align-items: stretch;
    gap: 2px;
  }

  .blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__btn {
    display: grid;
    grid-template-columns: var(--rail-icon) minmax(0, 1fr) auto;
    grid-template-areas: "icon label count";
    align-items: center;
    justify-content: start;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 8px 10px;
    box-sizing: border-box;
    border-radius: 8px;
    filter: none;
  }

  .blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__icon {
    grid-area: icon;
  }

  .blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__label {
    grid-area: label;
  }

  .blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__count {
    grid-area: count;
    order: 0;
    font-size: 13px;
    text-align: right;
  }

  .blog-media-rail--more-open .blog-media-rail__overflow .blog-media-rail__btn:hover {
    background: rgba(255, 255, 255, 0.1);
    opacity: 1;
    transform: none;
  }

  .blog-media-rail--more-open .blog-media-rail__label {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
    text-align: left;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  }

  .blog-media-rail--more-open .blog-media-rail__count {
    order: 0;
    font-size: 13px;
    text-align: right;
  }

  .blog-media-rail__btn,
  .blog-media-rail :deep(.blog-reactions__btn--stacked) {
    gap: var(--rail-icon-count-gap);
  }

  .blog-media-rail__btn:hover,
  .blog-media-rail :deep(.blog-reactions__btn--stacked:hover),
  .blog-media-rail :deep(.listing-contact__icon-btn:hover:not(:disabled)) {
    transform: none;
  }

  .blog-media-rail__count,
  .blog-media-rail :deep(.blog-reactions__count) {
    font-size: 13px;
    line-height: 1;
  }
}

@media (max-width: 380px) {
  .blog-media-rail {
    --rail-gap: 14px;
    right: max(var(--rail-edge-gap), env(safe-area-inset-right, 0px));
    bottom: 12px;
  }

  .blog-media-rail--compact {
    --rail-gap: 12px;
  }
}
</style>
