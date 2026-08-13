<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.

  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <button
    type="button"
    class="page-close-btn"
    :aria-label="label"
    :title="label"
    @click="onClose"
  >×</button>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

/**
 * Единый крестик закрытия страницы (правый верхний угол).
 * По умолчанию: явный parent (fallback). history.back — только preferBack (TZ UR1).
 * Родитель: .page-with-close { position: relative }.
 */
const props = defineProps({
  /** Маршрут-parent (строка пути или объект vue-router) */
  fallback: {
    type: [String, Object],
    default: '/',
  },
  /** Кастомный обработчик вместо fallback/back */
  onNavigate: {
    type: Function,
    default: null,
  },
  /** Opt-in: сначала history.back(), иначе fallback */
  preferBack: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close']);
const router = useRouter();
const { t } = useI18n();

const label = computed(() => t('common.close'));

function hasHistoryBack() {
  try {
    const state = window.history.state;
    if (state && state.back != null) return true;
  } catch {
    /* ignore */
  }
  return window.history.length > 1;
}

function goFallback() {
  if (props.fallback != null && props.fallback !== '') {
    router.push(props.fallback);
    return;
  }
  router.push('/');
}

function onClose() {
  emit('close');
  if (typeof props.onNavigate === 'function') {
    props.onNavigate();
    return;
  }
  if (props.preferBack && hasHistoryBack()) {
    router.back();
    return;
  }
  goFallback();
}
</script>

<style scoped>
.page-close-btn {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm, 4px);
  background: transparent;
  box-shadow: none;
  color: var(--theme-text, #444);
  font-size: 1.5rem;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
  transition: color var(--transition-fast, 0.15s ease), background var(--transition-fast, 0.15s ease);
}

.page-close-btn:hover {
  color: var(--theme-text, #222);
  background: color-mix(in srgb, var(--color-border, #e5e7eb) 60%, transparent);
}

.page-close-btn:focus-visible {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 2px;
}
</style>
