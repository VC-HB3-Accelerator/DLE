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
    <h2>{{ $t('settings.rpc.title') }}</h2>
    <p v-if="isLoading" class="page-state">{{ $t('common.loading') }}</p>
    <RpcProvidersSettings
      v-else
      :rpcConfigs="rpcConfigs"
      @update="loadRpcConfigs"
    />
  </AdminPageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/axios';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import RpcProvidersSettings from './RpcProvidersSettings.vue';

const { t } = useI18n();
const isLoading = ref(true);
const rpcConfigs = ref([]);

async function loadRpcConfigs() {
  isLoading.value = true;
  try {
    const rpcResponse = await api.get('/settings/rpc');
    if (rpcResponse.data?.success) {
      rpcConfigs.value = (rpcResponse.data.data || []).map((rpc) => ({
        networkId: rpc.network_id,
        rpcUrl: rpc.rpc_url,
        rpcUrlDisplay: rpc.rpc_url_display,
        chainId: rpc.chain_id,
      }));
    } else {
      rpcConfigs.value = [];
    }
  } catch (error) {
    console.error('[RpcProvidersSettingsView] load failed', error);
    rpcConfigs.value = [];
    alert(t('settings.security.loadFailed'));
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadRpcConfigs);
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
