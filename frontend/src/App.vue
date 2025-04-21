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
  const { isAuthenticated } = useAuth();

  watch(isAuthenticated, (newValue, oldValue) => {
    if (newValue !== oldValue) {
      console.log('Состояние аутентификации изменилось:', newValue);
    }
  });
</script>
