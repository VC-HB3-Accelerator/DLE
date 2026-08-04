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
 * Навигация: шаг назад по истории; если истории нет — fallback (или /).
 *
 * Родитель должен иметь position: relative (класс .page-with-close).
 */
const props = defineProps({
  /** Маршрут, если нет history.back (строка пути или объект vue-router) */
  fallback: {
    type: [String, Object],
    default: '/',
  },
  /** Кастомный обработчик вместо back/fallback */
  onNavigate: {
    type: Function,
    default: null,
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
  // Запасной признак: в сессии уже есть куда вернуться
  return window.history.length > 1;
}

function onClose() {
  emit('close');
  if (typeof props.onNavigate === 'function') {
    props.onNavigate();
    return;
  }
  if (hasHistoryBack()) {
    router.back();
    return;
  }
  if (props.fallback != null && props.fallback !== '') {
    router.push(props.fallback);
    return;
  }
  router.push('/');
}
</script>

<style scoped>
.page-close-btn {
  position: absolute;
  top: var(--spacing-md, 12px);
  right: var(--spacing-md, 12px);
  z-index: 5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  height: auto;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 2px 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--theme-text-muted, #888);
  font-size: 1.5rem;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
  transition: color var(--transition-fast, 0.15s ease);
}

.page-close-btn:hover {
  color: var(--theme-text, #222);
  background: transparent;
}

.page-close-btn:focus-visible {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 2px;
}
</style>
