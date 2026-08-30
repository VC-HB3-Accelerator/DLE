<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Карточки разделов CRM и настроек на хабе `/management`.
-->

<template>
  <div class="admin-hub-cards">
    <HubGrid>
      <HubCard
        v-if="canAccessPath('/contacts-list')"
        :title="t('crm.contacts')"
        :description="t('crm.contactsDesc')"
        :to="{ name: 'contacts-list' }"
      />
      <HubCard
        v-if="canAccessPath('/content')"
        :title="t('crm.content')"
        :description="t('crm.contentDesc')"
        :to="{ name: 'content-list' }"
      />
      <HubCard
        v-if="canAccessPath('/vds')"
        :title="t('crm.vds')"
        :description="t('crm.vdsDesc')"
        :to="{ name: 'vds-management' }"
      />
      <HubCard
        v-if="canAccessPath('/tables')"
        :title="t('crm.tables')"
        :description="t('crm.tablesDesc')"
        :to="{ name: 'tables-list' }"
      />
      <HubCard
        v-if="canAccessPath('/crm/store')"
        :title="t('crm.store')"
        :description="t('crm.storeDesc')"
        :to="{ name: 'crm-store' }"
      />
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
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePermissions } from '@/composables/usePermissions';
import { useAuthContext } from '@/composables/useAuth';
import NoAccessModal from '@/components/NoAccessModal.vue';
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
</script>
