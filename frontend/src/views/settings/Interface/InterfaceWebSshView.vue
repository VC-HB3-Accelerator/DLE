<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
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
  <div class="webssh-settings-block page-with-close">
    <PageCloseButton fallback="/settings/interface" />
    <h2>{{ $t('settings.interface.vds.setupTitle') }}</h2>
    <WebSshForm />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, onMounted } from 'vue';
import WebSshForm from '@/components/WebSshForm.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
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

.page-with-close {
  position: relative;
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

/* TZ package S */
.webssh-settings-block {
  max-width: 100%;
  box-sizing: border-box;
}
</style> 