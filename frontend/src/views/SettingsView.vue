<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="settings-view-container">
      <h1>Настройки</h1>
      <!-- Router view для отображения дочерних компонентов настроек -->
      <router-view></router-view>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, computed, defineProps, defineEmits } from 'vue';
import { useAuthContext } from '../composables/useAuth';
import { useRouter, useRoute } from 'vue-router';
import { getFromStorage, setToStorage } from '../utils/storage';
import BaseLayout from '../components/BaseLayout.vue';
import eventBus from '../utils/eventBus';

// Определяем props
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

const auth = useAuthContext();
const router = useRouter();
const route = useRoute();
const isLoading = ref(true);

// Обработчик события изменения авторизации
const handleAuthEvent = (eventData) => {
  console.log('[SettingsView] Получено событие изменения авторизации:', eventData);
  isLoading.value = false;
};

const goToHomeAndShowSidebar = () => {
  router.push({ name: 'home' });
};

// Регистрация и очистка обработчика событий
let unsubscribe = null;

onMounted(() => {
  console.log('[SettingsView] Компонент загружен');
  isLoading.value = false;
  
  // Подписка на события авторизации
  unsubscribe = eventBus.on('auth-state-changed', handleAuthEvent);
});

onBeforeUnmount(() => {
  // Отписка от события при удалении компонента
  if (unsubscribe) {
    unsubscribe();
  }
});
</script>

<style scoped>
/* Основной контейнер */
.settings-view-container {
  padding: var(--block-padding);
  background-color: var(--color-white);
  border-radius: var(--block-radius);
  box-shadow: var(--shadow-md);
  margin-top: 20px;
  margin-bottom: 20px;
}

/* Заголовки */
h1 {
  color: var(--color-dark);
  margin-bottom: var(--spacing-lg);
}

h3 {
  color: var(--color-primary);
  margin-bottom: var(--spacing-md);
}

/* Общие элементы */
p {
  line-height: 1.6;
  margin-bottom: var(--spacing-sm);
}

strong {
 color: var(--color-primary);
}

/* Стили для кнопки "войти" */
.settings-view-container > div > p > button {
  background-color: var(--color-accent);
  color: var(--color-white);
  border: none;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  margin-left: var(--spacing-xs);
}

.settings-view-container > div > p > button:hover {
  background-color: var(--color-accent-dark);
}

/* Новые стили для кнопок навигации */
/* Удалено: .settings-navigation-buttons, .buttons-grid, .buttons-grid .btn */

/* Анимации */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Адаптивный дизайн */
@media (max-width: 768px) {
  .settings-navigation-buttons {
    grid-template-columns: 1fr;
  }
  
  .buttons-grid {
    grid-column: 1;
    grid-row: auto;
  }
}
</style> 