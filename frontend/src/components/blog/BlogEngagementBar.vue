<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <section v-if="pageId" ref="rootEl" class="blog-engagement">
    <Teleport v-if="mediaRail && mediaRailTargetReady" to="#blog-article-media-rail">
      <BlogMediaRail
        show-subscribe
        expand-overflow
        :subscribe-active="showSubscribeForm"
        :counts="engagement.reactions"
        :my-reaction="engagement.myReaction"
        :comments-count="engagement.commentsCount"
        :views-count="engagement.viewsCount"
        :page-id="pageId"
        :page-slug="pageSlug"
        :owner-user-id="ownerUserId"
        :is-authenticated="isAuthenticated"
        :article-url="shareUrl"
        :page-title="pageTitle"
        show-author
        @select="handleReaction"
        @comments="scrollToComments"
        @subscribe="openSubscribe"
      />
    </Teleport>
    <div v-if="!mediaRail" class="blog-engagement__toolbar">
      <div class="blog-engagement__actions">
        <BlogReactions
          :counts="engagement.reactions"
          :my-reaction="engagement.myReaction"
          @select="handleReaction"
        />
        <button
          type="button"
          class="blog-engagement__icon-btn"
          :title="t('blog.comments.action')"
          @click="scrollToComments"
        >
          <BlogGlyph name="comment" />
          <span class="blog-engagement__count">{{ engagement.commentsCount }}</span>
        </button>
        <BlogShareBar
          v-if="shareUrl"
          :url="shareUrl"
          :title="pageTitle"
          compact
        />
        <button
          type="button"
          class="blog-engagement__icon-btn"
          :class="{ 'blog-engagement__icon-btn--ok': savedOk }"
          :title="t('blog.bookmark.action')"
          @click="saveToBrowserBookmarks"
        >
          <BlogGlyph name="bookmark" :filled="savedOk" />
        </button>
        <ListingContactActions
          v-if="pageId"
          icon-only
          :page-id="pageId"
          :page-slug="pageSlug"
          :owner-user-id="ownerUserId"
          :is-authenticated="isAuthenticated"
        />
        <span class="blog-engagement__icon-btn blog-engagement__icon-btn--static" :title="t('blog.views.label')">
          <BlogGlyph name="views" />
          <span class="blog-engagement__count">{{ engagement.viewsCount || 0 }}</span>
        </span>
      </div>
    </div>

    <BlogComments
      :page-id="pageId"
      :is-authenticated="isAuthenticated"
      :comments="engagement.comments"
      :comments-count="engagement.commentsCount"
      :is-loading="isLoading"
      @refresh="loadEngagement"
    />

    <div v-if="!mediaRail && !showSubscribeForm" class="blog-engagement__footer-actions">
      <button
        type="button"
        class="btn btn-primary btn-sm blog-engagement__subscribe-btn"
        @click="openSubscribe"
      >
        {{ t('blog.subscribe.button') }}
      </button>
    </div>

    <Teleport v-if="mediaRail && subscribeTargetReady" to="#blog-article-subscribe">
      <div v-if="showSubscribeForm" class="blog-engagement__subscribe">
        <div class="blog-engagement__subscribe-head">
          <div class="blog-engagement__subscribe-text">
            <h4 class="blog-engagement__subscribe-title">{{ t('blog.subscribe.title') }}</h4>
            <p class="blog-engagement__subscribe-hint">{{ t('blog.subscribe.hint') }}</p>
          </div>
          <button
            type="button"
            class="btn btn-outline btn-sm"
            @click="showSubscribeForm = false"
          >
            {{ t('common.cancel') }}
          </button>
        </div>
        <BlogSubscribeForm
          :filters="subscribeFilters"
          :source-page-id="pageId"
          :is-authenticated="isAuthenticated"
          @auth-changed="onSubscribeAuth"
          @done="onSubscribeDone"
        />
      </div>
    </Teleport>
    <div v-else-if="showSubscribeForm" class="blog-engagement__subscribe">
      <div class="blog-engagement__subscribe-head">
        <div class="blog-engagement__subscribe-text">
          <h4 class="blog-engagement__subscribe-title">{{ t('blog.subscribe.title') }}</h4>
          <p class="blog-engagement__subscribe-hint">{{ t('blog.subscribe.hint') }}</p>
        </div>
        <button
          type="button"
          class="btn btn-outline btn-sm"
          @click="showSubscribeForm = false"
        >
          {{ t('common.cancel') }}
        </button>
      </div>
      <BlogSubscribeForm
        :filters="subscribeFilters"
        :source-page-id="pageId"
        :is-authenticated="isAuthenticated"
        @auth-changed="onSubscribeAuth"
        @done="onSubscribeDone"
      />
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import eventBus from '../../utils/eventBus';
import blogEngagementService from '../../services/blogEngagementService';
import { emptyReactionCounts } from '../../constants/blogReactions';
import {
  catalogSelectionFromQuery,
  catalogSelectionToSubscribeFilters,
} from '../../services/catalogFiltersService';
import BlogShareBar from './BlogShareBar.vue';
import BlogComments from './BlogComments.vue';
import BlogReactions from './BlogReactions.vue';
import BlogGlyph from './BlogGlyph.vue';
import ListingContactActions from './ListingContactActions.vue';
import BlogSubscribeForm from './BlogSubscribeForm.vue';
import BlogMediaRail from './BlogMediaRail.vue';
import { useNotifications } from '../../composables/useNotifications';
import { copyUrlForBookmark, isApplePlatform } from '../../utils/browserBookmark';

const props = defineProps({
  pageId: { type: Number, default: null },
  pageSlug: { type: String, default: '' },
  pageTitle: { type: String, default: '' },
  ownerUserId: { type: [Number, String], default: null },
  isAuthenticated: { type: Boolean, default: false },
  subscribeFilters: { type: Object, default: null },
  /** Столбик действий на карусели статьи (лента уже имеет свой rail) */
  mediaRail: { type: Boolean, default: false },
});

const route = useRoute();
const { t } = useI18n();
const { showSuccessMessage } = useNotifications();

const engagement = ref({
  reactions: emptyReactionCounts(),
  viewsCount: 0,
  commentsCount: 0,
  myReaction: null,
  comments: [],
});
const isLoading = ref(false);
const rootEl = ref(null);
const showSubscribeForm = ref(false);
const savedOk = ref(false);
const mediaRailTargetReady = ref(false);
const subscribeTargetReady = ref(false);

const subscribeFilters = computed(() => {
  if (props.subscribeFilters) return props.subscribeFilters;
  return catalogSelectionToSubscribeFilters(catalogSelectionFromQuery(route.query));
});

const shareUrl = computed(() => {
  if (!props.pageSlug) return '';
  return `${window.location.origin}/blog/${encodeURIComponent(props.pageSlug.trim())}`;
});

function applyReactionResult(result) {
  if (!result) return;
  if (result.reactions) {
    engagement.value.reactions = { ...emptyReactionCounts(), ...result.reactions };
  }
  engagement.value.viewsCount = result.viewsCount ?? engagement.value.viewsCount;
  engagement.value.myReaction = result.myReaction ?? null;
}

async function loadEngagement() {
  if (!props.pageId) return;
  isLoading.value = true;
  try {
    const data = await blogEngagementService.getEngagement(props.pageId);
    engagement.value = {
      reactions: { ...emptyReactionCounts(), ...(data.reactions || {}) },
      viewsCount: data.viewsCount ?? 0,
      commentsCount: data.commentsCount ?? 0,
      myReaction: data.myReaction || null,
      comments: data.comments || [],
    };
  } catch (e) {
    console.error('[BlogEngagementBar] load:', e);
  } finally {
    isLoading.value = false;
  }
}

async function recordViewOnce() {
  if (!props.pageId) return;
  try {
    const result = await blogEngagementService.recordView(props.pageId);
    if (result?.viewsCount != null) {
      engagement.value.viewsCount = result.viewsCount;
    }
  } catch (e) {
    console.warn('[BlogEngagementBar] view:', e);
  }
}

async function handleReaction(type) {
  if (!props.isAuthenticated) {
    eventBus.emit('open-auth-sidebar');
    return;
  }
  try {
    applyReactionResult(await blogEngagementService.toggleReaction(props.pageId, type));
  } catch (e) {
    console.error('[BlogEngagementBar] reaction:', e);
  }
}

function onSubscribeAuth() {
  /* auth state обновляется через checkAuth в форме */
}

function onSubscribeDone() {
  setTimeout(() => { showSubscribeForm.value = false; }, 1800);
}

function openSubscribe() {
  showSubscribeForm.value = true;
  nextTick(() => {
    document.getElementById('blog-article-subscribe')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  });
}

async function saveToBrowserBookmarks() {
  await copyUrlForBookmark(shareUrl.value);
  savedOk.value = true;
  setTimeout(() => { savedOk.value = false; }, 2000);
  showSuccessMessage(
    isApplePlatform() ? t('blog.bookmark.hintMac') : t('blog.bookmark.hintWin')
  );
}

function scrollToComments() {
  const el = rootEl.value?.querySelector('#blog-comments') || rootEl.value;
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

watch(
  () => props.mediaRail,
  async (on) => {
    if (!on) {
      mediaRailTargetReady.value = false;
      subscribeTargetReady.value = false;
      return;
    }
    await nextTick();
    mediaRailTargetReady.value = Boolean(document.getElementById('blog-article-media-rail'));
    subscribeTargetReady.value = Boolean(document.getElementById('blog-article-subscribe'));
  },
  { immediate: true }
);

defineExpose({ scrollToComments });

onMounted(async () => {
  await loadEngagement();
  await recordViewOnce();
});

watch(() => props.pageId, async () => {
  await loadEngagement();
  await recordViewOnce();
});
watch(() => props.isAuthenticated, loadEngagement);
</script>

<style scoped>
.blog-engagement {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid color-mix(in srgb, var(--theme-text) 8%, transparent);
}

.blog-engagement__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 20px;
}

.blog-engagement__subscribe-btn {
  flex-shrink: 0;
}

.blog-engagement__subscribe {
  margin: 0 0 1.25rem;
  padding: 16px 18px;
  background: var(--color-light);
  border: 1px solid color-mix(in srgb, var(--theme-text) 6%, transparent);
  border-radius: var(--radius-lg);
}

.blog-engagement__listing {
  margin-left: auto;
}

.blog-engagement__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
}

.blog-engagement__icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 var(--spacing-sm);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-dark);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.blog-engagement__icon-btn:hover {
  background: var(--color-light);
  color: var(--color-primary);
}

.blog-engagement__icon-btn--ok {
  color: var(--color-primary);
}

.blog-engagement__icon-btn--static {
  cursor: default;
  margin-left: auto;
  color: var(--color-text-light);
  font-weight: 500;
}

.blog-engagement__icon-btn--static:hover {
  background: transparent;
  color: var(--color-text-light);
}

.blog-engagement__count {
  min-width: 0.75em;
  font-variant-numeric: tabular-nums;
}

.blog-engagement__subscribe-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.blog-engagement__subscribe-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 650;
  color: var(--theme-text);
}

.blog-engagement__subscribe-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--theme-text-muted);
}

.blog-engagement__subscribe-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.blog-engagement__consent {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-grey);
  cursor: pointer;
}

.blog-engagement__consent input {
  margin-top: 2px;
  flex-shrink: 0;
}

.blog-engagement__consent a {
  color: var(--color-primary);
  text-decoration: underline;
}

.blog-engagement__subscribe-input {
  width: 100%;
  box-sizing: border-box;
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  font-size: 14px;
  background: var(--color-white);
  color: var(--theme-text);
}

.blog-engagement__subscribe-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.blog-engagement__subscribe-msg {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--color-primary-dark);
}

.blog-engagement__footer-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}

/* TZ package D */
@media (max-width: 768px) {
  .page, .panel, .view, .container, [class*="container"], [class*="panel"], [class*="wrapper"], [class*="list"], [class*="content"] {
    max-width: 100%;
    box-sizing: border-box;
  }
  .form-row, .row, .actions, .toolbar, .header-row, .filters {
    flex-wrap: wrap;
  }
  [class*="grid"], .form-row {
    grid-template-columns: 1fr !important;
  }
}
</style>
