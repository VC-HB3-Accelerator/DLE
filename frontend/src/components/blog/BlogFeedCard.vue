<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <article ref="cardEl" class="blog-feed-card">
    <!-- Медиа + id автора поверх -->
    <div
      class="blog-feed-card__media-wrap"
      :class="{ 'blog-feed-card__media-wrap--subscribe': showSubscribeForm }"
    >
      <div
        v-if="listingMedia && (listingMedia.photos?.length || listingMedia.video)"
        class="blog-feed-card__media blog-feed-card__media--carousel"
      >
        <ListingMediaCarousel :media="listingMedia" :alt="page.title" />
      </div>
      <div v-else-if="page.cover_url" class="blog-feed-card__media" @click.stop="openArticle">
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
      <BlogMediaRail
        :compact="!listingMedia"
        collapse-overflow
        like-in-more
        show-subscribe
        :subscribe-active="showSubscribeForm"
        :counts="reactionCounts"
        :my-reaction="myReaction"
        :comments-count="commentsCount"
        :views-count="viewsCount"
        :page-id="page.id"
        :page-slug="page.slug || ''"
        :owner-user-id="page.owner_user_id"
        :is-authenticated="isAuthed"
        :article-url="articleUrl"
        :page-title="page.title || ''"
        @select="handleReaction"
        @comments="openComments"
        @subscribe="showSubscribeForm = true"
      />
    </div>

    <!-- Форма подписки под медиа, над заголовком -->
    <div v-if="showSubscribeForm" class="blog-feed-card__subscribe-panel" @click.stop>
      <BlogSubscribeForm
        :filters="subscribeFilters"
        :source-page-id="page.id"
        :is-authenticated="isAuthed"
        @done="onSubscribeDone"
        @auth-changed="onSubscribeAuth"
      />
      <button
        type="button"
        class="btn btn-outline btn-sm blog-feed-card__subscribe-cancel"
        @click="showSubscribeForm = false"
      >
        {{ t('common.cancel') }}
      </button>
    </div>

    <!-- Текст: клик по названию открывает объявление -->
    <div class="blog-feed-card__body">
      <h2 class="blog-feed-card__title">
        <span v-if="page.is_pinned" class="blog-feed-card__pin" :title="t('blog.feedSettings.pinnedBadge')">
          <BlogGlyph name="pin" aria-hidden="true" />
        </span>
        <a
          class="blog-feed-card__title-link"
          :href="articleUrl"
          @click.prevent.stop="openArticle"
        >{{ page.title }}</a>
      </h2>
      <div v-if="catalogTags.length" class="blog-feed-card__tags" @click.stop>
        <span v-for="(tag, idx) in catalogTags" :key="`${idx}-${tag}`" class="blog-feed-card__tag">{{ tag }}</span>
      </div>
      <p v-if="truncatedSummary" class="blog-feed-card__summary">{{ truncatedSummary }}</p>
      <time v-if="formattedDate" class="blog-feed-card__date">{{ formattedDate }}</time>
    </div>

    <!-- Превью комментариев -->
    <div v-if="localPreviewComments.length" class="blog-feed-card__comments" @click.stop="openComments">
      <div v-for="comment in localPreviewComments" :key="comment.id" class="blog-feed-card__comment">
        <BlogAuthorAvatar
          size="sm"
          :user-id="comment.user_id"
          :name="comment.author_name"
        />
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
  </article>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import eventBus from '../../utils/eventBus';
import blogEngagementService from '../../services/blogEngagementService';
import { emptyReactionCounts } from '../../constants/blogReactions';
import { isAuthenticated as authIsAuthenticated } from '../../composables/useAuth';
import { useNotifications } from '../../composables/useNotifications';
import BlogGlyph from './BlogGlyph.vue';
import BlogAuthorAvatar from './BlogAuthorAvatar.vue';
import ListingMediaCarousel from './ListingMediaCarousel.vue';
import BlogSubscribeForm from './BlogSubscribeForm.vue';
import BlogMediaRail from './BlogMediaRail.vue';

const props = defineProps({
  page: { type: Object, required: true },
  isAuthenticated: { type: Boolean, default: false },
  articleUrl: { type: String, required: true },
  subscribeFilters: { type: Object, default: () => ({ section: null, attrs: {} }) },
});

const emit = defineEmits(['open-article', 'open-comments', 'auth-changed']);
const { t } = useI18n();
const { showErrorMessage } = useNotifications();

const reactionCounts = ref({
  ...emptyReactionCounts(),
  ...(props.page.reactions || {}),
});
const myReaction = ref(null);
const viewsCount = ref(props.page.views_count || 0);
const commentsCount = ref(props.page.comments_count || 0);
const showSubscribeForm = ref(false);
const localPreviewComments = ref([...(props.page.preview_comments || [])]);
const cardEl = ref(null);
let viewObserver = null;

const isAuthed = computed(() => Boolean(authIsAuthenticated.value));

const isDirectVideo = computed(() => props.page.cover_type === 'video');

const listingMedia = computed(() => {
  const lm = props.page?.listing_media;
  if (!lm || typeof lm !== 'object') return null;
  const photos = Array.isArray(lm.photos) ? lm.photos.filter(Boolean) : [];
  const video = lm.video || null;
  if (!photos.length && !video) return null;
  return { photos, video };
});

const catalogTags = computed(() => {
  const tags = props.page?.catalog_tags;
  if (!Array.isArray(tags)) return [];
  return tags.map((t) => String(t || '').trim()).filter(Boolean);
});

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

function applyEngagement(data) {
  if (!data) return;
  myReaction.value = data.myReaction || null;
  if (data.reactions) {
    reactionCounts.value = { ...emptyReactionCounts(), ...data.reactions };
  }
  if (data.viewsCount != null) viewsCount.value = data.viewsCount;
  if (data.commentsCount != null) commentsCount.value = data.commentsCount;
}

async function syncEngagement() {
  const pageId = props.page?.id;
  if (!pageId) return;
  try {
    applyEngagement(await blogEngagementService.getEngagement(pageId));
  } catch {
    /* ignore */
  }
}

async function recordCardView() {
  const pageId = props.page?.id;
  if (!pageId) return;
  try {
    const result = await blogEngagementService.recordView(pageId);
    if (result?.viewsCount != null) viewsCount.value = result.viewsCount;
  } catch {
    /* ignore */
  }
}

watch(
  () => [props.page?.id, isAuthed.value],
  async () => {
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
    await syncEngagement();
  },
  { immediate: true }
);

onMounted(() => {
  const el = cardEl.value;
  if (!el || typeof IntersectionObserver === 'undefined') {
    recordCardView();
    return;
  }
  viewObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    recordCardView();
    viewObserver?.disconnect();
    viewObserver = null;
  }, { threshold: 0.45 });
  viewObserver.observe(el);
});

onBeforeUnmount(() => {
  viewObserver?.disconnect();
  viewObserver = null;
});

function truncateComment(body) {
  const text = String(body || '').trim();
  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}…`;
}

function requestLogin() {
  showErrorMessage(t('blog.comments.loginHint'));
  eventBus.emit('open-auth-sidebar');
}

function openArticle() {
  emit('open-article', props.page);
}

function openComments() {
  emit('open-comments', props.page);
}

async function handleReaction(type) {
  if (!isAuthed.value) {
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

function onSubscribeDone() {
  setTimeout(() => { showSubscribeForm.value = false; }, 1800);
}

function onSubscribeAuth(result) {
  emit('auth-changed', result);
}
</script>

<style scoped>
.blog-feed-card {
  --feed-text-pad: 0px;
  background: transparent;
  border: none;
  border-radius: 0;
  overflow: visible;
  max-width: 560px;
  width: 100%;
  min-width: 0;
  margin: 0 auto 28px;
  box-shadow: none;
  box-sizing: border-box;
}

.blog-feed-card__subscribe-panel {
  margin: 0 0 1.25rem;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  background: var(--color-light);
  border: 1px solid color-mix(in srgb, var(--theme-text) 6%, transparent);
  border-radius: var(--radius-lg);
  box-sizing: border-box;
}

.blog-feed-card__subscribe-cancel {
  align-self: flex-start;
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

.blog-feed-card__media-wrap {
  position: relative;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  border-radius: 14px;
  overflow: hidden;
}

.blog-feed-card__media-wrap--subscribe {
  margin-bottom: 1.5rem;
}

.blog-feed-card__media {
  aspect-ratio: 16 / 9;
  background: var(--color-black);
  cursor: pointer;
  overflow: hidden;
}

/* Карусель объявления: кадр 4:3 как у ListingMediaCarousel — иначе 16:9 режет SE-водяной знак */
.blog-feed-card__media--carousel {
  aspect-ratio: 4 / 3;
}

.blog-feed-card__media--carousel :deep(.listing-carousel),
.blog-feed-card__media--carousel :deep(.listing-carousel__viewport) {
  height: 100%;
  aspect-ratio: auto;
}

.blog-feed-card__media--carousel :deep(.listing-carousel__media) {
  object-position: center bottom;
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
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md) var(--spacing-xs);
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.blog-feed-card__subscribe-btn {
  flex-shrink: 0;
  white-space: nowrap;
}

.blog-feed-card__body {
  padding: 16px var(--feed-text-pad) 8px;
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
  line-height: 1.35;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.blog-feed-card__title-link {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 0.15em;
  cursor: pointer;
}

.blog-feed-card__title-link:hover {
  color: var(--color-primary-dark, var(--color-primary));
}

.blog-feed-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 10px;
}

.blog-feed-card__tag {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-text) 6%, transparent);
  color: var(--theme-text-muted, var(--color-grey));
  font-size: 12px;
  line-height: 1.3;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.blog-feed-card__summary {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--theme-text);
  overflow-wrap: anywhere;
  word-break: break-word;
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
  padding: 2px var(--feed-text-pad) 8px;
}

.blog-feed-card__comment {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.4;
  margin-bottom: 8px;
  color: var(--theme-text);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.blog-feed-card__comment-body {
  min-width: 0;
  padding-top: 3px;
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
  padding: 0 var(--feed-text-pad) 8px;
}

.blog-feed-card__more-comments:hover {
  color: var(--theme-text);
}

@media (max-width: 768px) {
  .blog-feed-card__media,
  .blog-feed-card__media--carousel {
    width: 100%;
    aspect-ratio: 4 / 3;
  }

  .blog-feed-card__media-wrap--subscribe {
    margin-bottom: 1rem;
  }
}

@media (max-width: 480px) {
  .blog-feed-card {
    margin-bottom: 20px;
  }

  .blog-feed-card__media-wrap {
    border-radius: 10px;
  }

  .blog-feed-card__media,
  .blog-feed-card__media--carousel {
    width: 100%;
    aspect-ratio: 4 / 3;
  }

  .blog-feed-card__body,
  .blog-feed-card__comments {
    padding-left: var(--feed-text-pad);
    padding-right: var(--feed-text-pad);
  }

  .blog-feed-card__actions {
    padding-left: 12px;
    padding-right: 12px;
    display: flex !important;
    justify-content: flex-end;
    flex-wrap: nowrap;
  }

  /* «Войти»+«Подписаться» вместе не влезают ~≤390px; вход — через композер/меню */
  .blog-feed-card__login {
    display: none !important;
  }

  .blog-feed-card__subscribe-btn {
    flex-shrink: 0;
    height: 32px;
    min-height: 32px;
    padding: 0 10px;
    font-size: var(--font-size-xs);
  }

  .blog-feed-card__subscribe-panel {
    margin-bottom: 1.25rem;
    padding: 16px 18px;
  }

  .blog-feed-card__subscribe-input {
    min-width: 0;
    width: 100%;
  }

  .blog-feed-card__more-comments--pad {
    padding-left: var(--feed-text-pad);
    padding-right: var(--feed-text-pad);
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
    display: flex !important;
    justify-content: flex-end;
  }
}
</style>
