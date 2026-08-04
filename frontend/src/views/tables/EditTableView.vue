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
    <div class="panel edit-table-form page-with-close">
      <PageCloseButton :fallback="{ name: 'user-table-view', params: { id: $route.params.id } }" />
      <h2>{{ t('tables.edit.title') }}</h2>
      <form @submit.prevent="save">
        <div class="form-group">
          <label class="form-label">{{ t('tables.common.name') }}</label>
          <input class="form-control" v-model="name" required />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('tables.common.description') }}</label>
          <textarea class="form-control" v-model="description" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('tables.common.aiSource') }}</label>
          <select class="form-control" v-model="isRagSourceId" required>
            <option :value="1">{{ t('common.yes') }}</option>
            <option :value="2">{{ t('common.no') }}</option>
          </select>
        </div>
        <div class="btn-row actions">
          <button type="submit" class="btn btn-primary">{{ t('tables.common.save') }}</button>
        </div>
      </form>
    </div>
  </BaseLayout>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import tablesService from '@/services/tablesService';

const { t } = useI18n();
const $route = useRoute();
const router = useRouter();
const name = ref('');
const description = ref('');
const isRagSourceId = ref(2);

onMounted(async () => {
  const data = await tablesService.getTable($route.params.id);
  name.value = data.name;
  description.value = data.description;
  isRagSourceId.value = data.is_rag_source_id || 2;
});

async function save() {
  await tablesService.updateTable($route.params.id, {
    name: name.value,
    description: description.value,
    isRagSourceId: isRagSourceId.value
  });
  router.push({ name: 'user-table-view', params: { id: $route.params.id } });
}
</script>
<style scoped>
.edit-table-form {
  max-width: min(400px, 100%);
  width: 100%;
  box-sizing: border-box;
  margin: var(--spacing-xl) auto;
  position: relative;
}

.edit-table-form h2 {
  padding-right: calc(var(--button-height) + var(--spacing-sm));
}

.actions {
  margin-top: var(--spacing-lg);
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .edit-table-form {
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
