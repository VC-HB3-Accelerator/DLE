<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div id="blog-comments" class="blog-comments">
    <h3 class="blog-comments__title">
      {{ t('blog.comments.title', { count: commentsCount }) }}
    </h3>

    <div v-if="isLoading" class="blog-comments__loading">
      {{ t('blog.comments.loading') }}
    </div>

    <div v-else-if="comments.length === 0" class="blog-comments__empty">
      {{ t('blog.comments.empty') }}
    </div>

    <ul v-else class="blog-comments__list">
      <li v-for="comment in comments" :key="comment.id" class="blog-comments__item">
        <div class="blog-comments__row">
          <div class="blog-comments__avatar" aria-hidden="true">
            {{ initials(comment.author_name) }}
          </div>
          <div class="blog-comments__content">
            <div class="blog-comments__bubble">
              <span class="blog-comments__author">{{ comment.author_name }}</span>
              <span class="blog-comments__body">{{ comment.body }}</span>
            </div>
            <div class="blog-comments__meta">
              <time class="blog-comments__date">{{ formatDate(comment.created_at) }}</time>
              <button
                type="button"
                class="blog-comments__reply-btn"
                @click="onReplyClick(comment.id)"
              >
                {{ t('blog.comments.reply') }}
              </button>
            </div>

            <ul v-if="comment.replies?.length" class="blog-comments__replies">
              <li v-for="reply in comment.replies" :key="reply.id" class="blog-comments__row">
                <div class="blog-comments__avatar blog-comments__avatar--sm" aria-hidden="true">
                  {{ initials(reply.author_name) }}
                </div>
                <div class="blog-comments__content">
                  <div class="blog-comments__bubble">
                    <span class="blog-comments__author">{{ reply.author_name }}</span>
                    <span class="blog-comments__body">{{ reply.body }}</span>
                  </div>
                  <div class="blog-comments__meta">
                    <time class="blog-comments__date">{{ formatDate(reply.created_at) }}</time>
                  </div>
                </div>
              </li>
            </ul>

            <div v-if="isAuthenticated && replyingTo === comment.id" class="blog-comments__reply-form">
              <textarea
                :id="`reply-${comment.id}`"
                v-model="replyText"
                class="blog-comments__textarea"
                rows="2"
                :placeholder="t('blog.comments.replyPlaceholder')"
              />
              <div class="blog-comments__form-actions">
                <button
                  type="button"
                  class="blog-comments__btn blog-comments__btn--primary"
                  :disabled="!replyText.trim() || isSubmitting"
                  @click="submitReply(comment.id)"
                >
                  {{ t('blog.comments.send') }}
                </button>
                <button type="button" class="blog-comments__btn" @click="cancelReply">
                  {{ t('common.cancel') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <div class="blog-comments__composer">
      <template v-if="isAuthenticated">
        <textarea
          id="blog-comment-new"
          v-model="newComment"
          class="blog-comments__textarea"
          rows="3"
          :placeholder="t('blog.comments.placeholder')"
          :disabled="isSubmitting"
        />
        <div class="blog-comments__form-actions">
          <button
            type="button"
            class="blog-comments__btn blog-comments__btn--primary"
            :disabled="!newComment.trim() || isSubmitting"
            @click="submitComment"
          >
            {{ isSubmitting ? t('blog.comments.sending') : t('blog.comments.send') }}
          </button>
        </div>
      </template>

      <div v-else class="blog-comments__gate">
        <p class="blog-comments__gate-text">{{ t('blog.comments.loginHint') }}</p>
        <button
          type="button"
          class="blog-comments__btn blog-comments__btn--primary"
          @click="requestAuth"
        >
          {{ t('blog.comments.loginToComment') }}
        </button>
      </div>
    </div>

    <p v-if="errorMessage" class="blog-comments__error" role="alert">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import eventBus from '../../utils/eventBus';
import blogEngagementService from '../../services/blogEngagementService';

const props = defineProps({
  pageId: { type: Number, required: true },
  isAuthenticated: { type: Boolean, default: false },
  comments: { type: Array, default: () => [] },
  commentsCount: { type: Number, default: 0 },
  isLoading: { type: Boolean, default: false },
});

const emit = defineEmits(['refresh']);

const { t } = useI18n();
const newComment = ref('');
const replyText = ref('');
const replyingTo = ref(null);
const isSubmitting = ref(false);
const errorMessage = ref('');

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function requestAuth() {
  eventBus.emit('open-auth-sidebar');
}

function onReplyClick(commentId) {
  if (!props.isAuthenticated) {
    requestAuth();
    return;
  }
  startReply(commentId);
}

function startReply(commentId) {
  replyingTo.value = commentId;
  replyText.value = '';
  errorMessage.value = '';
}

function cancelReply() {
  replyingTo.value = null;
  replyText.value = '';
}

async function submitComment() {
  if (!props.isAuthenticated) {
    requestAuth();
    return;
  }
  if (!newComment.value.trim() || isSubmitting.value) return;

  isSubmitting.value = true;
  errorMessage.value = '';
  try {
    await blogEngagementService.addComment(props.pageId, newComment.value.trim());
    newComment.value = '';
    emit('refresh');
  } catch (e) {
    console.error('[BlogComments] submit:', e);
    errorMessage.value = e?.response?.data?.error || t('blog.comments.submitError');
  } finally {
    isSubmitting.value = false;
  }
}

async function submitReply(parentId) {
  if (!props.isAuthenticated) {
    requestAuth();
    return;
  }
  if (!replyText.value.trim() || isSubmitting.value) return;

  isSubmitting.value = true;
  errorMessage.value = '';
  try {
    await blogEngagementService.addComment(props.pageId, replyText.value.trim(), parentId);
    cancelReply();
    emit('refresh');
  } catch (e) {
    console.error('[BlogComments] reply:', e);
    errorMessage.value = e?.response?.data?.error || t('blog.comments.submitError');
  } finally {
    isSubmitting.value = false;
  }
}

watch(() => props.isAuthenticated, (val) => {
  if (!val) {
    cancelReply();
    newComment.value = '';
    errorMessage.value = '';
  }
});
</script>

<style scoped>
.blog-comments {
  margin-top: 4px;
}

.blog-comments__title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 700;
  color: #262626;
  letter-spacing: -0.01em;
}

.blog-comments__loading,
.blog-comments__empty {
  color: #8e8e8e;
  font-size: 14px;
  margin-bottom: 16px;
}

.blog-comments__list {
  list-style: none;
  margin: 0 0 18px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.blog-comments__item {
  margin: 0;
  padding: 0;
  border: none;
}

.blog-comments__row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.blog-comments__avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #e8f5e9, #c8e6c9);
  color: var(--color-primary-dark);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.blog-comments__avatar--sm {
  width: 28px;
  height: 28px;
  font-size: 10px;
}

.blog-comments__content {
  flex: 1;
  min-width: 0;
}

.blog-comments__bubble {
  display: block;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 14px;
  line-height: 1.45;
  word-break: break-word;
}

.blog-comments__author {
  font-weight: 700;
  font-size: 13px;
  color: #262626;
  margin-right: 6px;
}

.blog-comments__body {
  font-size: 14px;
  color: #262626;
  white-space: pre-wrap;
}

.blog-comments__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
  padding-left: 4px;
}

.blog-comments__date {
  font-size: 12px;
  color: #8e8e8e;
}

.blog-comments__reply-btn {
  border: none;
  background: none;
  color: #8e8e8e;
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
  padding: 0;
}

.blog-comments__reply-btn:hover {
  color: #262626;
}

.blog-comments__replies {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.blog-comments__reply-form {
  margin-top: 10px;
}

.blog-comments__composer {
  margin-top: 4px;
  padding: 14px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  background: #fff;
}

.blog-comments__textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.45;
  resize: vertical;
  margin-bottom: 10px;
  color: #262626;
  background: #fafafa;
}

.blog-comments__textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.12);
}

.blog-comments__textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.blog-comments__form-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.blog-comments__btn {
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #262626;
  transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}

.blog-comments__btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.blog-comments__btn--primary {
  background: var(--color-primary);
  color: #fff;
}

.blog-comments__btn--primary:hover {
  background: var(--color-primary-dark);
  color: #fff;
}

.blog-comments__btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.blog-comments__gate {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.blog-comments__gate-text {
  margin: 0;
  color: #8e8e8e;
  font-size: 14px;
  line-height: 1.45;
}

.blog-comments__error {
  margin: 12px 0 0;
  color: var(--color-error);
  font-size: 13px;
}
</style>
