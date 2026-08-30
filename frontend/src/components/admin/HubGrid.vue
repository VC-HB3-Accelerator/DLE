<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Сетка карточек админ-хаба: 3 → 2 → 1 колонки.
-->

<template>
  <div class="hub-grid" :class="{ 'hub-grid--compact': compact }">
    <slot />
  </div>
</template>

<script setup>
defineProps({
  compact: { type: Boolean, default: false },
});
</script>

<style scoped>
.hub-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-xl, 1.5rem);
  width: 100%;
}

.hub-grid--compact {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

@media (max-width: 1024px) {
  .hub-grid:not(.hub-grid--compact) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .hub-grid:not(.hub-grid--compact) {
    grid-template-columns: 1fr;
  }
}
</style>
