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
    <div class="panel table-block-wrapper page-with-close">
      <PageCloseButton :fallback="{ name: 'tables-list' }" />
      <div class="btn-row tableview-header-row">
        <button type="button" class="btn btn-outline-primary" @click="goToCreate">{{ t('tables.common.createTable') }}</button>
        <button v-if="canEditData" type="button" class="btn btn-primary" @click="goToEdit">{{ t('tables.common.edit') }}</button>
        <button v-if="canDeleteData" type="button" class="btn btn-danger" @click="goToDelete">{{ t('tables.common.delete') }}</button>
      </div>
      <UserTableView v-if="canViewData" :table-id="Number($route.params.id)" />
      <div v-else class="empty-table-placeholder">{{ t('tables.common.noDataToDisplay') }}</div>
    </div>
  </BaseLayout>
</template>

<script setup>
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import UserTableView from '../../components/tables/UserTableView.vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePermissions } from '@/composables/usePermissions';

const $route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { canViewData, canEditData, canDeleteData } = usePermissions();

function goToEdit() {
  router.push({ name: 'edit-table', params: { id: $route.params.id } });
}

function goToDelete() {
  router.push({ name: 'delete-table', params: { id: $route.params.id } });
}

function goToCreate() {
  router.push({ name: 'create-table' });
}
</script>

<style scoped>
.table-block-wrapper {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin-top: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  overflow-x: auto;
  position: relative;
}

.tableview-header-row {
  justify-content: flex-end;
  margin: 0 0 var(--spacing-md);
}

.empty-table-placeholder {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--theme-text-muted);
}

@media (max-width: 768px) {
  .tableview-header-row {
    justify-content: stretch;
  }

  .tableview-header-row .btn {
    width: 100%;
  }
}
</style>
