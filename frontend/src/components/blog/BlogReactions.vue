<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div class="blog-reactions" role="group" :aria-label="t('blog.reactions.title')">
    <button
      v-for="item in BLOG_REACTIONS"
      :key="item.type"
      type="button"
      class="blog-reactions__btn"
      :class="{ 'blog-reactions__btn--active': myReaction === item.type }"
      :title="t(item.labelKey)"
      :aria-pressed="myReaction === item.type"
      @click.stop="$emit('select', item.type)"
    >
      <span class="blog-reactions__emoji" aria-hidden="true">{{ item.emoji }}</span>
      <span v-if="counts[item.type]" class="blog-reactions__count">{{ counts[item.type] }}</span>
    </button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { BLOG_REACTIONS, emptyReactionCounts } from '../../constants/blogReactions';

defineProps({
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
</script>

<style scoped>
.blog-reactions {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
}

.blog-reactions__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 8px;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  color: #262626;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.15s ease, transform 0.15s ease;
}

.blog-reactions__btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.blog-reactions__btn:active {
  transform: scale(0.94);
}

.blog-reactions__btn--active {
  background: rgba(76, 175, 80, 0.12);
}

.blog-reactions__emoji {
  font-size: 18px;
  line-height: 1;
}

.blog-reactions__count {
  font-variant-numeric: tabular-nums;
  min-width: 0.7em;
}
</style>
