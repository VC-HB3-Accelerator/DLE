<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
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
      <button class="danger" @click="$emit('delete')">Удалить</button>
    </td>
  </tr>
</template>

<script setup>
import TableCell from './TableCell.vue';
const props = defineProps(['row', 'columns', 'cellValues']);
</script>

<style scoped>
.danger {
  background: #ff4d4f;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.3em 0.8em;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}
.danger:hover {
  background: #d9363e;
}
</style> 