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
    <div class="panel create-table-container page-with-close">
      <PageCloseButton :fallback="{ name: 'tables-list' }" />
      <h2>{{ t('tables.create.title') }}</h2>
      <form v-if="canEditData" @submit.prevent="handleCreateTable" class="create-table-form">
        <div class="form-group">
          <label class="form-label">{{ t('tables.create.tableNameLabel') }}</label>
          <input class="form-control" v-model="newTableName" required :placeholder="t('tables.create.namePlaceholder')" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('tables.common.description') }}</label>
          <textarea class="form-control" v-model="newTableDescription" :placeholder="t('tables.create.descriptionPlaceholder')" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('tables.common.aiSource') }}</label>
          <select class="form-control" v-model="newTableIsRagSourceId" required>
            <option :value="1">{{ t('common.yes') }}</option>
            <option :value="2">{{ t('common.no') }}</option>
          </select>
        </div>
        <div class="btn-row form-actions">
          <button type="submit" class="btn btn-primary">{{ t('tables.common.create') }}</button>
        </div>
      </form>
      <div v-else class="empty-table-placeholder">
        <p>{{ t('tables.create.noPermission') }}</p>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import tablesService from '../../services/tablesService';
import { usePermissions } from '@/composables/usePermissions';

const router = useRouter();
const { t } = useI18n();
const newTableName = ref('');
const newTableDescription = ref('');
const newTableIsRagSourceId = ref(2);
const { canEditData } = usePermissions();

onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    newTableName.value = '';
    newTableDescription.value = '';
    newTableIsRagSourceId.value = 2;
  });
});

async function handleCreateTable() {
  if (!newTableName.value) return;
  await tablesService.createTable({
    name: newTableName.value,
    description: newTableDescription.value,
    isRagSourceId: newTableIsRagSourceId.value
  });
  router.push({ name: 'tables-list' });
}
</script>

<style scoped>
.create-table-container {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin-top: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  overflow-x: auto;
  position: relative;
}

.create-table-container h2 {
  padding-right: calc(var(--button-height) + var(--spacing-sm));
}

.create-table-form {
  display: flex;
  flex-direction: column;
}

.form-actions {
  margin-top: var(--spacing-md);
}

.empty-table-placeholder {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--theme-text-muted);
}

.empty-table-placeholder p {
  margin-bottom: var(--spacing-lg);
}

@media (max-width: 768px) {
  .create-table-container {
    overflow-x: hidden;
  }

  .form-actions {
    flex-direction: column;
  }

  .form-actions .btn {
    width: 100%;
  }
}
</style>
