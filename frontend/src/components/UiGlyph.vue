<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <svg
    class="ui-glyph"
    :class="[`ui-glyph--${name}`, { 'ui-glyph--filled': filled, 'ui-glyph--spin': spin }]"
    :style="sizeStyle"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    aria-hidden="true"
    focusable="false"
  >
    <!-- Редактирование -->
    <path
      v-if="name === 'edit'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z M14.5 6.5l3 3"
    />
    <!-- Удаление -->
    <g
      v-else-if="name === 'trash'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M4.5 7h15M9 7V5.5h6V7M7 7l.75 12h8.5L17 7" />
      <path d="M10 10.5v6M14 10.5v6" />
    </g>
    <!-- Настройки / шестерёнка -->
    <path
      v-else-if="name === 'settings'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z M19.4 13.1v-2.2l-1.9-.5a6.1 6.1 0 0 0-.5-1.2l1.1-1.7-1.6-1.6-1.7 1.1a6.1 6.1 0 0 0-1.2-.5L12.9 4.6h-2.2l-.5 1.9a6.1 6.1 0 0 0-1.2.5L7.3 5.9 5.7 7.5l1.1 1.7a6.1 6.1 0 0 0-.5 1.2l-1.9.5v2.2l1.9.5c.1.4.3.8.5 1.2l-1.1 1.7 1.6 1.6 1.7-1.1c.4.2.8.4 1.2.5l.5 1.9h2.2l.5-1.9c.4-.1.8-.3 1.2-.5l1.7 1.1 1.6-1.6-1.1-1.7c.2-.4.4-.8.5-1.2l1.9-.5z"
    />
    <!-- Поиск -->
    <g
      v-else-if="name === 'search'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="11" cy="11" r="6.25" />
      <path d="m16.5 16.5 4 4" />
    </g>
    <!-- Шеврон вправо -->
    <path
      v-else-if="name === 'chevron-right'"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M9.5 6.5 14.5 12 9.5 17.5"
    />
    <!-- Шеврон вниз -->
    <path
      v-else-if="name === 'chevron-down'"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M6.5 9.5 12 14.5 17.5 9.5"
    />
    <!-- Файл / документ -->
    <g
      v-else-if="name === 'file'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M8 4.5h6l3.5 3.5V19.5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z" />
      <path d="M14 4.5V8h3.5" />
      <path d="M9 13h6M9 16h4" />
    </g>
    <!-- Плюс -->
    <path
      v-else-if="name === 'plus'"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      d="M12 6v12M6 12h12"
    />
    <!-- Стрелка влево -->
    <path
      v-else-if="name === 'arrow-left'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.85"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M19 12H7M11 7.5 5.5 12 11 16.5"
    />
    <!-- Стрелка вправо -->
    <path
      v-else-if="name === 'arrow-right'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.85"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M5 12h12M13 7.5 18.5 12 13 16.5"
    />
    <!-- Календарь -->
    <g
      v-else-if="name === 'calendar'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="4.5" y="6.5" width="15" height="13" rx="2" />
      <path d="M8 4.5v3M16 4.5v3M4.5 10.5h15" />
    </g>
    <!-- Папка -->
    <path
      v-else-if="name === 'folder'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M4.5 7.5 9 6h4l2.5 1.5H19.5V18a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4.5 18V7.5z"
    />
    <!-- Статусная точка -->
    <circle
      v-else-if="name === 'circle'"
      cx="12"
      cy="12"
      r="4"
      :fill="filled ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="1.75"
    />
    <!-- Замок -->
    <g
      v-else-if="name === 'lock'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="6.5" y="10.5" width="11" height="8" rx="2" />
      <path d="M9 10.5V8a3 3 0 0 1 6 0v2.5" />
    </g>
    <!-- Глаз -->
    <g
      v-else-if="name === 'eye'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.75" />
    </g>
    <!-- Куб -->
    <g
      v-else-if="name === 'cube'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 4.5 19.5 8.5v7L12 19.5 4.5 15.5v-7L12 4.5z" />
      <path d="M12 12 19.5 8.5M12 12V19.5M12 12 4.5 8.5" />
    </g>
    <!-- Предупреждение -->
    <g
      v-else-if="name === 'warning'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 4.5 20.5 19.5H3.5L12 4.5z" />
      <path d="M12 10v4M12 17h.01" />
    </g>
    <!-- Закрыть -->
    <path
      v-else-if="name === 'times'"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      d="M7 7l10 10M17 7 7 17"
    />
    <!-- Глобус -->
    <g
      v-else-if="name === 'globe'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="8.25" />
      <path d="M3.75 12h16.5M12 3.75a13 13 0 0 1 0 16.5M12 3.75a13 13 0 0 0 0 16.5" />
    </g>
    <!-- Пользователь -->
    <g
      v-else-if="name === 'user'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="8.5" r="3.25" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </g>
    <!-- Галочка -->
    <path
      v-else-if="name === 'check'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.85"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M5 12.5 10 17.5 19 7.5"
    />
    <!-- Инфо -->
    <g
      v-else-if="name === 'info'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 10.5v5M12 8h.01" />
    </g>
    <!-- Обновить -->
    <path
      v-else-if="name === 'sync'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M20 12a8 8 0 0 1-14.5 4.7M4 12a8 8 0 0 1 14.5-4.7M4.5 7.5V12H9M20 16.5V12h-4.5"
    />
    <!-- Внешняя ссылка -->
    <g
      v-else-if="name === 'external-link'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M14 5h5v5M10 14 19 5M19 10v5a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4h5" />
    </g>
    <!-- Щит -->
    <path
      v-else-if="name === 'shield'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M12 4.5 19 7.5v5c0 4.5-3.5 7-7 8.5-3.5-1.5-7-4-7-8.5v-5l7-3z"
    />
    <!-- Пауза -->
    <g v-else-if="name === 'pause'" fill="currentColor">
      <rect x="7.5" y="6.5" width="3.5" height="11" rx="1" />
      <rect x="13" y="6.5" width="3.5" height="11" rx="1" />
    </g>
    <!-- Воспроизведение -->
    <path
      v-else-if="name === 'play'"
      fill="currentColor"
      stroke="none"
      d="M9.5 7.2v9.6l8.5-4.8-8.5-4.8z"
    />
    <!-- Стоп -->
    <rect
      v-else-if="name === 'stop'"
      x="7"
      y="7"
      width="10"
      height="10"
      rx="1.5"
      fill="currentColor"
    />
    <!-- Повтор -->
    <path
      v-else-if="name === 'redo'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M18 12a6 6 0 0 0-10.5-3.5M6 7.5V12H10.5"
    />
    <!-- Успех -->
    <g
      v-else-if="name === 'check-circle'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="8.25" />
      <path d="M8.5 12.2 11 14.7 16 9.7" />
    </g>
    <!-- Ошибка -->
    <g
      v-else-if="name === 'times-circle'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="8.25" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </g>
    <!-- Часы -->
    <g
      v-else-if="name === 'clock'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 8v4.5l3 1.5" />
    </g>
    <!-- Кошелёк -->
    <g
      v-else-if="name === 'wallet'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M4.5 7.5h15v10.5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4.5 18V7.5z" />
      <path d="M4.5 7.5 7 4.5h10l2.5 3" />
      <path d="M15.5 13.5h3.5v2H15.5a1 1 0 0 1 0-2z" />
    </g>
    <!-- Telegram / самолётик -->
    <path
      v-else-if="name === 'telegram'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M4.5 11.5 19.5 5.5 15 19l-3.2-5.2L4.5 11.5z M11.8 13.8 19.5 5.5"
    />
    <!-- @ email -->
    <g
      v-else-if="name === 'at'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="3.25" />
      <path d="M16.5 12v1.1a2.4 2.4 0 0 0 4.8 0V12a9.3 9.3 0 1 0-3.4 7.2" />
    </g>
  </svg>
</template>

<script>
const VALID_NAMES = [
  'edit', 'trash', 'settings', 'search', 'chevron-right', 'chevron-down',
  'file', 'plus', 'arrow-left', 'arrow-right', 'calendar', 'folder', 'circle',
  'lock', 'eye', 'cube', 'warning', 'times', 'globe', 'user', 'check', 'info',
  'sync', 'external-link', 'shield', 'pause', 'play', 'stop', 'redo',
  'check-circle', 'times-circle', 'clock', 'wallet', 'telegram', 'at',
];
</script>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  name: {
    type: String,
    required: true,
    validator: (v) => VALID_NAMES.includes(v),
  },
  filled: { type: Boolean, default: false },
  spin: { type: Boolean, default: false },
  size: { type: [Number, String], default: 18 },
});

const sizeStyle = computed(() => ({
  width: typeof props.size === 'number' ? `${props.size}px` : props.size,
  height: typeof props.size === 'number' ? `${props.size}px` : props.size,
}));
</script>

<style scoped>
.ui-glyph {
  display: inline-block;
  flex-shrink: 0;
  color: inherit;
  vertical-align: -0.15em;
}

.ui-glyph--spin {
  animation: ui-glyph-spin 1s linear infinite;
}

@keyframes ui-glyph-spin {
  to { transform: rotate(360deg); }
}
</style>
