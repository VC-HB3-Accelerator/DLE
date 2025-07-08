<template>
  <Header :is-sidebar-open="showSidebar" @toggle-sidebar="toggleSidebar" />
  <Sidebar
    v-model="showSidebar"
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    :telegram-auth="telegramAuth"
    :email-auth="emailAuth"
  />
  <div class="webssh-settings-block">
    <button class="close-btn" @click="goBack">×</button>
    <h2>WEB SSH: интеграция и настройки</h2>
    <p class="desc">Автоматическая публикация приложения через SSH-туннель и NGINX.</p>
    <WebSshForm />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import WebSshForm from '@/components/WebSshForm.vue';
import Header from '@/components/Header.vue';
import Sidebar from '@/components/Sidebar.vue';
import { useAuthContext } from '@/composables/useAuth';

const router = useRouter();
const goBack = () => router.push('/settings/interface');
const showSidebar = ref(false);
const toggleSidebar = () => {
  showSidebar.value = !showSidebar.value;
};

const auth = useAuthContext();
const isAuthenticated = auth.isAuthenticated.value;
const identities = auth.identities?.value || [];
const tokenBalances = auth.tokenBalances?.value || [];
const isLoadingTokens = false;

// Дефолтные объекты для Sidebar
const telegramAuth = {
  showVerification: false,
  botLink: '',
  verificationCode: '',
  error: ''
};
const emailAuth = {
  showForm: false,
  showVerification: false
};
</script>

<style scoped>
.webssh-settings-block {
  background: #fff;
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-top: 20px;
  margin-bottom: 20px;
  width: 100%;
  position: relative;
  overflow-x: auto;
}
.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #333;
}
h2 {
  margin-bottom: 0.5rem;
}
.desc {
  color: #666;
  margin-bottom: 1.5rem;
}
</style> 