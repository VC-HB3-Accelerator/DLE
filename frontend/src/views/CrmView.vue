<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="crm-view-container">
      <h1>CRM Система</h1>
      <div v-if="isLoading">Загрузка данных пользователя...</div>
      <div v-else-if="!auth.isAuthenticated.value">
        <p>Для доступа к CRM необходимо <button @click="goToHomeAndShowSidebar">войти</button>.</p>
      </div>
      <div v-else>
        <p>Добро пожаловать в CRM!</p>
        <div v-if="auth.isAdmin.value">
          <p><strong>У вас полный доступ (Администратор).</strong></p>
          <!-- Сюда будет добавляться полный функционал CRM -->
          <p>Здесь будет управление контактами, сделками, задачами и т.д.</p>
        </div>
        <div v-else>
          <p><strong>У вас ограниченный доступ.</strong></p>
          <!-- Сюда будет добавляться ограниченный функционал CRM -->
          <p>Здесь будет просмотр ваших контактов и задач.</p>
        </div>
         <!-- Демонстрационный блок -->
         <div class="demo-block">
            <h3>Демонстрация CRM</h3>
            <p>Этот раздел будет содержать компоненты CRM...</p>
         </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineProps, defineEmits } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useRouter } from 'vue-router';
import { setToStorage } from '../utils/storage';
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

const auth = useAuth();
const router = useRouter();
const isLoading = ref(true);

// Функция для перехода на домашнюю страницу и открытия боковой панели
const goToHomeAndShowSidebar = () => {
  setToStorage('showWalletSidebar', true);
  router.push({ name: 'home' });
};

// Обработчик события изменения авторизации
const handleAuthEvent = (eventData) => {
  console.log('[CrmView] Получено событие изменения авторизации:', eventData);
  // Можно обновить данные или состояние, если нужно
  isLoading.value = false;
};

// Регистрация и очистка обработчика событий
let unsubscribe = null;

onMounted(() => {
  console.log('[CrmView] Компонент загружен');
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
.crm-view-container {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  margin-bottom: 20px;
}

h1 {
  color: var(--color-dark);
  margin-bottom: 20px;
}

p {
  line-height: 1.6;
  margin-bottom: 10px;
}

strong {
 color: var(--color-primary);
}

.demo-block {
    margin-top: 30px;
    padding: 20px;
    border: 1px dashed var(--color-grey);
    border-radius: var(--radius-md);
}

button {
  padding: 5px 10px;
  background-color: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  margin-left: 5px;
}
button:hover {
  opacity: 0.9;
}
</style> 