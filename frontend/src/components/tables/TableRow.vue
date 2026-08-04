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
  <tr>
    <TableCell
      v-for="col in columns"
      :key="col.id"
      :row-id="row.id"
      :column="col"
      :cell-values="cellValues"
      @update="val => $emit('update', { rowId: row.id, columnId: col.id, value: val })"
    />
    <td>
      <button type="button" class="btn btn-danger btn-sm" @click="$emit('delete')">{{ t('tables.common.delete') }}</button>
    </td>
  </tr>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import TableCell from './TableCell.vue';

const { t } = useI18n();
defineProps(['row', 'columns', 'cellValues']);
</script>

<style scoped>
/* кнопки — global .btn* */
</style>
