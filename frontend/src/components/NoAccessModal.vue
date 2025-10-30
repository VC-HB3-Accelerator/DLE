<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
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
          <button class="modal-ok-btn" @click="$emit('close')">OK</button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup>
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
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-window {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.18);
  padding: 2rem 2.5rem 1.5rem 2.5rem;
  min-width: 320px;
  text-align: center;
}
.modal-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 1rem;
}
.modal-body {
  margin-bottom: 1.5rem;
  color: #444;
}
.modal-actions {
  display: flex;
  justify-content: center;
  gap: 18px;
}
.modal-ok-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 2rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.modal-ok-btn:hover {
  background: var(--color-primary-dark);
}
</style> 