<template>
  <div class="dynamic-tables-modal">
    <div class="modal-header">
      <h2>Пользовательские таблицы</h2>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <UserTablesList @open-table="openTable" @table-deleted="onTableDeleted" />
    <DynamicTableEditor v-if="selectedTable" :table-id="selectedTable.id" @close="closeEditor" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import UserTablesList from './UserTablesList.vue';
import DynamicTableEditor from './DynamicTableEditor.vue';

const selectedTable = ref(null);
function openTable(table) {
  selectedTable.value = table;
}
function closeEditor() {
  selectedTable.value = null;
}
function onTableDeleted(deletedTableId) {
  if (selectedTable.value && selectedTable.value.id === deletedTableId) {
    selectedTable.value = null;
  }
}
</script>

<style scoped>
.dynamic-tables-modal {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  padding: 32px 24px 24px 24px;
  max-width: 900px;
  margin: 40px auto;
  position: relative;
  overflow-x: auto;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}
.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #333;
}
.tables-list-block {
  margin-bottom: 18px;
}
.tables-list {
  list-style: none;
  padding: 0;
}
.tables-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}
.btn {
  margin-left: 12px;
}
.loading {
  color: #888;
  margin: 16px 0;
}
.user-table-block {
  margin-bottom: 32px;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 18px 12px;
  background: #fafbfc;
}
.user-table-full {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}
.user-table-full th, .user-table-full td {
  border: 1px solid #e0e0e0;
  padding: 6px 10px;
  text-align: left;
}
.user-table-full th {
  background: #f5f5f5;
}
</style> 