<template>
  <div class="dashboard-view">
    <h1>Дашборд</h1>
    <p>Добро пожаловать в панель управления!</p>

    <!-- Добавьте проверку на администратора -->
    <div v-if="isAdmin">
      <h2>Административные функции</h2>
      <AccessTokenManager />
      <RoleManager />
      <AccessControl />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import AccessTokenManager from '../components/AccessTokenManager.vue';
import RoleManager from '../components/RoleManager.vue';
import AccessControl from '../components/AccessControl.vue';

const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isAdmin);

console.log('Статус администратора:', isAdmin.value); // Для отладки
</script>
