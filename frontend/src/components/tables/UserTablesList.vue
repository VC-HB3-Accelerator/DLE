<template>
  <div class="user-tables-list">
    <div class="header-block">
      <h2>Пользовательские таблицы</h2>
      <button class="btn btn-success" @click="showCreateTable = true">Создать таблицу</button>
    </div>
    <div v-if="isLoading" class="loading">Загрузка...</div>
    <div v-else>
      <div v-if="tables.length === 0" class="empty-block">Нет таблиц. Создайте первую!</div>
      <div v-else class="tables-cards">
        <div v-for="table in tables" :key="table.id" class="table-card">
          <div class="table-card-header">
            <input v-if="editingTableId === table.id" v-model="editName" @blur="saveName(table)" @keyup.enter="saveName(table)" class="table-name-input" />
            <h3 v-else @dblclick="startEditName(table)">{{ table.name }}</h3>
            <div class="table-card-actions">
              <button class="btn btn-info btn-sm" @click="$emit('open-table', table)">Открыть</button>
              <button class="btn btn-warning btn-sm" @click="startEditName(table)">Переименовать</button>
              <button class="btn btn-danger btn-sm" @click="deleteTable(table)">Удалить</button>
            </div>
          </div>
          <div class="table-card-desc">
            <textarea v-if="editingDescId === table.id" v-model="editDesc" @blur="saveDesc(table)" @keyup.enter="saveDesc(table)" class="table-desc-input" />
            <p v-else @dblclick="startEditDesc(table)">{{ table.description || 'Без описания' }}</p>
          </div>
        </div>
      </div>
    </div>
    <CreateTableModal v-if="showCreateTable" @close="showCreateTable = false" @table-created="onTableCreated" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import tablesService from '../../services/tablesService';
import CreateTableModal from './CreateTableModal.vue';

const emit = defineEmits(['open-table', 'table-deleted']);
const tables = ref([]);
const isLoading = ref(false);
const showCreateTable = ref(false);
const editingTableId = ref(null);
const editName = ref('');
const editingDescId = ref(null);
const editDesc = ref('');

function loadTables() {
  isLoading.value = true;
  tablesService.getTables()
    .then(res => { 
      tables.value = [...res]; // Создаем новый массив для принудительного обновления
    })
    .finally(() => { isLoading.value = false; });
}
function onTableCreated() {
  showCreateTable.value = false;
  loadTables();
}
function startEditName(table) {
  editingTableId.value = table.id;
  editName.value = table.name;
}
function saveName(table) {
  if (editName.value && editName.value !== table.name) {
    tablesService.updateTable(table.id, { name: editName.value })
      .then(loadTables);
  }
  editingTableId.value = null;
}
function startEditDesc(table) {
  editingDescId.value = table.id;
  editDesc.value = table.description || '';
}
function saveDesc(table) {
  tablesService.updateTable(table.id, { description: editDesc.value })
    .then(loadTables);
  editingDescId.value = null;
}
function deleteTable(table) {
  console.log('deleteTable called with:', table);
  
  if (!confirm(`Удалить таблицу "${table.name}"?`)) {
    console.log('User cancelled deletion');
    return;
  }
  
  console.log('User confirmed deletion, proceeding...');
  
  // Немедленно удаляем из локального списка для быстрой реакции UI
  tables.value = tables.value.filter(t => t.id !== table.id);
  console.log('Removed from local list, making API call...');
  
  tablesService.deleteTable(table.id)
    .then((result) => {
      console.log('Таблица удалена:', result);
      // Уведомляем родительский компонент об удалении
      emit('table-deleted', table.id);
      // Принудительно обновляем список с сервера для синхронизации
      loadTables();
    })
    .catch((error) => {
      console.error('Ошибка удаления таблицы:', error);
      alert('Ошибка при удалении таблицы');
      // При ошибке восстанавливаем список с сервера
      loadTables();
    });
}
onMounted(loadTables);
</script>

<style scoped>
.user-tables-list {
  padding: 18px 8px;
}
.header-block {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}
.tables-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}
.table-card {
  background: #f8fafc;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 16px 18px;
  min-width: 260px;
  max-width: 340px;
  flex: 1 1 260px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.table-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.table-card-actions {
  display: flex;
  gap: 6px;
}
.table-card-desc {
  margin-top: 10px;
}
.table-name-input, .table-desc-input {
  width: 100%;
  font-size: 1.1em;
  border: 1px solid #b0b0b0;
  border-radius: 6px;
  padding: 4px 8px;
}
.empty-block {
  color: #888;
  text-align: center;
  margin: 32px 0;
}
.loading {
  color: #888;
  margin: 16px 0;
}
</style> 