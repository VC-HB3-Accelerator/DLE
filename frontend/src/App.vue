<template>
  <div id="app">
    <header class="app-header">
      <div class="header-brand">
        <h1>DApp for Business</h1>
      </div>
      <div class="header-auth">
        <template v-if="auth.isAuthenticated">
          <span class="user-address">{{ shortAddress }}</span>
          <button class="btn btn-outline" @click="handleDisconnect">Отключить кошелек</button>
        </template>
        <template v-else>
          <button class="btn btn-primary" @click="navigateToHome">Подключиться</button>
        </template>
      </div>
    </header>
    
    <div class="app-layout">
      <!-- Сайдбар для авторизованных пользователей -->
      <aside v-if="auth.isAuthenticated" class="sidebar">
        <nav class="sidebar-nav">
          <router-link to="/" class="nav-item">
            <span class="nav-icon">🏠</span>
            <span class="nav-text">Главная</span>
          </router-link>
          <router-link v-if="auth.isAdmin" to="/dashboard" class="nav-item">
            <span class="nav-icon">📊</span>
            <span class="nav-text">Дашборд</span>
          </router-link>
          <router-link to="/kanban" class="nav-item">
            <span class="nav-icon">📋</span>
            <span class="nav-text">Канбан</span>
          </router-link>
          <router-link v-if="auth.isAdmin" to="/access-test" class="nav-item">
            <span class="nav-icon">🔐</span>
            <span class="nav-text">Смарт-контракты</span>
          </router-link>
        </nav>
      </aside>
      
      <main class="main-content">
        <div v-if="isLoading" class="loading">
          Загрузка...
        </div>
        <router-view v-else />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, provide } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';
import axios from 'axios';
import { connectWallet } from './services/wallet';

const router = useRouter();
const auth = useAuthStore();
const isLoading = ref(true);

// Вычисляемое свойство для отображения сокращенного адреса
const shortAddress = computed(() => {
  if (!auth.address) return '';
  return `${auth.address.substring(0, 6)}...${auth.address.substring(auth.address.length - 4)}`;
});

// Проверяем сессию при загрузке приложения
onMounted(async () => {
  console.log('App mounted');
  
  try {
    // Восстанавливаем состояние аутентификации из localStorage
    auth.restoreAuth();
    
    // Проверяем сессию на сервере
    const response = await axios.get('/api/auth/check');
    console.log('Проверка сессии:', response.data);
    
    // Если сессия активна, но состояние аутентификации не установлено
    if (response.data.authenticated && !auth.isAuthenticated) {
      auth.setAuth({
        address: response.data.address,
        isAdmin: response.data.isAdmin,
        authType: response.data.authType || 'wallet'
      });
    }
    
    // Если сессия не активна, но состояние аутентификации установлено
    if (!response.data.authenticated && auth.isAuthenticated) {
      auth.disconnect();
    }
  } catch (error) {
    console.error('Error checking session:', error);
    // Не отключаем пользователя при ошибке проверки сессии
  } finally {
    isLoading.value = false;
  }
});

// Функция для отключения кошелька
async function handleDisconnect() {
  await auth.disconnect();
  router.push('/');
}

// Функция для подключения кошелька
async function navigateToHome() {
  console.log('Connecting wallet...');
  
  try {
    await connectWallet((errorMessage) => {
      console.error('Ошибка при подключении кошелька:', errorMessage);
      // Можно добавить отображение ошибки пользователю
    });
  } catch (error) {
    console.error('Ошибка при подключении кошелька:', error);
    
    // Если не удалось подключить кошелек, перенаправляем на главную страницу
    console.log('Navigating to home page');
    router.push('/');
    
    // Добавляем небольшую задержку, чтобы убедиться, что компонент HomeView загрузился
    setTimeout(() => {
      // Прокручиваем страницу вниз, чтобы показать опции подключения
      const chatMessages = document.querySelector('.chat-messages');
      if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
      
      // Если опции подключения еще не отображаются, имитируем отправку сообщения
      const authOptions = document.querySelector('.auth-options');
      if (!authOptions) {
        const sendButton = document.querySelector('.send-btn');
        if (sendButton) {
          // Заполняем поле ввода
          const textarea = document.querySelector('textarea');
          if (textarea) {
            textarea.value = 'Привет';
          }
          
          // Нажимаем кнопку отправки
          sendButton.click();
        }
      }
    }, 500);
  }
}

// Предоставляем состояние аутентификации всем компонентам
provide('auth', auth);
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Roboto', 'Helvetica Neue', sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f5f5f5;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #1976d2;
  color: white;
  padding: 0.75rem 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.header-brand h1 {
  font-size: 1.5rem;
  margin: 0;
}

.header-auth {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-address {
  font-family: monospace;
  background-color: rgba(255, 255, 255, 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

.btn {
  background: none;
  border: 1px solid white;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.btn-outline {
  border: 1px solid white;
}

.btn-primary {
  background-color: white;
  color: #1976d2;
  border: none;
}

.app-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 250px;
  background-color: #fff;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.05);
  overflow-y: auto;
  z-index: 50;
}

.sidebar-nav {
  padding: 1rem 0;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1.5rem;
  color: #333;
  text-decoration: none;
  transition: background-color 0.2s;
}

.nav-item:hover {
  background-color: #f5f5f5;
}

.nav-item.router-link-active {
  background-color: #e3f2fd;
  color: #1976d2;
  border-left: 3px solid #1976d2;
}

.nav-icon {
  margin-right: 0.75rem;
  font-size: 1.2rem;
}

.main-content {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  background-color: #f5f5f5;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-size: 1.2rem;
  color: #666;
}
</style> 