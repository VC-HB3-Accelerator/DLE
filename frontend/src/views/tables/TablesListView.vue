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
    <div class="panel tables-list-block page-with-close">
      <PageCloseButton :fallback="{ name: 'crm' }" />
      <h2 class="tables-list-title">{{ t('tables.list.title') }}</h2>
      <UserTablesList v-if="canViewData" />
      <div v-else class="empty-table-placeholder">{{ t('tables.common.noDataToDisplay') }}</div>
    </div>
  </BaseLayout>
</template>

<script setup>
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import UserTablesList from '../../components/tables/UserTablesList.vue';
import { useI18n } from 'vue-i18n';
import { usePermissions } from '@/composables/usePermissions';

const { t } = useI18n();
const { canViewData } = usePermissions();
</script>

<style scoped>
.tables-list-block {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin-top: var(--spacing-xl);
  position: relative;
  overflow-x: auto;
}

.tables-list-title {
  margin: 0 0 var(--spacing-lg);
  padding-right: calc(var(--button-height) + var(--spacing-sm));
  color: var(--theme-text);
}

.page-with-close {
  position: relative;
}

.empty-table-placeholder {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--theme-text-muted);
}

@media (max-width: 768px) {
  .tables-list-block {
    margin-top: var(--spacing-lg);
  }
}
</style>
