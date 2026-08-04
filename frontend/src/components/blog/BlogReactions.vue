<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="blog-reactions" role="group" :aria-label="t('blog.likes.action')">
    <button
      type="button"
      class="blog-reactions__btn"
      :class="{ 'blog-reactions__btn--active': isActive }"
      :title="t('blog.likes.action')"
      :aria-pressed="isActive"
      @click.stop="$emit('select', 'heart')"
    >
      <BlogGlyph name="heart" :filled="isActive" />
      <span v-if="likesCount" class="blog-reactions__count">{{ likesCount }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { emptyReactionCounts } from '../../constants/blogReactions';
import BlogGlyph from './BlogGlyph.vue';

const props = defineProps({
  counts: {
    type: Object,
    default: () => emptyReactionCounts(),
  },
  myReaction: {
    type: String,
    default: null,
  },
});

defineEmits(['select']);

const { t } = useI18n();

const isActive = computed(() => props.myReaction === 'heart');

/** Счётчик лайков: heart (+ устаревшие likes через migration в feed) */
const likesCount = computed(() => {
  const c = props.counts || {};
  return Number(c.heart || 0);
});
</script>

<style scoped>
.blog-reactions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.blog-reactions__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 8px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  color: var(--color-dark);
  font-size: var(--font-size-sm);
  font-weight: 600;
  transition: background var(--transition-fast), color var(--transition-fast);
  flex-shrink: 0;
}

.blog-reactions__btn:hover {
  background: var(--color-light);
  color: var(--color-primary);
}

.blog-reactions__btn--active {
  color: var(--color-primary);
}

.blog-reactions__count {
  font-variant-numeric: tabular-nums;
  min-width: 0.7em;
  color: inherit;
}

@media (max-width: 480px) {
  .blog-reactions__btn {
    height: 34px;
    padding: 0 4px;
    gap: 3px;
    font-size: var(--font-size-xs);
  }
}
</style>
