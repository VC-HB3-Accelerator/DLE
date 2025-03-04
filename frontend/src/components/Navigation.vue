<template>
  <nav class="main-nav">
    <div class="nav-brand">
      <router-link to="/">DApp for Business</router-link>
    </div>

    <div class="nav-links">
      <router-link to="/" class="nav-link">Главная</router-link>
      <router-link to="/chat" class="nav-link">Чат</router-link>
      <router-link v-if="authStore.isAdmin" to="/admin" class="nav-link admin-link">
        Админ-панель
      </router-link>
    </div>

    <div class="nav-auth">
      <template v-if="authStore.isAuthenticated">
        <div class="user-info">
          <span class="user-address">{{ formatAddress(authStore.address) }}</span>
          <span v-if="authStore.isAdmin" class="admin-badge">Админ</span>
        </div>
        <button @click="logout" class="btn-logout">Выйти</button>
      </template>
      <template v-else>
        <wallet-connection />
      </template>
    </div>
  </nav>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import WalletConnection from './WalletConnection.vue';

const router = useRouter();
const authStore = useAuthStore();

// Форматирование адреса кошелька
function formatAddress(address) {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
}

// Выход из системы
async function logout() {
  await authStore.logout();
  router.push('/');
}
</script>

<style scoped>
.main-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.nav-brand a {
  font-size: 1.25rem;
  font-weight: 700;
  color: #3498db;
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: 1rem;
}

.nav-link {
  color: #333;
  text-decoration: none;
  padding: 0.5rem;
  border-radius: 4px;
}

.nav-link:hover {
  background-color: #f0f0f0;
}

.nav-link.router-link-active {
  color: #3498db;
  font-weight: 500;
}

.admin-link {
  color: #e74c3c;
}

.nav-auth {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-address {
  font-family: monospace;
  background-color: #f0f0f0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.admin-badge {
  background-color: #e74c3c;
  color: white;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.btn-logout {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  background-color: #f0f0f0;
  color: #333;
  border: none;
  cursor: pointer;
}

.btn-logout:hover {
  background-color: #e0e0e0;
}
</style>
