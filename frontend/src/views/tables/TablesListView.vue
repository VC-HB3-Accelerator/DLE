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
  <BaseLayout>
    <AdminPageShell :show-close="true" :fallback="{ name: 'crm' }" variant="panel">
      <h2 class="tables-list-title">{{ t('tables.list.title') }}</h2>
      <UserTablesList v-if="canViewData" />
      <div v-else class="empty-table-placeholder">{{ t('tables.common.noDataToDisplay') }}</div>
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import BaseLayout from '../../components/BaseLayout.vue';
import AdminPageShell from '@/components/admin/AdminPageShell.vue';
import UserTablesList from '../../components/tables/UserTablesList.vue';
import { useI18n } from 'vue-i18n';
import { usePermissions } from '@/composables/usePermissions';

const { t } = useI18n();
const { canViewData } = usePermissions();
</script>

<style scoped>
.tables-list-title {
  margin: 0 0 var(--spacing-lg);
  padding-right: 2.5rem;
  color: var(--color-dark);
}

.empty-table-placeholder {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--theme-text-muted);
}
</style>
