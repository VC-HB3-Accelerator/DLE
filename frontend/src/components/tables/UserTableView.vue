<template>
  <div class="user-table-header" v-if="tableMeta">
    <h2>{{ tableMeta.name }}</h2>
    <div class="table-desc">{{ tableMeta.description }}</div>
  </div>
  <div class="notion-table-wrapper">
    <table class="notion-table">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.id" @dblclick="editColumn(col)">
            <span v-if="!editingCol || editingCol.id !== col.id">{{ col.name }}</span>
            <input v-else v-model="colEditValue" @blur="saveColEdit(col)" @keyup.enter="saveColEdit(col)" @keyup.esc="cancelColEdit" class="notion-input" />
            <button class="col-menu" @click.stop="openColMenu(col)">⋮</button>
          </th>
          <th>
            <button class="add-col" @click="addColumn">+</button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td v-for="col in columns" :key="col.id" @click="startEdit(row, col)">
            <span v-if="!isEditing(row, col)">{{ getCellValue(row, col) || '—' }}</span>
            <input
              v-else
              v-model="editValue"
              @blur="saveEdit(row, col)"
              @keyup.enter="saveEdit(row, col)"
              @keyup.esc="cancelEdit"
              class="notion-input"
              autofocus
            />
          </td>
          <td>
            <button class="row-menu" @click.stop="openRowMenu(row)">⋮</button>
          </td>
        </tr>
        <tr>
          <td :colspan="columns.length + 1">
            <button class="add-row" @click="addRow">+ Добавить строку</button>
          </td>
        </tr>
      </tbody>
    </table>
    <!-- Модалки и меню можно реализовать через отдельные компоненты или простые div -->
  </div>
</template>

<script setup>
import { ref } from 'vue';
import tablesService from '../../services/tablesService';

const props = defineProps({ tableId: Number });
const columns = ref([]);
const rows = ref([]);
const cellValues = ref([]);
const tableMeta = ref(null);

// Для редактирования ячеек
const editing = ref({ rowId: null, colId: null });
const editValue = ref('');
function isEditing(row, col) {
  return editing.value.rowId === row.id && editing.value.colId === col.id;
}
function startEdit(row, col) {
  editing.value = { rowId: row.id, colId: col.id };
  editValue.value = getCellValue(row, col) || '';
}
function saveEdit(row, col) {
  tablesService.saveCell({ row_id: row.id, column_id: col.id, value: editValue.value }).then(fetchTable);
  editing.value = { rowId: null, colId: null };
}
function cancelEdit() {
  editing.value = { rowId: null, colId: null };
}
function getCellValue(row, col) {
  const cell = cellValues.value.find(c => c.row_id === row.id && c.column_id === col.id);
  return cell ? cell.value : '';
}

// Для редактирования названия столбца
const editingCol = ref(null);
const colEditValue = ref('');
function editColumn(col) {
  editingCol.value = col;
  colEditValue.value = col.name;
}
function saveColEdit(col) {
  tablesService.updateColumn(col.id, { name: colEditValue.value }).then(fetchTable);
  editingCol.value = null;
}
function cancelColEdit() {
  editingCol.value = null;
}

// Добавление/удаление
function addColumn() {
  tablesService.addColumn(props.tableId, { name: 'Новый столбец', type: 'text' }).then(fetchTable);
}
function addRow() {
  tablesService.addRow(props.tableId).then(fetchTable);
}
function openColMenu(col) { /* TODO: контекстное меню */ }
function openRowMenu(row) { /* TODO: контекстное меню */ }

// Загрузка данных
async function fetchTable() {
  const data = await tablesService.getTable(props.tableId);
  columns.value = data.columns;
  rows.value = data.rows;
  cellValues.value = data.cellValues;
  tableMeta.value = { name: data.name, description: data.description };
}
fetchTable();
</script>

<style scoped>
.notion-table-wrapper {
  overflow-x: auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  padding: 1.5rem 1rem;
}
.notion-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
}
.notion-table th, .notion-table td {
  border: 1px solid #ececec;
  padding: 0.5em 0.7em;
  min-width: 80px;
  position: relative;
  background: #fff;
}
.notion-table th {
  background: #f7f7f7;
  font-weight: 600;
}
.notion-table tr:hover {
  background: #f9fafb;
}
.col-menu, .row-menu, .add-col, .add-row {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 1.1em;
  margin-left: 0.3em;
}
.col-menu:hover, .row-menu:hover, .add-col:hover, .add-row:hover {
  color: #2ecc40;
}
.notion-input {
  width: 100%;
  border: 1px solid #2ecc40;
  border-radius: 4px;
  padding: 0.2em 0.4em;
}
.user-table-header {
  margin-bottom: 1.2em;
  padding: 1em 1.2em 0.5em 1.2em;
  background: #f8f9fa;
  border-radius: 10px 10px 0 0;
  border-bottom: 1px solid #ececec;
}
.user-table-header h2 {
  margin: 0 0 0.2em 0;
  font-size: 1.3em;
  font-weight: 700;
}
.table-desc {
  color: #888;
  font-size: 1em;
}
</style> 