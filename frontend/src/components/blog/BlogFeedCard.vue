<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <article class="blog-feed-card">
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
          <BlogGlyph name="play" />
        </span>
      </div>
    </div>
    <div v-else class="blog-feed-card__media blog-feed-card__media--placeholder" @click.stop="openArticle">
      <BlogGlyph name="image" aria-hidden="true" />
    </div>

    <!-- Действия: слева лайк…просмотры, справа подписка -->
    <div class="blog-feed-card__actions" @click.stop>
      <div class="blog-feed-card__actions-left">
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
          <BlogGlyph name="comment" />
          <span>{{ commentsCount }}</span>
        </button>
        <button
          type="button"
          class="blog-feed-card__action blog-feed-card__action--share"
          :class="{ 'blog-feed-card__action--ok': sharedOk }"
          :title="sharedOk ? t('blog.share.copied') : t('blog.share.action')"
          @click="sharePost"
        >
          <BlogGlyph :name="sharedOk ? 'check' : 'share'" />
        </button>
        <span class="blog-feed-card__action blog-feed-card__action--static" :title="t('blog.views.label')">
          <BlogGlyph name="views" />
          <span>{{ viewsCount || 0 }}</span>
        </span>
      </div>
      <div class="blog-feed-card__actions-right">
        <button
          v-if="!isAuthenticated"
          type="button"
          class="btn btn-outline btn-sm blog-feed-card__login"
          @click.stop="requestLogin"
        >
          {{ t('blog.feed.login') }}
        </button>
        <button
          v-if="!showSubscribeForm"
          type="button"
          class="btn btn-primary btn-sm blog-feed-card__subscribe-btn"
          @click.stop="showSubscribeForm = true"
        >
          {{ t('blog.subscribe.button') }}
        </button>
      </div>
    </div>

    <!-- Форма подписки под строкой кнопок, над заголовком -->
    <div v-if="showSubscribeForm || subscribeMessage" class="blog-feed-card__subscribe-panel" @click.stop>
      <form v-if="showSubscribeForm" class="blog-feed-card__subscribe-inline" @submit.prevent="handleSubscribe">
        <div class="blog-feed-card__subscribe-row">
          <input
            v-model="subscribeEmail"
            type="email"
            class="blog-feed-card__subscribe-input"
            :placeholder="t('blog.subscribe.placeholder')"
            required
          />
          <button
            type="submit"
            class="btn btn-primary btn-sm"
            :disabled="isSubscribing || !privacyConsent"
          >
            OK
          </button>
          <button
            type="button"
            class="btn btn-outline btn-sm"
            @click="showSubscribeForm = false"
          >
            {{ t('common.cancel') }}
          </button>
        </div>
        <label class="blog-feed-card__consent">
          <input v-model="privacyConsent" type="checkbox" required />
          <span>
            {{ t('blog.subscribe.consentPrefix') }}
            <a
              :href="privacyDocsUrl"
              target="_blank"
              rel="noopener noreferrer"
              @click.stop
            >{{ t('blog.subscribe.consentLink') }}</a>
          </span>
        </label>
      </form>
      <p v-if="subscribeMessage" class="blog-feed-card__subscribe-msg">{{ subscribeMessage }}</p>
    </div>

    <!-- Текст: описание + «Читать полностью» -->
    <div class="blog-feed-card__body">
      <h2 class="blog-feed-card__title" role="button" tabindex="0" @click.stop="openArticle" @keydown.enter.stop="openArticle">
        <span v-if="page.is_pinned" class="blog-feed-card__pin" :title="t('blog.feedSettings.pinnedBadge')">
          <BlogGlyph name="pin" aria-hidden="true" />
        </span>
        {{ page.title }}
      </h2>
      <p class="blog-feed-card__summary">
        <span v-if="truncatedSummary" class="blog-feed-card__summary-text">{{ truncatedSummary }}</span>
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
import { getPrivacyDocsUrl } from '../../constants/publishedDocs';
import BlogReactions from './BlogReactions.vue';
import BlogGlyph from './BlogGlyph.vue';

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
const privacyConsent = ref(false);
const privacyDocsUrl = getPrivacyDocsUrl();
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
  if (!privacyConsent.value) {
    subscribeMessage.value = t('blog.subscribe.consentRequired');
    return;
  }
  isSubscribing.value = true;
  subscribeMessage.value = '';
  try {
    const result = await blogEngagementService.subscribe(subscribeEmail.value.trim(), props.page.id, {
      privacyConsent: true,
      privacyConsentUrl: privacyDocsUrl,
    });
    if (result.alreadyConfirmed) {
      subscribeMessage.value = t('blog.subscribe.already');
    } else {
      subscribeMessage.value = t('blog.subscribe.sent');
      subscribeEmail.value = '';
      privacyConsent.value = false;
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
  background: var(--color-white);
  border: 1px solid color-mix(in srgb, var(--theme-text) 8%, transparent);
  border-radius: 14px;
  overflow: hidden;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin: 0 0 28px;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--theme-text) 4%, transparent);
  box-sizing: border-box;
}

.blog-feed-card__subscribe-panel {
  padding: 0 var(--spacing-md) var(--spacing-sm);
}

.blog-feed-card__subscribe-inline {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
}

.blog-feed-card__subscribe-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
}

.blog-feed-card__consent {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  font-size: var(--font-size-xs);
  line-height: 1.35;
  color: var(--color-text-light);
  cursor: pointer;
}

.blog-feed-card__consent input {
  margin-top: 1px;
  flex-shrink: 0;
}

.blog-feed-card__consent a {
  color: var(--color-primary);
  text-decoration: underline;
}

.blog-feed-card__subscribe-input {
  flex: 1;
  min-width: 140px;
  height: 32px;
  padding: 0 var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-dark);
  background: var(--color-white);
}

.blog-feed-card__subscribe-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.blog-feed-card__subscribe-msg {
  margin: var(--spacing-xs) 0 0;
  font-size: var(--font-size-xs);
  color: var(--color-primary-dark);
}

.blog-feed-card__media {
  aspect-ratio: 16 / 9;
  background: var(--color-black);
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
  background: color-mix(in srgb, var(--color-black) 28%, transparent);
  color: var(--color-white);
  pointer-events: none;
}

.blog-feed-card__play :deep(.blog-glyph) {
  width: 18px;
  height: 18px;
  padding: 17px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-white) 92%, transparent);
  color: var(--theme-text);
  box-sizing: content-box;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--color-black) 20%, transparent);
}

.blog-feed-card__media--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, var(--color-light) 0%, var(--theme-border) 100%);
  color: var(--theme-text-muted);
}

.blog-feed-card__media--placeholder :deep(.blog-glyph) {
  width: 28px;
  height: 28px;
  opacity: 0.55;
}

.blog-feed-card__actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 6px;
  padding: var(--spacing-sm) var(--spacing-md) var(--spacing-xs);
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.blog-feed-card__actions-left,
.blog-feed-card__actions-right {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 2px;
  min-width: 0;
}

.blog-feed-card__actions-left {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.blog-feed-card__actions-left::-webkit-scrollbar {
  display: none;
}

.blog-feed-card__actions-right {
  gap: var(--spacing-xs);
  flex-shrink: 0;
  justify-self: end;
}

.blog-feed-card__subscribe-btn {
  flex-shrink: 0;
  white-space: nowrap;
}

.blog-feed-card__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-dark);
  height: 40px;
  padding: 0 var(--spacing-sm);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.blog-feed-card__action:hover {
  background: var(--color-light);
  color: var(--color-primary);
}

.blog-feed-card__action--static {
  cursor: default;
  color: var(--color-text-light);
  font-weight: 500;
}

.blog-feed-card__action--static:hover {
  background: transparent;
  color: var(--color-text-light);
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
}

.blog-feed-card__pin :deep(.blog-glyph) {
  width: 14px;
  height: 14px;
}

.blog-feed-card__title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--theme-text);
  line-height: 1.35;
  cursor: pointer;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.blog-feed-card__title:hover {
  color: var(--color-primary-dark);
}

.blog-feed-card__summary {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--theme-text);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.blog-feed-card__read-more {
  display: inline;
  border: none;
  background: none;
  color: var(--theme-text-muted);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  margin: 0;
}

/* после margin: 0 — иначе отступ перетрётся при смене порядка правил */
.blog-feed-card__summary-text + .blog-feed-card__read-more {
  margin-left: 0.4em;
}

.blog-feed-card__read-more:hover {
  color: var(--theme-text);
}

.blog-feed-card__date {
  display: block;
  margin-top: 8px;
  font-size: 11px;
  color: var(--theme-text-muted);
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
  color: var(--theme-text);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.blog-feed-card__comment-author {
  font-weight: 700;
  margin-right: 6px;
  overflow-wrap: anywhere;
}

.blog-feed-card__more-comments {
  border: none;
  background: none;
  padding: 0;
  margin: 0;
  color: var(--theme-text-muted);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.blog-feed-card__more-comments--pad {
  display: block;
  padding: 0 16px 8px;
}

.blog-feed-card__more-comments:hover {
  color: var(--theme-text);
}

.blog-feed-card__composer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding: 10px 12px 12px;
  border-top: 1px solid color-mix(in srgb, var(--theme-text) 6%, transparent);
}

.blog-feed-card__composer-input {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 4px;
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--theme-text);
}

.blog-feed-card__composer-input::placeholder {
  color: var(--theme-text-muted);
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
  color: color-mix(in srgb, var(--color-primary) 35%, var(--color-white));
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
  .blog-feed-card {
    margin-bottom: 20px;
    border-radius: 12px;
  }

  .blog-feed-card__body,
  .blog-feed-card__comments {
    padding-left: 12px;
    padding-right: 12px;
  }

  .blog-feed-card__actions {
    padding-left: 4px;
    padding-right: 8px;
    column-gap: 4px;
    /* защитить от TZ .actions { flex-wrap } и широких grid-селекторов */
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    flex-wrap: nowrap;
  }

  .blog-feed-card__action {
    height: 34px;
    padding: 0 3px;
    gap: 3px;
    font-size: var(--font-size-xs);
  }

  /* «Войти»+«Подписаться» вместе не влезают ~≤390px; вход — через композер/меню */
  .blog-feed-card__login {
    display: none !important;
  }

  .blog-feed-card__actions-right {
    max-width: none;
  }

  .blog-feed-card__actions-right :deep(.btn),
  .blog-feed-card__subscribe-btn {
    flex-shrink: 0;
    height: 32px;
    min-height: 32px;
    padding: 0 10px;
    font-size: var(--font-size-xs);
  }

  .blog-feed-card__subscribe-panel {
    padding-left: 12px;
    padding-right: 12px;
  }

  .blog-feed-card__subscribe-input {
    min-width: 0;
    width: 100%;
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


/* TZ package D — не трогать grid строки действий карточки */
@media (max-width: 768px) {
  .page, .panel, .view, .container, [class*="container"], [class*="panel"], [class*="wrapper"], [class*="list"], [class*="content"] {
    max-width: 100%;
    box-sizing: border-box;
  }
  .form-row, .row, .toolbar, .header-row, .filters {
    flex-wrap: wrap;
  }
  [class*="grid"]:not(.blog-feed-card__actions), .form-row {
    grid-template-columns: 1fr !important;
  }

  .blog-feed-card__actions {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
  }
}
</style>
