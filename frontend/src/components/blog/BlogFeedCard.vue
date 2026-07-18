<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <article class="blog-feed-card">
    <!-- Шапка карточки: подписка + вход -->
    <header class="blog-feed-card__header">
      <div class="blog-feed-card__header-actions">
        <button
          v-if="!showSubscribeForm"
          type="button"
          class="blog-feed-card__header-btn blog-feed-card__header-btn--primary"
          @click.stop="showSubscribeForm = true"
        >
          {{ t('blog.subscribe.button') }}
        </button>
        <form v-else class="blog-feed-card__subscribe-inline" @submit.prevent="handleSubscribe" @click.stop>
          <input
            v-model="subscribeEmail"
            type="email"
            class="blog-feed-card__subscribe-input"
            :placeholder="t('blog.subscribe.placeholder')"
            required
          />
          <button type="submit" class="blog-feed-card__header-btn blog-feed-card__header-btn--primary" :disabled="isSubscribing">
            OK
          </button>
        </form>
        <button
          v-if="!isAuthenticated"
          type="button"
          class="blog-feed-card__header-btn"
          @click.stop="requestLogin"
        >
          {{ t('blog.feed.login') }}
        </button>
      </div>
      <p v-if="subscribeMessage" class="blog-feed-card__subscribe-msg" @click.stop>{{ subscribeMessage }}</p>
    </header>

    <!-- Медиа -->
    <div v-if="page.cover_url" class="blog-feed-card__media" @click.stop="openArticle">
      <img
        v-if="!isDirectVideo"
        :src="page.cover_url"
        :alt="page.title"
        loading="lazy"
      />
      <div v-else class="blog-feed-card__media-video">
        <video
          :src="page.cover_url"
          muted
          playsinline
          preload="metadata"
        />
        <span class="blog-feed-card__play" aria-hidden="true">
          <i class="fas fa-play"></i>
        </span>
      </div>
    </div>
    <div v-else class="blog-feed-card__media blog-feed-card__media--placeholder" @click.stop="openArticle">
      <i class="fas fa-image" aria-hidden="true"></i>
    </div>

    <!-- Действия -->
    <div class="blog-feed-card__actions" @click.stop>
      <BlogReactions
        :counts="reactionCounts"
        :my-reaction="myReaction"
        @select="handleReaction"
      />
      <button
        type="button"
        class="blog-feed-card__action"
        :title="t('blog.comments.action')"
        @click="openComments"
      >
        <span class="blog-feed-card__glyph" aria-hidden="true">💬</span>
        <span>{{ commentsCount }}</span>
      </button>
      <span class="blog-feed-card__action blog-feed-card__action--static" :title="t('blog.views.label')">
        <span class="blog-feed-card__glyph" aria-hidden="true">👁</span>
        <span>{{ viewsCount }}</span>
      </span>
      <button
        type="button"
        class="blog-feed-card__action blog-feed-card__action--share"
        :class="{ 'blog-feed-card__action--ok': sharedOk }"
        :title="sharedOk ? t('blog.share.copied') : t('blog.share.action')"
        @click="sharePost"
      >
        <span class="blog-feed-card__glyph" aria-hidden="true">{{ sharedOk ? '✓' : '↗' }}</span>
      </button>
    </div>

    <!-- Текст: описание + «Читать полностью» -->
    <div class="blog-feed-card__body">
      <h2 class="blog-feed-card__title" role="button" tabindex="0" @click.stop="openArticle" @keydown.enter.stop="openArticle">
        <span v-if="page.is_pinned" class="blog-feed-card__pin" :title="t('blog.feedSettings.pinnedBadge')">
          <i class="fas fa-thumbtack" aria-hidden="true" />
        </span>
        {{ page.title }}
      </h2>
      <p class="blog-feed-card__summary">
        <template v-if="truncatedSummary">{{ truncatedSummary }} </template>
        <button type="button" class="blog-feed-card__read-more" @click.stop="openArticle">
          {{ t('blog.feed.readFull') }}
        </button>
      </p>
      <time v-if="formattedDate" class="blog-feed-card__date">{{ formattedDate }}</time>
    </div>

    <!-- Превью комментариев -->
    <div v-if="localPreviewComments.length" class="blog-feed-card__comments" @click.stop="openComments">
      <div v-for="comment in localPreviewComments" :key="comment.id" class="blog-feed-card__comment">
        <span class="blog-feed-card__comment-author">{{ comment.author_name }}</span>
        <span class="blog-feed-card__comment-body">{{ truncateComment(comment.body) }}</span>
      </div>
      <button
        v-if="commentsCount > localPreviewComments.length"
        type="button"
        class="blog-feed-card__more-comments"
        @click.stop="openComments"
      >
        {{ t('blog.feed.moreComments', { count: commentsCount - localPreviewComments.length }) }}
      </button>
    </div>
    <button
      v-else-if="commentsCount > 0"
      type="button"
      class="blog-feed-card__more-comments blog-feed-card__more-comments--pad"
      @click.stop="openComments"
    >
      {{ t('blog.feed.viewComments', { count: commentsCount }) }}
    </button>

    <!-- Поле комментария под описанием -->
    <form class="blog-feed-card__composer" @submit.prevent="submitFeedComment" @click.stop>
      <input
        v-model="draftComment"
        type="text"
        class="blog-feed-card__composer-input"
        :placeholder="t('blog.comments.placeholder')"
        :disabled="isCommenting"
        maxlength="2000"
        autocomplete="off"
        @focus="onComposerFocus"
      />
      <button
        type="submit"
        class="blog-feed-card__composer-send"
        :disabled="!draftComment.trim() || isCommenting"
      >
        {{ isCommenting ? t('blog.comments.sending') : t('blog.comments.send') }}
      </button>
    </form>
    <p v-if="commentError" class="blog-feed-card__composer-error" @click.stop>{{ commentError }}</p>
  </article>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import eventBus from '../../utils/eventBus';
import blogEngagementService from '../../services/blogEngagementService';
import { emptyReactionCounts } from '../../constants/blogReactions';
import BlogReactions from './BlogReactions.vue';

const props = defineProps({
  page: { type: Object, required: true },
  isAuthenticated: { type: Boolean, default: false },
  articleUrl: { type: String, required: true },
});

const emit = defineEmits(['open-article', 'open-comments']);
const { t } = useI18n();

const reactionCounts = ref({
  ...emptyReactionCounts(),
  ...(props.page.reactions || {}),
});
const myReaction = ref(null);
const viewsCount = ref(props.page.views_count || 0);
const commentsCount = ref(props.page.comments_count || 0);
const sharedOk = ref(false);
const showSubscribeForm = ref(false);
const subscribeEmail = ref('');
const subscribeMessage = ref('');
const isSubscribing = ref(false);
const draftComment = ref('');
const isCommenting = ref(false);
const commentError = ref('');
const localPreviewComments = ref([...(props.page.preview_comments || [])]);

const isDirectVideo = computed(() => props.page.cover_type === 'video');

const truncatedSummary = computed(() => {
  const text = (props.page.summary || '').trim();
  if (!text) return '';
  if (text.length <= 160) return text;
  return `${text.slice(0, 157)}…`;
});

const formattedDate = computed(() => {
  if (!props.page.created_at) return '';
  return new Date(props.page.created_at).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
});

watch(
  () => props.page?.preview_comments,
  (list) => {
    localPreviewComments.value = [...(list || [])];
  },
  { deep: true }
);

watch(
  () => [props.page?.id, props.isAuthenticated],
  async ([pageId, authed]) => {
    const p = props.page;
    if (!p) return;
    reactionCounts.value = { ...emptyReactionCounts(), ...(p.reactions || {}) };
    if (!p.reactions && p.likes_count) {
      reactionCounts.value.heart = p.likes_count;
    }
    viewsCount.value = p.views_count || 0;
    commentsCount.value = p.comments_count || 0;
    localPreviewComments.value = [...(p.preview_comments || [])];
    myReaction.value = null;
    commentError.value = '';
    if (pageId && authed) {
      try {
        const data = await blogEngagementService.getEngagement(pageId);
        myReaction.value = data.myReaction || null;
        reactionCounts.value = { ...emptyReactionCounts(), ...(data.reactions || {}) };
        viewsCount.value = data.viewsCount ?? viewsCount.value;
        commentsCount.value = data.commentsCount;
      } catch {
        /* ignore */
      }
    }
  },
  { immediate: true }
);

function truncateComment(body) {
  const text = String(body || '').trim();
  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}…`;
}

function requestLogin() {
  eventBus.emit('open-auth-sidebar');
}

function openArticle() {
  emit('open-article', props.page);
}

function openComments() {
  emit('open-comments', props.page);
}

async function handleReaction(type) {
  if (!props.isAuthenticated) {
    requestLogin();
    return;
  }
  try {
    const result = await blogEngagementService.toggleReaction(props.page.id, type);
    myReaction.value = result.myReaction || null;
    reactionCounts.value = { ...emptyReactionCounts(), ...(result.reactions || {}) };
  } catch (e) {
    console.error('[BlogFeedCard] reaction:', e);
  }
}

async function sharePost() {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: props.page.title || document.title,
        url: props.articleUrl,
      });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(props.articleUrl);
    sharedOk.value = true;
    setTimeout(() => { sharedOk.value = false; }, 1500);
  } catch (e) {
    console.warn('[BlogFeedCard] share failed', e);
  }
}

async function handleSubscribe() {
  if (!subscribeEmail.value.trim()) return;
  isSubscribing.value = true;
  subscribeMessage.value = '';
  try {
    const result = await blogEngagementService.subscribe(subscribeEmail.value.trim(), props.page.id);
    if (result.alreadyConfirmed) {
      subscribeMessage.value = t('blog.subscribe.already');
    } else {
      subscribeMessage.value = t('blog.subscribe.sent');
      subscribeEmail.value = '';
      showSubscribeForm.value = false;
    }
  } catch (e) {
    subscribeMessage.value = e?.response?.data?.error || t('blog.subscribe.error');
  } finally {
    isSubscribing.value = false;
  }
}

function onComposerFocus() {
  if (!props.isAuthenticated) {
    requestLogin();
  }
}

async function submitFeedComment() {
  if (!props.isAuthenticated) {
    requestLogin();
    return;
  }
  const body = draftComment.value.trim();
  if (!body || isCommenting.value) return;

  isCommenting.value = true;
  commentError.value = '';
  try {
    const created = await blogEngagementService.addComment(props.page.id, body);
    draftComment.value = '';
    commentsCount.value += 1;
    const previewItem = {
      id: created?.id || Date.now(),
      author_name: created?.author_name || t('blog.feed.you'),
      body: created?.body || body,
    };
    localPreviewComments.value = [previewItem, ...localPreviewComments.value].slice(0, 2);
  } catch (e) {
    console.error('[BlogFeedCard] comment:', e);
    commentError.value = e?.response?.data?.error || t('blog.comments.submitError');
  } finally {
    isCommenting.value = false;
  }
}
</script>

<style scoped>
.blog-feed-card {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  overflow: hidden;
  max-width: 560px;
  width: 100%;
  margin: 0 auto 28px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.blog-feed-card__header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.blog-feed-card__header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.blog-feed-card__header-btn {
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  border: none;
  background: rgba(0, 0, 0, 0.04);
  color: #262626;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.blog-feed-card__header-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

.blog-feed-card__header-btn--primary {
  background: var(--color-primary);
  color: #fff;
}

.blog-feed-card__header-btn--primary:hover {
  background: var(--color-primary-dark);
  color: #fff;
}

.blog-feed-card__header-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.blog-feed-card__subscribe-inline {
  display: flex;
  gap: 8px;
  flex: 1;
  min-width: 200px;
}

.blog-feed-card__subscribe-input {
  flex: 1;
  height: 32px;
  padding: 0 14px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 999px;
  font-size: 13px;
  color: #262626;
  background: #fff;
}

.blog-feed-card__subscribe-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.12);
}

.blog-feed-card__subscribe-msg {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--color-primary-dark);
  text-align: right;
}

.blog-feed-card__media {
  aspect-ratio: 16 / 9;
  background: #111;
  cursor: pointer;
  overflow: hidden;
}

.blog-feed-card__media img,
.blog-feed-card__media-video video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.35s ease;
}

.blog-feed-card__media:hover img,
.blog-feed-card__media:hover .blog-feed-card__media-video video {
  transform: scale(1.02);
}

.blog-feed-card__media-video {
  position: relative;
  width: 100%;
  height: 100%;
}

.blog-feed-card__play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.28);
  color: #fff;
  pointer-events: none;
}

.blog-feed-card__play i {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: #262626;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  padding-left: 3px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.blog-feed-card__media--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #f7f7f7 0%, #ececec 100%);
  color: #bdbdbd;
  font-size: 28px;
}

.blog-feed-card__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 10px 4px;
}

.blog-feed-card__action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #262626;
  height: 40px;
  padding: 0 10px;
  border-radius: 999px;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.blog-feed-card__action i {
  font-size: 18px;
  line-height: 1;
}

.blog-feed-card__glyph {
  font-size: 18px;
  line-height: 1;
}

.blog-feed-card__action:hover {
  background: rgba(0, 0, 0, 0.04);
}

.blog-feed-card__action:active {
  transform: scale(0.96);
}

.blog-feed-card__action--liked,
.blog-feed-card__action--liked:hover,
.blog-feed-card__action--liked i {
  color: var(--color-primary);
}

.blog-feed-card__action--static {
  cursor: default;
}

.blog-feed-card__action--static:hover {
  background: transparent;
}

.blog-feed-card__action--static:active {
  transform: none;
}

.blog-feed-card__action--share {
  margin-left: auto;
}

.blog-feed-card__action--ok {
  color: var(--color-primary);
}

.blog-feed-card__body {
  padding: 4px 16px 8px;
}

.blog-feed-card__pin {
  display: inline-flex;
  align-items: center;
  margin-right: 6px;
  color: var(--color-primary);
  font-size: 0.85em;
}

.blog-feed-card__title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 700;
  color: #262626;
  line-height: 1.35;
  cursor: pointer;
  letter-spacing: -0.01em;
}

.blog-feed-card__title:hover {
  color: var(--color-primary-dark);
}

.blog-feed-card__summary {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #262626;
}

.blog-feed-card__read-more {
  display: inline;
  border: none;
  background: none;
  color: #8e8e8e;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  margin: 0;
}

.blog-feed-card__read-more:hover {
  color: #262626;
}

.blog-feed-card__date {
  display: block;
  margin-top: 8px;
  font-size: 11px;
  color: #8e8e8e;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.blog-feed-card__comments {
  padding: 2px 16px 8px;
}

.blog-feed-card__comment {
  font-size: 13px;
  line-height: 1.4;
  margin-bottom: 4px;
  color: #262626;
}

.blog-feed-card__comment-author {
  font-weight: 700;
  margin-right: 6px;
}

.blog-feed-card__more-comments {
  border: none;
  background: none;
  padding: 0;
  margin: 0;
  color: #8e8e8e;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.blog-feed-card__more-comments--pad {
  display: block;
  padding: 0 16px 8px;
}

.blog-feed-card__more-comments:hover {
  color: #262626;
}

.blog-feed-card__composer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding: 10px 12px 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.blog-feed-card__composer-input {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 4px;
  border: none;
  background: transparent;
  font-size: 14px;
  color: #262626;
}

.blog-feed-card__composer-input::placeholder {
  color: #8e8e8e;
}

.blog-feed-card__composer-input:focus {
  outline: none;
}

.blog-feed-card__composer-input:disabled {
  opacity: 0.6;
}

.blog-feed-card__composer-send {
  flex-shrink: 0;
  height: 32px;
  padding: 0 4px;
  border: none;
  background: none;
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.blog-feed-card__composer-send:disabled {
  color: #c7e3c8;
  cursor: default;
}

.blog-feed-card__composer-send:not(:disabled):hover {
  color: var(--color-primary-dark);
}

.blog-feed-card__composer-error {
  margin: 0;
  padding: 0 16px 12px;
  font-size: 12px;
  color: var(--color-error);
}

@media (max-width: 480px) {
  .blog-feed-card__header,
  .blog-feed-card__body,
  .blog-feed-card__comments {
    padding-left: 12px;
    padding-right: 12px;
  }

  .blog-feed-card__actions {
    padding-left: 6px;
    padding-right: 6px;
  }

  .blog-feed-card__more-comments--pad {
    padding-left: 12px;
    padding-right: 12px;
  }

  .blog-feed-card__composer {
    padding-left: 10px;
    padding-right: 10px;
  }
}
</style>
