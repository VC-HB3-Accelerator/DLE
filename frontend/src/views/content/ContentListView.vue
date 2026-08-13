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
          :title="t('content.list.createPage.title')"
          :description="t('content.list.createPage.description')"
          @open="goToCreate"
        />
        <HubCard
          :title="t('content.list.published.title')"
          :description="t('content.list.published.description')"
          @open="goToPublished"
        />
        <HubCard
          :title="t('content.list.internal.title')"
          :description="t('content.list.internal.description')"
          @open="goToInternal"
        />
        <HubCard
          :title="t('content.list.templates.title')"
          :description="t('content.list.templates.description')"
          @open="goToTemplates"
        />
        <HubCard
          :title="t('content.list.settings.title')"
          :description="t('content.list.settings.description')"
          @open="goToContentSettings"
        />
        <HubCard
          :title="t('content.list.systemMessages.title')"
          :description="t('content.list.systemMessages.description')"
          @open="goToSystemMessages"
        />
        <HubCard
          v-if="isEditor"
          :title="t('content.list.media.title')"
          :description="t('content.list.media.description')"
          @open="goToMedia"
        />
      </HubGrid>
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';
import AdminPageShell from '../../components/admin/AdminPageShell.vue';
import HubGrid from '../../components/admin/HubGrid.vue';
import HubCard from '../../components/admin/HubCard.vue';
import { usePermissions } from '../../composables/usePermissions';

defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false }
});

defineEmits(['auth-action-completed']);

const { t } = useI18n();
const router = useRouter();
const { hasPermission, PERMISSIONS } = usePermissions();
const isEditor = computed(() => hasPermission(PERMISSIONS.MANAGE_LEGAL_DOCS));

function goToCreate() { router.push({ name: 'content-create' }); }
function goToTemplates() { router.push({ name: 'content-templates' }); }
function goToMedia() { router.push({ name: 'content-media' }); }
function goToPublished() { router.push({ name: 'content-published' }); }
function goToContentSettings() { router.push({ name: 'content-settings' }); }
function goToInternal() { router.push({ name: 'content-internal' }); }
function goToSystemMessages() { router.push({ name: 'content-system-messages-table' }); }
</script>
