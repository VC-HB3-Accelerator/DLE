<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Единая карточка админ-хаба (TZ_ADMIN_UI_SHELL_CLOSE §3.2).
  Заголовок — --color-dark; CTA — btn btn-primary. Без класса .panel.
-->

<template>
  <div class="hub-card" :class="{ 'hub-card--disabled': disabled }">
    <h3 class="hub-card__title">{{ title }}</h3>
    <p class="hub-card__desc">{{ description }}</p>
    <button
      type="button"
      class="btn btn-primary hub-card__cta"
      :disabled="disabled"
      @click="onOpen"
    >
      {{ ctaLabel || t('common.details') }}
    </button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  ctaLabel: { type: String, default: '' },
  /** string path | route location | null */
  to: { type: [String, Object], default: null },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['open']);
const { t } = useI18n();
const router = useRouter();

function onOpen() {
  if (props.disabled) return;
  emit('open');
  if (props.to == null || props.to === '') return;
  router.push(props.to);
}
</script>

<style scoped>
.hub-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 200px;
  padding: var(--spacing-xl, 1.5rem);
  text-align: center;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  transition: border-color var(--transition-fast, 0.15s), box-shadow var(--transition-fast, 0.15s);
}

.hub-card:hover:not(.hub-card--disabled) {
  border-color: var(--color-primary, #4a7c59);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.hub-card--disabled {
  opacity: 0.65;
}

.hub-card__title {
  margin: 0 0 var(--spacing-sm, 0.5rem) 0;
  color: var(--color-dark);
  font-size: var(--font-size-xl, 1.25rem);
  font-weight: 600;
  line-height: 1.3;
}

.hub-card__desc {
  margin: 0 0 var(--spacing-lg, 1rem) 0;
  flex-grow: 1;
  color: var(--theme-text-muted, #666);
  font-size: var(--font-size-md, 1rem);
  line-height: 1.5;
}

.hub-card__cta {
  align-self: center;
  min-width: 120px;
  margin-top: auto;
}
</style>
