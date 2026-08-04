<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="blog-card-actions" @click.stop>
    <button type="button" class="blog-card-actions__btn" :title="t('blog.likes.action')" @click="emit('like')">
      <BlogGlyph name="heart" />
      <span>{{ likesCount }}</span>
    </button>
    <button type="button" class="blog-card-actions__btn" :title="t('blog.comments.action')" @click="emit('comment')">
      <BlogGlyph name="comment" />
      <span>{{ commentsCount }}</span>
    </button>
    <button type="button" class="blog-card-actions__btn" :title="t('blog.share.copy')" @click="copyLink">
      <BlogGlyph :name="copied ? 'check' : 'share'" />
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BlogGlyph from './BlogGlyph.vue';

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
  gap: var(--spacing-sm);
}

.blog-card-actions__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: var(--font-size-sm);
  border-radius: var(--radius-md);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.blog-card-actions__btn:hover {
  color: var(--color-primary);
  background: var(--color-light);
}
</style>
