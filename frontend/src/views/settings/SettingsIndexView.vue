<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
-->

<template>
  <AdminPageShell :show-close="true" fallback="/crm">
    <HubGrid>
      <HubCard
        v-if="canAccessPath('/settings/ai')"
        :title="t('settings.index.ai.title')"
        :description="t('settings.index.ai.description')"
        to="/settings/ai"
      />
      <HubCard
        v-if="canAccessPath('/settings/security')"
        :title="t('settings.index.security.title')"
        :description="t('settings.index.security.description')"
        to="/settings/security"
      />
      <HubCard
        v-if="canAccessPath('/settings/sidebar')"
        :title="t('settings.index.sidebar.title')"
        :description="t('settings.index.sidebar.description')"
        @open="goToSidebar"
      />
      <HubCard
        v-if="canAccessPath('/settings/dle-v2-deploy')"
        :title="t('settings.index.blockchain.title')"
        :description="t('settings.index.blockchain.description')"
        @open="goToDeploy"
      />
      <HubCard
        v-if="canAccessPath('/settings/interface')"
        :title="t('settings.index.server.title')"
        :description="t('settings.index.server.description')"
        to="/settings/interface"
      />
      <HubCard
        v-if="canAccessPath('/settings/updates')"
        :title="t('settings.index.updates.title')"
        :description="t('settings.index.updates.description')"
        @open="goToUpdates"
      />
    </HubGrid>

    <NoAccessModal
      :show="showNoAccessModal"
      :title="t('settings.accessRestricted')"
      :message="noAccessMessage"
      @close="showNoAccessModal = false"
    />
  </AdminPageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePermissions } from '@/composables/usePermissions';
import { useAuthContext } from '@/composables/useAuth';
import NoAccessModal from '@/components/NoAccessModal.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import HubGrid from '@/components/admin/HubGrid.vue';
import HubCard from '@/components/admin/HubCard.vue';
import { canAccessPath, ensureScreenAccessLoaded } from '@/composables/useScreenAccess.js';

const { t } = useI18n();
const router = useRouter();
const { canManageSettings } = usePermissions();
const { checkAuth, checkUserAccessLevel, address, isAuthenticated } = useAuthContext();
const showNoAccessModal = ref(false);
const noAccessMessage = ref('');

onMounted(() => {
  ensureScreenAccessLoaded();
});

async function ensureCanManageSettings(deniedMessageKey) {
  await checkAuth();
  if (isAuthenticated.value && address.value) {
    await checkUserAccessLevel(address.value);
  }
  if (!canManageSettings.value) {
    noAccessMessage.value = t(deniedMessageKey);
    showNoAccessModal.value = true;
    return false;
  }
  return true;
}

async function goToSidebar() {
  if (!(await ensureCanManageSettings('settings.sidebar.adminOnly'))) return;
  router.push({ name: 'settings-sidebar' });
}

async function goToUpdates() {
  if (!(await ensureCanManageSettings('settings.updates.adminOnly'))) return;
  router.push({ name: 'settings-updates' });
}

async function goToDeploy() {
  if (!(await ensureCanManageSettings('settings.index.blockchain.adminOnly'))) return;
  router.push({ name: 'settings-dle-v2-deploy' });
}
</script>
