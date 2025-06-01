<template>
  <div class="dynamic-tables-modal">
    <div class="modal-header">
      <h2>Пользовательские таблицы</h2>
      <button class="close-btn" @click="closeModal">×</button>
    </div>
    <UserTablesList
      :selected-table-id="selectedTableId"
      @update:selected-table-id="val => selectedTableId = val"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import UserTablesList from './UserTablesList.vue';

const selectedTableId = ref(null);

function closeModal() {
  selectedTableId.value = null;
  // эмитим наружу, чтобы закрыть модалку
  // (если используется <DynamicTablesModal @close=... />)
  // иначе просто убираем модалку
  // eslint-disable-next-line vue/custom-event-name-casing
  // $emit('close') не работает в <script setup>, используем defineEmits
  emit('close');
}
const emit = defineEmits(['close']);
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