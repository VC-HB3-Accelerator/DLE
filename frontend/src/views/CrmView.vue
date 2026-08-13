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
    <AdminPageShell :show-close="true" fallback="/management">
      <AdminSectionTabs />
      <HubGrid>
        <HubCard
          :title="t('crm.contacts')"
          :description="t('crm.contactsDesc')"
          :to="{ name: 'contacts-list' }"
        />
        <HubCard
          :title="t('crm.content')"
          :description="t('crm.contentDesc')"
          :to="{ name: 'content-list' }"
        />
        <HubCard
          :title="t('crm.vds')"
          :description="t('crm.vdsDesc')"
          :to="{ name: 'vds-management' }"
        />
        <HubCard
          :title="t('crm.tables')"
          :description="t('crm.tablesDesc')"
          :to="{ name: 'tables-list' }"
        />
        <HubCard
          :title="t('crm.settings')"
          :description="t('crm.settingsDesc')"
          :to="{ name: 'settings-index' }"
        />
        <HubCard
          :title="t('crm.groups')"
          :description="t('crm.groupsDesc')"
          :to="{ name: 'groups' }"
        />
      </HubGrid>
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { onMounted, onBeforeUnmount, defineProps, defineEmits } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../components/BaseLayout.vue';
import AdminPageShell from '../components/admin/AdminPageShell.vue';
import AdminSectionTabs from '../components/admin/AdminSectionTabs.vue';
import HubGrid from '../components/admin/HubGrid.vue';
import HubCard from '../components/admin/HubCard.vue';
import eventBus from '../utils/eventBus';
import { getAllDLEs } from '../services/dleV2Service.js';

const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

defineEmits(['auth-action-completed']);

const { t } = useI18n();

let ws = null;
let unsubscribe = null;

async function loadDLEs() {
  try {
    await getAllDLEs();
  } catch (_) {
    /* ignore */
  }
}

function connectWebSocket() {
  /* reserved — CRM list hub no longer embeds live tables */
}

const handleAuthEvent = (eventData) => {
  if (eventData.isAuthenticated) loadDLEs();
};

onMounted(() => {
  loadDLEs();
  unsubscribe = eventBus.on('auth-state-changed', handleAuthEvent);
  connectWebSocket();
});

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe();
  if (ws) ws.close();
});
</script>
