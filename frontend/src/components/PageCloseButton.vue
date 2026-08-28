<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.

  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<script setup>
/**
 * Регистрация закрытия страницы для крестика в Header (рядом с бургером).
 * UI не рендерит — кнопка живёт в Header.vue.
 * По умолчанию: явный parent (fallback). history.back — только preferBack (TZ UR1).
 */
import { watch, onBeforeUnmount } from 'vue';
import { usePageClose } from '@/composables/usePageClose';

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
const { registerPageClose } = usePageClose();

let unregister = null;

function syncRegistration() {
  if (unregister) {
    unregister();
    unregister = null;
  }
  unregister = registerPageClose({
    fallback: props.fallback,
    onNavigate: typeof props.onNavigate === 'function' ? props.onNavigate : null,
    preferBack: props.preferBack,
    onClose: () => emit('close'),
  });
}

watch(
  () => [props.fallback, props.onNavigate, props.preferBack],
  () => {
    syncRegistration();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (unregister) {
    unregister();
    unregister = null;
  }
});
</script>

<template>
  <!-- Крестик перенесён в Header рядом с бургером -->
</template>
