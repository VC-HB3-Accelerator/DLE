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
    <AdminPageShell :show-close="true" :fallback="{ name: 'crm' }">
      <HubGrid>
        <HubCard
          v-if="canEditData"
          :title="t('groups.createGroup')"
          :description="t('groups.createGroupDesc')"
          :cta-label="t('common.comingSoon')"
          disabled
        />
        <HubCard
          v-if="isAuthenticated"
          :title="t('groups.privateGroups')"
          :description="t('groups.privateGroupsDesc')"
          :cta-label="t('common.comingSoon')"
          disabled
        />
      </HubGrid>
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePermissions } from '../../composables/usePermissions';
import { useAuthContext } from '../../composables/useAuth';
import BaseLayout from '../../components/BaseLayout.vue';
import AdminPageShell from '../../components/admin/AdminPageShell.vue';
import HubGrid from '../../components/admin/HubGrid.vue';
import HubCard from '../../components/admin/HubCard.vue';

defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

defineEmits(['auth-action-completed']);

const { t } = useI18n();
const { canEditData } = usePermissions();
const { isAuthenticated } = useAuthContext();
</script>
