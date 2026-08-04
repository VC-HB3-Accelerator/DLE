<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <section v-if="pageId" ref="rootEl" class="blog-engagement">
    <div class="blog-engagement__toolbar">
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

    <div class="blog-engagement__subscribe">
      <div class="blog-engagement__subscribe-head">
        <div class="blog-engagement__subscribe-text">
          <h4 class="blog-engagement__subscribe-title">{{ t('blog.subscribe.title') }}</h4>
          <p class="blog-engagement__subscribe-hint">{{ t('blog.subscribe.hint') }}</p>
        </div>
        <button
          v-if="!isAuthenticated"
          type="button"
          class="btn btn-ghost btn-sm"
          @click="requestLogin"
        >
          {{ t('blog.feed.login') }}
        </button>
      </div>
      <form class="blog-engagement__subscribe-form" @submit.prevent="handleSubscribe">
        <input
          v-model="subscribeEmail"
          type="email"
          class="blog-engagement__subscribe-input"
          :placeholder="t('blog.subscribe.placeholder')"
          required
        />
        <label class="blog-engagement__consent">
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
        <button
          type="submit"
          class="btn btn-primary btn-sm"
          :disabled="isSubscribing || !privacyConsent"
        >
          {{ t('blog.subscribe.button') }}
        </button>
      </form>
      <p v-if="subscribeMessage" class="blog-engagement__subscribe-msg">{{ subscribeMessage }}</p>
    </div>

    <button type="button" class="btn btn-ghost btn-sm blog-engagement__ask-btn" @click="askAi">
      <BlogGlyph name="ask" />
      <span>{{ t('blog.askAi.button') }}</span>
    </button>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import eventBus from '../../utils/eventBus';
import blogEngagementService from '../../services/blogEngagementService';
import { emptyReactionCounts } from '../../constants/blogReactions';
import { getPrivacyDocsUrl } from '../../constants/publishedDocs';
import BlogShareBar from './BlogShareBar.vue';
import BlogComments from './BlogComments.vue';
import BlogReactions from './BlogReactions.vue';
import BlogGlyph from './BlogGlyph.vue';

const props = defineProps({
  pageId: { type: Number, default: null },
  pageSlug: { type: String, default: '' },
  pageTitle: { type: String, default: '' },
  isAuthenticated: { type: Boolean, default: false },
});

const router = useRouter();
const { t } = useI18n();

const engagement = ref({
  reactions: emptyReactionCounts(),
  viewsCount: 0,
  commentsCount: 0,
  myReaction: null,
  comments: [],
});
const isLoading = ref(false);
const subscribeEmail = ref('');
const subscribeMessage = ref('');
const isSubscribing = ref(false);
const privacyConsent = ref(false);
const privacyDocsUrl = getPrivacyDocsUrl();
const rootEl = ref(null);

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
      viewsCount: data.viewsCount || 0,
      commentsCount: data.commentsCount || 0,
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

function requestLogin() {
  eventBus.emit('open-auth-sidebar');
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
    const result = await blogEngagementService.subscribe(
      subscribeEmail.value.trim(),
      props.pageId,
      {
        privacyConsent: true,
        privacyConsentUrl: privacyDocsUrl,
      }
    );
    if (result.alreadyConfirmed) {
      subscribeMessage.value = t('blog.subscribe.already');
    } else {
      subscribeMessage.value = t('blog.subscribe.sent');
      subscribeEmail.value = '';
      privacyConsent.value = false;
    }
  } catch (e) {
    subscribeMessage.value = e?.response?.data?.error || t('blog.subscribe.error');
  } finally {
    isSubscribing.value = false;
  }
}

function askAi() {
  const ask = props.pageTitle
    ? t('blog.askAi.prompt', { title: props.pageTitle })
    : t('blog.askAi.promptDefault');
  router.push({
    path: '/',
    query: {
      pageId: String(props.pageId),
      ask,
    },
  });
}

function scrollToComments() {
  const el = rootEl.value?.querySelector('#blog-comments') || rootEl.value;
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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

.blog-engagement__subscribe {
  margin-top: 24px;
  padding: 16px 18px;
  background: var(--color-light);
  border: 1px solid color-mix(in srgb, var(--theme-text) 6%, transparent);
  border-radius: var(--radius-lg);
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

.blog-engagement__ask-btn {
  margin-top: 16px;
}

.blog-engagement__ask-btn:hover:not(:disabled):not(.is-disabled) {
  color: var(--color-primary-dark);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
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
