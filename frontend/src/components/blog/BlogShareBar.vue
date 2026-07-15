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
      <span class="blog-share-bar__glyph" aria-hidden="true">{{ copied ? '✓' : '↗' }}</span>
      <span v-if="!compact">{{ copied ? t('blog.share.copied') : t('blog.share.action') }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

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
  border-radius: 999px;
  background: transparent;
  color: #262626;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.blog-share-bar__btn i {
  font-size: 16px;
  line-height: 1;
  width: 1em;
  text-align: center;
}

.blog-share-bar__glyph {
  font-size: 18px;
  line-height: 1;
  font-weight: 700;
}

.blog-share-bar--compact .blog-share-bar__btn {
  padding: 0;
  width: 36px;
}

.blog-share-bar__btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.blog-share-bar__btn:active {
  transform: scale(0.94);
}

.blog-share-bar__btn--ok {
  color: var(--color-primary);
}
</style>
