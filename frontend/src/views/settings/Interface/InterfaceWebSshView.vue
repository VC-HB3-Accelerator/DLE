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
  <Header :is-sidebar-open="showSidebar" @toggle-sidebar="toggleSidebar" />
  <Sidebar
    v-model="showSidebar"
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
  />
  <div class="webssh-settings-block">
    <button class="close-btn" @click="goBack">×</button>
    <h2>Настройка VDS Сервер</h2>
    <WebSshForm />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import WebSshForm from '@/components/WebSshForm.vue';
import Header from '@/components/Header.vue';
import Sidebar from '@/components/Sidebar.vue';
import { useAuthContext } from '@/composables/useAuth';

// Определяем пропсы, которые мы принимаем
defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Array,
  isLoadingTokens: Boolean,
  formattedLastUpdate: String
});

// Определяем события, которые мы эмитим
defineEmits(['authActionCompleted']);

const router = useRouter();
const goBack = () => router.push('/settings/interface');
const showSidebar = ref(false);
const toggleSidebar = () => {
  showSidebar.value = !showSidebar.value;
};

const auth = useAuthContext();
const isAuthenticated = auth.isAuthenticated.value;
const identities = auth.identities?.value || [];

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[InterfaceWebSshView] Clearing WebSSH data');
    // Очищаем данные при выходе из системы
    // InterfaceWebSshView не нуждается в очистке данных
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[InterfaceWebSshView] Refreshing WebSSH data');
    // InterfaceWebSshView не нуждается в обновлении данных
  });
});
const tokenBalances = auth.tokenBalances?.value || [];
const isLoadingTokens = false;
</script>

<style scoped>
.webssh-settings-block {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  margin: 2rem auto;
  max-width: 1000px;
  position: relative;
  overflow-x: auto;
}

.close-btn {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0.5rem;
  border-radius: 50%;
  transition: all 0.2s;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

h2 {
  margin: 0 0 0.5rem 0;
  color: var(--color-primary);
  font-size: 2rem;
  font-weight: 700;
  padding-right: 3rem;
}

.desc {
  color: #666;
  margin-bottom: 2rem;
  font-size: 1.1rem;
  line-height: 1.5;
}

/* Адаптивность */
@media (max-width: 768px) {
  .webssh-settings-block {
    margin: 1rem;
    padding: 1.5rem;
  }
  
  h2 {
    font-size: 1.5rem;
    padding-right: 2.5rem;
  }
  
  .desc {
    font-size: 1rem;
  }
}
</style> 