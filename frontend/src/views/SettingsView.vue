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
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="settings-view-container">
      <div v-if="route.name === 'settings-blockchain-dle-deploy' || route.name === 'settings-dle-v2-deploy'" class="page-header">
        <button 
          class="close-btn" 
          @click="router.push('/settings')"
        >×</button>
      </div>
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

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[SettingsView] Clearing settings data');
    // Очищаем данные при выходе из системы
    // SettingsView не нуждается в очистке данных
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[SettingsView] Refreshing settings data');
    // SettingsView не нуждается в обновлении данных
  });
});

// Вычисляемый заголовок страницы в зависимости от роута
const pageTitle = computed(() => {
  if (route.name === 'settings-blockchain-dle-deploy') {
    return 'Создать новое DLE (Digital Legal Entity)';
  }
  if (route.name === 'settings-dle-v2-deploy') {
    return 'Деплой контракта DLE (Digital Legal Entity)';
  }
  if (route.name === 'settings-security') {
    return ''; // Убираем заголовок для страницы безопасности, так как он есть внутри компонента
  }
  return 'Настройки';
});

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
  margin-bottom: 20px; /* Уменьшаем отступ, так как он уже есть в BaseLayout */
  min-height: auto; /* Убираем фиксированную высоту */
}

/* Заголовки */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

h1 {
  color: var(--color-dark);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
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