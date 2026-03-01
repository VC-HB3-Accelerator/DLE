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
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="gitea-page">
      <iframe
        class="gitea-iframe"
        :src="giteaUrl"
        title="Gitea — репозитории"
      />
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, defineProps } from 'vue';
import BaseLayout from '../components/BaseLayout.vue';

defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean,
});

// URL Gitea: локально — порт 3001; на продакшене — путь /gitea/ (прокси в nginx, один домен — нет разрыва соединения).
const giteaUrl = computed(() => {
  if (typeof window === 'undefined') return '';
  const { hostname, protocol } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isLocal) {
    const port = import.meta.env.VITE_GITEA_PORT || '3001';
    return `${protocol}//${hostname}:${port}`;
  }
  return `${protocol}//${hostname}/gitea/`;
});
</script>

<style scoped>
.gitea-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin: 0 -20px -20px -20px; /* компенсация padding main-content */
  padding: 0;
}

.gitea-iframe {
  flex: 1;
  width: 100%;
  border: none;
  min-height: 400px;
}

@media (max-width: 768px) {
  .gitea-page {
    margin: 0 -10px -10px -10px;
  }
}

@media (max-width: 480px) {
  .gitea-page {
    margin: 0 -10px -5px -10px;
  }
}
</style>
