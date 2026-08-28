<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Внутренний chrome админ-страницы (TZ §3.1).
  Крестик закрытия — в Header рядом с бургером (usePageClose).
-->

<template>
  <div
    class="admin-page-shell page-with-close"
    :class="{
      'admin-page-shell--panel': variant === 'panel',
    }"
  >
    <PageCloseButton
      v-if="showClose"
      :fallback="resolvedFallback"
      :prefer-back="preferBack"
      :on-navigate="onNavigate"
    />
    <h2 v-if="title" class="admin-page-shell__title">{{ title }}</h2>
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import PageCloseButton from '@/components/PageCloseButton.vue';

const props = defineProps({
  title: { type: String, default: '' },
  /** 'plain' | 'panel' */
  variant: { type: String, default: 'plain' },
  showClose: { type: Boolean, default: true },
  fallback: { type: [String, Object], default: null },
  preferBack: { type: Boolean, default: false },
  onNavigate: { type: Function, default: null },
});

const route = useRoute();

const resolvedFallback = computed(() => {
  if (props.fallback != null && props.fallback !== '') return props.fallback;
  const meta = route.meta?.closeFallback ?? route.meta?.permissionFallback;
  if (meta == null || meta === '') return '/';
  if (typeof meta === 'string' && !meta.startsWith('/')) {
    return { name: meta };
  }
  return meta;
});
</script>

<style scoped>
.admin-page-shell {
  position: relative;
  width: 100%;
  max-width: 100%;
  padding: var(--spacing-lg, 1rem);
  background: transparent;
  box-sizing: border-box;
}

.admin-page-shell--panel {
  background: var(--color-white, #fff);
  border: 1px solid transparent;
  border-radius: var(--block-radius, 8px);
  box-shadow: none;
}

.admin-page-shell__title {
  margin: 0 0 var(--spacing-lg, 1rem) 0;
  color: var(--color-dark);
  font-size: var(--font-size-xl, 1.25rem);
  font-weight: 600;
}
</style>
