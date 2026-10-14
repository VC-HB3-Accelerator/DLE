<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  Иконки панели TipTap. name — ключ из набора ниже.
-->
<template>
  <svg
    class="rte-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'bold'">
      <path d="M6 4h8a4 4 0 0 1 0 8H6z" />
      <path d="M6 12h9a4 4 0 0 1 0 8H6z" />
    </template>
    <template v-else-if="name === 'italic'">
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </template>
    <template v-else-if="name === 'underline'">
      <path d="M6 4v7a6 6 0 0 0 12 0V4" />
      <line x1="4" y1="20" x2="20" y2="20" />
    </template>
    <template v-else-if="name === 'strike'">
      <path d="M16 8a4 4 0 0 0-8 1c0 2 2 3 8 4s8 2 8 4a4 4 0 0 1-7 3" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </template>
    <template v-else-if="name === 'h2'">
      <path d="M4 5v14" />
      <path d="M12 5v14" />
      <path d="M4 12h8" />
      <path d="M17 10h4l-4 8h4" />
    </template>
    <template v-else-if="name === 'h3'">
      <path d="M4 5v14" />
      <path d="M12 5v14" />
      <path d="M4 12h8" />
      <path d="M17 10h3.5a1.5 1.5 0 0 1 0 3H18" />
      <path d="M17.5 13H20a1.5 1.5 0 0 1 0 3h-3" />
    </template>
    <template v-else-if="name === 'ul'">
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <circle cx="5" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'ol'">
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 5h2v4" />
      <path d="M4 15h3" />
      <path d="M6.5 15v4H4" />
    </template>
    <template v-else-if="name === 'quote'">
      <path d="M7 17h3l2-4V7H6v6h3z" />
      <path d="M14 17h3l2-4V7h-6v6h3z" />
    </template>
    <template v-else-if="name === 'alignLeft'">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="14" y2="12" />
      <line x1="4" y1="18" x2="18" y2="18" />
    </template>
    <template v-else-if="name === 'alignCenter'">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </template>
    <template v-else-if="name === 'alignRight'">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="6" y1="18" x2="20" y2="18" />
    </template>
    <template v-else-if="name === 'link'">
      <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 5" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07L13 19" />
    </template>
    <template v-else-if="name === 'image'">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 16l-5-5-8 8" />
    </template>
    <template v-else-if="name === 'video'">
      <rect x="3" y="6" width="14" height="12" rx="2" />
      <path d="M17 10l4-2v8l-4-2z" />
    </template>
    <template v-else-if="name === 'clear'">
      <path d="M5 7h14" />
      <path d="M9 7V5h6v2" />
      <path d="M8 7l1 12h6l1-12" />
    </template>
  </svg>
</template>

<script setup>
defineProps({
  name: { type: String, required: true },
});
</script>

<style scoped>
.rte-icon {
  display: block;
  width: 18px;
  height: 18px;
}
</style>
