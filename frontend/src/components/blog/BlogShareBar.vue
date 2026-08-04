<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <div :class="['blog-share-bar', { 'blog-share-bar--compact': compact }]">
    <span v-if="!compact" class="blog-share-bar__label">{{ t('blog.share.title') }}</span>
    <button
      type="button"
      class="blog-share-bar__btn"
      :class="{ 'blog-share-bar__btn--ok': copied }"
      :title="copied ? t('blog.share.copied') : t('blog.share.action')"
      @click.stop="share"
    >
      <BlogGlyph :name="copied ? 'check' : 'share'" />
      <span v-if="!compact">{{ copied ? t('blog.share.copied') : t('blog.share.action') }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BlogGlyph from './BlogGlyph.vue';

const props = defineProps({
  url: { type: String, required: true },
  title: { type: String, default: '' },
  compact: { type: Boolean, default: false },
});

const { t } = useI18n();
const copied = ref(false);

const canNativeShare = computed(() => typeof navigator !== 'undefined' && !!navigator.share);

async function share() {
  if (canNativeShare.value) {
    try {
      await navigator.share({
        title: props.title || document.title,
        url: props.url,
      });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.warn('[BlogShareBar] native share failed:', e);
    }
  }

  try {
    await navigator.clipboard.writeText(props.url);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch (e) {
    console.warn('[BlogShareBar] copy failed:', e);
  }
}
</script>

<style scoped>
.blog-share-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}

.blog-share-bar--compact {
  padding: 0;
}

.blog-share-bar__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-grey);
}

.blog-share-bar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 36px;
  height: 36px;
  padding: 0 10px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-dark);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.blog-share-bar--compact .blog-share-bar__btn {
  padding: 0;
  width: 36px;
}

.blog-share-bar__btn:hover {
  background: var(--color-light);
  color: var(--color-primary);
}

.blog-share-bar__btn--ok {
  color: var(--color-primary);
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
