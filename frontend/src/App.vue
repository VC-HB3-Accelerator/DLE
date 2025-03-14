<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { useRouter } from 'vue-router';

console.log('App.vue: Version with auth check loaded');

const authStore = useAuthStore();
const router = useRouter();

onMounted(async () => {
  console.log('App.vue: onMounted - checking auth');
  
  try {
    // Проверяем аутентификацию на сервере
    const result = await authStore.checkAuth();
    console.log('Auth check result:', result.authenticated);
    
    if (result.authenticated) {
      // Если пользователь аутентифицирован, восстанавливаем состояние
      console.log('Session restored from server');
      
      // Загружаем историю чата, если мы на странице чата
      if (router.currentRoute.value.name === 'home') {
        console.log('Loading chat history after session restore');
        // Здесь можно вызвать метод для загрузки истории чата
      }
    }
  } catch (error) {
    console.error('Error checking auth:', error);
  }
});
</script>

<style>
body {
  margin: 0;
  font-family: 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #333;
  background-color: #f5f5f5;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  padding: 1rem;
}

button {
  cursor: pointer;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: 500;
  border: none;
}

.btn-primary {
  background-color: #3498db;
  color: white;
}

.btn-secondary {
  background-color: #95a5a6;
  color: white;
}

.btn-danger {
  background-color: #e74c3c;
  color: white;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
