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
    <div class="panel delete-table-confirm page-with-close">
      <PageCloseButton :fallback="{ name: 'user-table-view', params: { id: $route.params.id } }" />
      <h2>{{ t('tables.delete.title') }}</h2>
      <p>{{ t('tables.delete.confirmMessage') }}</p>
      <div class="btn-row actions">
        <button v-if="canDeleteData" type="button" class="btn btn-danger" @click="remove">{{ t('tables.common.delete') }}</button>
      </div>
      <div v-if="!canDeleteData" class="empty-table-placeholder">{{ t('tables.delete.noPermission') }}</div>
    </div>
  </BaseLayout>
</template>
<script setup>
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import axios from 'axios';
import { usePermissions } from '@/composables/usePermissions';

const $route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { canDeleteData } = usePermissions();

async function remove() {
  await axios.delete(`/tables/${$route.params.id}`);
  router.push({ name: 'tables-list' });
}
</script>
<style scoped>
.delete-table-confirm {
  max-width: min(400px, 100%);
  width: 100%;
  box-sizing: border-box;
  margin: var(--spacing-xl) auto;
  text-align: center;
  position: relative;
}

.delete-table-confirm h2 {
  padding-right: calc(var(--button-height) + var(--spacing-sm));
}

.actions {
  margin-top: var(--spacing-xl);
  justify-content: center;
}

.empty-table-placeholder {
  margin-top: var(--spacing-lg);
  color: var(--theme-text-muted);
}

@media (max-width: 768px) {
  .delete-table-confirm {
    margin: var(--spacing-md) auto;
  }

  .actions {
    flex-direction: column;
  }

  .actions .btn {
    width: 100%;
  }
}
</style>
