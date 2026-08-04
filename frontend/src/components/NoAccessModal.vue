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
  <div v-if="show" class="modal-backdrop">
    <div class="modal-window">
      <div v-if="title" class="modal-title">{{ title }}</div>
      <div class="modal-body">
        <slot>{{ message }}</slot>
      </div>
      <div class="modal-actions">
        <slot name="actions">
          <button class="btn btn-primary" @click="$emit('close')">{{ t('common.ok') }}</button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps({
  show: Boolean,
  title: { type: String, default: '' },
  message: { type: String, default: '' }
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  z-index: 1000;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(31, 41, 55, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-window {
  background: var(--color-white);
  border-radius: var(--block-radius);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-border);
  padding: var(--block-padding) var(--spacing-xl) var(--spacing-lg);
  min-width: 320px;
  max-width: calc(100% - 2rem);
  text-align: center;
  box-sizing: border-box;
}
.modal-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  margin-bottom: var(--spacing-md);
  color: var(--color-dark);
}
.modal-body {
  margin-bottom: var(--spacing-lg);
  color: var(--color-text);
}
.modal-actions {
  display: flex;
  justify-content: center;
  gap: var(--button-gap);
}


/* TZ package G/SC */
@media (max-width: 768px) {
  .page, .panel, .view, .container, .modal, [class*="container"], [class*="panel"], [class*="wrapper"], [class*="form"] {
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