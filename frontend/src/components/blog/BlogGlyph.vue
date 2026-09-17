<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <svg
    class="blog-glyph"
    :class="[`blog-glyph--${name}`, { 'blog-glyph--filled': filled }]"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    aria-hidden="true"
    focusable="false"
  >
    <!-- Сердце: оптический масштаб, чтобы совпасть с пузырём/телефоном в одном 24×24 -->
    <g v-if="name === 'heart'" transform="translate(12 12.2) scale(1.08) translate(-12 -12.2)">
      <path
        :fill="filled ? 'currentColor' : 'none'"
        :stroke="filled ? 'none' : 'currentColor'"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
      />
    </g>
    <!-- Комментарий: скруглённый пузырь -->
    <path
      v-else-if="name === 'comment'"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
    />
    <!-- Шара: бумажный самолётик -->
    <g
      v-else-if="name === 'share'"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </g>
    <!-- Просмотры: глаз -->
    <g
      v-else-if="name === 'views'"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      transform="translate(12 12) scale(1.08) translate(-12 -12)"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </g>
    <!-- Телефон: классическая трубка -->
    <path
      v-else-if="name === 'phone'"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
    />
    <!-- Закладка: шире, тот же оптический квадрат -->
    <g v-else-if="name === 'bookmark'" transform="translate(12 12) scale(1.12) translate(-12 -12)">
      <path
        :fill="filled ? 'currentColor' : 'none'"
        :stroke="filled ? 'none' : 'currentColor'"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"
      />
    </g>
    <!-- Колокольчик подписки: заполняет тот же 24×24, что сердце/телефон -->
    <g
      v-else-if="name === 'bell'"
      :fill="filled ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </g>
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
    <!-- Ещё: три точки -->
    <g v-else-if="name === 'more'" fill="currentColor">
      <circle cx="12" cy="5.5" r="1.85" />
      <circle cx="12" cy="12" r="1.85" />
      <circle cx="12" cy="18.5" r="1.85" />
    </g>
  </svg>
</template>

<script setup>
defineProps({
  name: {
    type: String,
    required: true,
    validator: (v) => ['heart', 'comment', 'share', 'views', 'phone', 'bookmark', 'bell', 'ask', 'check', 'settings', 'filter', 'pin', 'play', 'image', 'book', 'more'].includes(v),
  },
  filled: { type: Boolean, default: false },
  /** Пиксельный размер SVG (атрибуты width/height); CSS родителя может переопределить. */
  size: { type: [Number, String], default: 24 },
});
</script>

<style scoped>
.blog-glyph {
  display: block;
  flex-shrink: 0;
  color: inherit;
  overflow: visible;
}
</style>
