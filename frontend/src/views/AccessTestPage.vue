<template>
  <div class="container mt-4">
    <h2>Тестирование доступа</h2>
    <div class="row">
      <div class="col-md-6">
        <AccessTest />
      </div>
      <div class="col-md-6" v-if="isAdmin">
        <AccessTokenManager />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import AccessTest from '../components/AccessTest.vue';
import AccessTokenManager from '../components/AccessTokenManager.vue';

const auth = useAuthStore();
const isAdmin = computed(() => auth.isAdmin);

// Отладочная информация
onMounted(() => {
  console.log('Auth store в AccessTestPage:', {
    isAuthenticated: auth.isAuthenticated,
    address: auth.address,
    isAdmin: auth.isAdmin
  });
});
</script> 