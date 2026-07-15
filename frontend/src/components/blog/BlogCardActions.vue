<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="blog-card-actions" @click.stop>
    <button type="button" class="blog-card-actions__btn" :title="t('blog.likes.action')" @click="emit('like')">
      <span class="blog-card-actions__icon" aria-hidden="true">♥</span>
      <span>{{ likesCount }}</span>
    </button>
    <button type="button" class="blog-card-actions__btn" :title="t('blog.comments.action')" @click="emit('comment')">
      <span class="blog-card-actions__icon" aria-hidden="true">💬</span>
      <span>{{ commentsCount }}</span>
    </button>
    <button type="button" class="blog-card-actions__btn" :title="t('blog.share.copy')" @click="copyLink">
      <span class="blog-card-actions__icon" aria-hidden="true">{{ copied ? '✓' : '↗' }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  url: { type: String, required: true },
});

const emit = defineEmits(['like', 'comment']);
const { t } = useI18n();
const copied = ref(false);

async function copyLink() {
  try {
    await navigator.clipboard.writeText(props.url);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch (e) {
    console.warn('[BlogCardActions] copy failed', e);
  }
}
</script>

<style scoped>
.blog-card-actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.blog-card-actions__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: var(--color-text, #495057);
  cursor: pointer;
  font-size: 0.9rem;
  border-radius: 6px;
  transition: color 0.2s ease, background 0.2s ease;
}

.blog-card-actions__btn:hover {
  color: var(--color-primary);
  background: var(--color-light, #f8f9fa);
}

.blog-card-actions__icon {
  font-size: 1.05rem;
  line-height: 1;
}
</style>
