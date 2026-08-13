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
  <AdminPageShell :show-close="true" fallback="/settings">
    <HubGrid>
      <HubCard
        :title="$t('settings.rpc.title')"
        :description="rpcDesc"
        @open="handleRpcDetailsClick"
      />
      <HubCard
        :title="$t('settings.security.authentication')"
        :description="authDesc"
        @open="goAuthDetails"
      />
      <HubCard
        :title="$t('settings.security.roles.hubCard')"
        :description="$t('settings.security.roles.hubCardText')"
        @open="handleRolesDetailsClick"
      />
    </HubGrid>

    <NoAccessModal
      :show="showNoAccessModal"
      :title="$t('settings.accessRestricted')"
      :message="t('settings.security.rpcAdminOnly')"
      @close="showNoAccessModal = false"
    />
  </AdminPageShell>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { reactive, ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/api/axios';
import { usePermissions } from '@/composables/usePermissions';
import NoAccessModal from '@/components/NoAccessModal.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import HubGrid from '@/components/admin/HubGrid.vue';
import HubCard from '@/components/admin/HubCard.vue';

const { t } = useI18n();
const router = useRouter();
const { canManageSettings } = usePermissions();

const showNoAccessModal = ref(false);
const securitySettings = reactive({
  rpcConfigs: [],
  authTokens: [],
});

const rpcDesc = computed(() =>
  securitySettings.rpcConfigs.length > 0
    ? t('settings.security.providersConfigured', { count: securitySettings.rpcConfigs.length })
    : t('settings.security.providersNotConfigured')
);

const authDesc = computed(() =>
  securitySettings.authTokens.length > 0
    ? t('settings.security.tokensConfigured', { count: securitySettings.authTokens.length })
    : t('settings.security.tokensNotConfigured')
);

async function loadSettings() {
  try {
    const rpcResponse = await api.get('/settings/rpc');
    if (rpcResponse.data?.success) {
      securitySettings.rpcConfigs = (rpcResponse.data.data || []).map((rpc) => ({
        networkId: rpc.network_id,
        rpcUrl: rpc.rpc_url,
        rpcUrlDisplay: rpc.rpc_url_display,
        chainId: rpc.chain_id,
      }));
    }
    const authResponse = await api.get('/settings/auth-tokens');
    if (authResponse.data?.success) {
      securitySettings.authTokens = authResponse.data.data || [];
    }
  } catch (_) {
    /* ignore */
  }
}

function handleRpcDetailsClick() {
  if (!canManageSettings.value) {
    showNoAccessModal.value = true;
    return;
  }
  router.push({ name: 'settings-security-rpc' });
}

function goAuthDetails() {
  if (!canManageSettings.value) {
    showNoAccessModal.value = true;
    return;
  }
  router.push({ name: 'settings-security-auth' });
}

function handleRolesDetailsClick() {
  if (!canManageSettings.value) {
    showNoAccessModal.value = true;
    return;
  }
  router.push({ name: 'settings-security-roles' });
}

onMounted(loadSettings);
</script>
