<template>
  <div id="app">
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner" />
    </div>

    <RouterView />
  </div>
</template>

<script setup>
  import { ref, watch } from 'vue';
  import { RouterView } from 'vue-router';
  import { useAuth } from './composables/useAuth';
  import './assets/styles/home.css';

  // Состояние загрузки
  const isLoading = ref(false);

  // Использование composable для аутентификации
  const auth = useAuth();

  // Мониторинг изменений состояния аутентификации
  watch(auth.isAuthenticated, (newValue, oldValue) => {
    if (newValue !== oldValue) {
      console.log('[App] Состояние аутентификации изменилось:', newValue);
    }
  });
</script>

<style>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 5px solid var(--color-grey-light);
  border-top: 5px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
