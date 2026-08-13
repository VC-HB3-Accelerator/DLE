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
  <AdminPageShell :show-close="true" fallback="/settings/security" variant="plain">
    <h2>{{ $t('settings.security.authentication') }}</h2>
    <p v-if="isLoading" class="page-state">{{ $t('common.loading') }}</p>
    <AuthTokensSettings
      v-else
      :authTokens="authTokens"
      @update="loadAuthTokens"
    />
  </AdminPageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/axios';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import AuthTokensSettings from './AuthTokensSettings.vue';

const { t } = useI18n();
const isLoading = ref(true);
const authTokens = ref([]);

async function loadAuthTokens() {
  isLoading.value = true;
  try {
    const authResponse = await api.get('/settings/auth-tokens');
    if (authResponse.data?.success) {
      authTokens.value = (authResponse.data.data || []).map((token) => ({
        name: token.name,
        address: token.address,
        network: token.network,
        minBalance: token.min_balance,
        readonlyThreshold: token.readonly_threshold ?? 1,
        editorThreshold: token.editor_threshold ?? 1,
      }));
    } else {
      authTokens.value = [];
    }
  } catch (error) {
    console.error('[AuthTokensSettingsView] load failed', error);
    authTokens.value = [];
    alert(t('settings.security.loadFailed'));
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadAuthTokens);
</script>

<style scoped>
.settings-subpage {
  position: relative;
  max-width: 100%;
  box-sizing: border-box;
}

.settings-subpage h2 {
  margin: 0 0 var(--spacing-lg, 20px);
  padding-right: 2.5rem;
  color: var(--theme-text, #222);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.page-state {
  color: var(--theme-text-muted, #666);
}
</style>
