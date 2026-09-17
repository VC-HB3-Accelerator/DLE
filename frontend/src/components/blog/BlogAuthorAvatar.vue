<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <span
    v-if="label"
    class="blog-author-avatar"
    :class="[
      `blog-author-avatar--d${digitCount}`,
      `blog-author-avatar--${tone}`,
      `blog-author-avatar--${size}`,
    ]"
    :style="tone === 'color' ? { backgroundColor: color } : undefined"
    :title="fullLabel"
    :aria-label="fullLabel"
  >{{ label }}</span>
</template>

<script setup>
import { computed } from 'vue';
import {
  blogAuthorLabel,
  blogAuthorAvatarColor,
  blogAuthorIdFromName,
} from '../../utils/blogAuthorLabel';

const props = defineProps({
  userId: { type: [Number, String], default: null },
  name: { type: String, default: '' },
  /** color — цветной кружок в комментариях; overlay — белый контур на фото */
  tone: { type: String, default: 'color' },
  size: { type: String, default: 'md' },
});

const resolvedId = computed(() => {
  const id = Number(props.userId);
  if (Number.isInteger(id) && id > 0) return id;
  return blogAuthorIdFromName(props.name);
});

const label = computed(() => (resolvedId.value ? String(resolvedId.value) : ''));
const fullLabel = computed(() => blogAuthorLabel(resolvedId.value));
const color = computed(() => blogAuthorAvatarColor(resolvedId.value));
const digitCount = computed(() => Math.min(Math.max(label.value.length, 1), 6));
</script>

<style scoped>
.blog-author-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  letter-spacing: -0.03em;
  user-select: none;
  box-sizing: border-box;
}

.blog-author-avatar--md {
  width: 36px;
  height: 36px;
  font-size: 13px;
}

.blog-author-avatar--sm {
  width: 24px;
  height: 24px;
  font-size: 10px;
}

.blog-author-avatar--sm.blog-author-avatar--d3 {
  font-size: 8px;
}

.blog-author-avatar--sm.blog-author-avatar--d4,
.blog-author-avatar--sm.blog-author-avatar--d5,
.blog-author-avatar--sm.blog-author-avatar--d6 {
  font-size: 7px;
}

.blog-author-avatar--d3 {
  font-size: 11px;
}

.blog-author-avatar--d4 {
  font-size: 9px;
}

.blog-author-avatar--d5,
.blog-author-avatar--d6 {
  font-size: 8px;
}

.blog-author-avatar--color {
  color: #fff;
}

.blog-author-avatar--overlay {
  background: transparent;
  color: #fff;
  border: 2px solid #fff;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55));
  pointer-events: none;
}
</style>
