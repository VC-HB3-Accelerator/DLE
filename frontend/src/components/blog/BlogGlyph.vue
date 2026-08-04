<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <svg
    class="blog-glyph"
    :class="[`blog-glyph--${name}`, { 'blog-glyph--filled': filled }]"
    viewBox="0 0 24 24"
    width="22"
    height="22"
    aria-hidden="true"
    focusable="false"
  >
    <!-- Сердце (лайк) -->
    <path
      v-if="name === 'heart'"
      :fill="filled ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M12 20.5s-7.2-4.35-7.2-9.2A4.05 4.05 0 0 1 12 7.85 4.05 4.05 0 0 1 19.2 11.3c0 4.85-7.2 9.2-7.2 9.2z"
    />
    <!-- Комментарий -->
    <path
      v-else-if="name === 'comment'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M7.5 18.5 4.5 21V8.5A3 3 0 0 1 7.5 5.5h9A3 3 0 0 1 19.5 8.5v7a3 3 0 0 1-3 3h-9z"
    />
    <!-- Самолётик как в Telegram (filled paper plane) -->
    <path
      v-else-if="name === 'share'"
      fill="currentColor"
      d="M3.2 20.55 20.9 12.7c.75-.33.75-1.4 0-1.73L3.2 3.12c-.8-.35-1.6.45-1.25 1.25L4.6 10.8l9.55 1.05L4.6 12.9l-2.65 6.43c-.35.8.45 1.6 1.25 1.22z"
    />
    <!-- Просмотры -->
    <g
      v-else-if="name === 'views'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.75" />
    </g>
    <!-- Ask AI — без emoji -->
    <g
      v-else-if="name === 'ask'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="8.25" />
      <path d="M9.5 9.8a2.6 2.6 0 0 1 5 1c0 1.6-2.5 1.8-2.5 3.2" />
      <circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
    </g>
    <!-- Галочка после копирования -->
    <path
      v-else-if="name === 'check'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.85"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M5 12.5 10 17.5 19 7.5"
    />
    <!-- Шестерёнка (настройки) -->
    <path
      v-else-if="name === 'settings'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z M19.4 13.1v-2.2l-1.9-.5a6.1 6.1 0 0 0-.5-1.2l1.1-1.7-1.6-1.6-1.7 1.1a6.1 6.1 0 0 0-1.2-.5L12.9 4.6h-2.2l-.5 1.9a6.1 6.1 0 0 0-1.2.5L7.3 5.9 5.7 7.5l1.1 1.7a6.1 6.1 0 0 0-.5 1.2l-1.9.5v2.2l1.9.5c.1.4.3.8.5 1.2l-1.1 1.7 1.6 1.6 1.7-1.1c.4.2.8.4 1.2.5l.5 1.9h2.2l.5-1.9c.4-.1.8-.3 1.2-.5l1.7 1.1 1.6-1.6-1.1-1.7c.2-.4.4-.8.5-1.2l1.9-.5z"
    />
    <!-- Фильтр -->
    <path
      v-else-if="name === 'filter'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M4 5.5h16l-6 7v5.5l-4-2V12.5L4 5.5z"
    />
    <!-- Булавка (закреплено) -->
    <g
      v-else-if="name === 'pin'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M14.5 3.5 9 9v3.5l-1.5 1.5V16h7v-2l-1.5-1.5V9l-5.5-5.5z" />
      <path d="M9.5 17h5" />
    </g>
    <!-- Воспроизведение -->
    <path
      v-else-if="name === 'play'"
      fill="currentColor"
      stroke="none"
      d="M9.5 7.2v9.6l8.5-4.8-8.5-4.8z"
    />
    <!-- Изображение / обложка -->
    <g
      v-else-if="name === 'image'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <circle cx="8.75" cy="10.25" r="1.5" />
      <path d="M3.5 16.5 9 11.5l3.5 3 4.5-4.5L20.5 14V18.5H3.5v-2z" />
    </g>
    <!-- Книга (пустое состояние) -->
    <g
      v-else-if="name === 'book'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 5.5c-2.5-1.5-5.5-1-7.5 1v11c2-.75 4.5-.75 7.5 1 3-1.75 5.5-1.75 7.5-1V6.5c-2-2-5-2.5-7.5-1z" />
      <path d="M12 5.5v13" />
    </g>
  </svg>
</template>

<script setup>
defineProps({
  name: {
    type: String,
    required: true,
    validator: (v) => ['heart', 'comment', 'share', 'views', 'ask', 'check', 'settings', 'filter', 'pin', 'play', 'image', 'book'].includes(v),
  },
  filled: { type: Boolean, default: false },
});
</script>

<style scoped>
.blog-glyph {
  display: block;
  flex-shrink: 0;
  color: inherit;
}
</style>
