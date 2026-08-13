<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Сетка карточек админ-хаба: 3 → 2 → 1 колонки.
-->

<template>
  <div class="hub-grid">
    <slot />
  </div>
</template>

<style scoped>
.hub-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-xl, 1.5rem);
  width: 100%;
}

@media (max-width: 1024px) {
  .hub-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .hub-grid {
    grid-template-columns: 1fr;
  }
}
</style>
