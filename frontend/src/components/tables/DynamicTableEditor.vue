<template>
  <div class="dynamic-table-editor">
    <div class="editor-header">
      <input v-model="tableName" @blur="saveTableName" class="table-title-input" />
      <textarea v-model="tableDesc" @blur="saveTableDesc" class="table-desc-input" />
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <div v-if="isLoading" class="loading">Загрузка...</div>
    <div v-else>
      <TableColumnsDraggable
        :columns="columns"
        @update-column="updateColumn"
        @delete-column="deleteColumn"
        @edit-options="openOptionsEditor"
        @columns-reordered="reorderColumns"
      />
      <SelectOptionsEditor
        v-if="showOptionsEditor"
        :options="editingOptions"
        @update:options="saveOptions"
      />
      <div class="table-controls">
        <button class="btn btn-success" @click="addColumn">Добавить столбец</button>
        <button class="btn btn-success" @click="addRow">Добавить строку</button>
      </div>
      <table class="dynamic-table">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.id">{{ col.name }}</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td v-for="col in columns" :key="col.id">
              <template v-if="col.type === 'select'">
                <select v-model="cellEdits[`${row.id}_${col.id}`]" @change="saveCell(row.id, col.id)">
                  <option v-for="opt in col.options || []" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </template>
              <template v-else>
                <input :value="cellValue(row.id, col.id)" @input="onCellInput(row.id, col.id, $event.target.value)" @blur="saveCell(row.id, col.id)" />
              </template>
            </td>
            <td>
              <button class="btn btn-danger btn-sm" @click="deleteRow(row.id)">Удалить</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!rows.length || !columns.length" class="empty-table">Нет данных. Добавьте столбцы и строки.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import tablesService from '../../services/tablesService';
import TableColumnsDraggable from './TableColumnsDraggable.vue';
import SelectOptionsEditor from './SelectOptionsEditor.vue';

const props = defineProps({ tableId: { type: Number, required: true } });
const emit = defineEmits(['close']);
const isLoading = ref(true);
const columns = ref([]);
const rows = ref([]);
const cellValues = ref([]);
const cellEdits = ref({});
const tableName = ref('');
const tableDesc = ref('');
const showOptionsEditor = ref(false);
const editingCol = ref(null);
const editingOptions = ref([]);

function loadTable() {
  isLoading.value = true;
  tablesService.getTable(props.tableId)
    .then(res => {
      columns.value = res.columns;
      rows.value = res.rows;
      cellValues.value = res.cellValues;
      cellEdits.value = {};
      tableName.value = res.columns.length ? res.columns[0].table_name : '';
      tableDesc.value = res.columns.length ? res.columns[0].table_description : '';
    })
    .finally(() => { isLoading.value = false; });
}
function addColumn() {
  const name = prompt('Название столбца:');
  if (!name) return;
  tablesService.addColumn(props.tableId, { name, type: 'text' }).then(loadTable);
}
function addRow() {
  tablesService.addRow(props.tableId).then(loadTable);
}
function deleteColumn(colId) {
  if (!confirm('Удалить столбец?')) return;
  tablesService.deleteColumn(colId).then(loadTable);
}
function deleteRow(rowId) {
  if (!confirm('Удалить строку?')) return;
  tablesService.deleteRow(rowId).then(loadTable);
}
function cellValue(rowId, colId) {
  const key = `${rowId}_${colId}`;
  if (cellEdits.value[key] !== undefined) return cellEdits.value[key];
  const found = cellValues.value.find(c => c.row_id === rowId && c.column_id === colId);
  return found ? found.value : '';
}
function saveCell(rowId, colId) {
  const key = `${rowId}_${colId}`;
  const value = cellEdits.value[key];
  tablesService.saveCell({ row_id: rowId, column_id: colId, value }).then(loadTable);
}
function updateColumn(col) {
  try {
    // Убеждаемся, что options - это массив или null
    let options = col.options;
    if (typeof options === 'string') {
      try {
        options = JSON.parse(options);
      } catch {
        options = [];
      }
    }
    
    tablesService.updateColumn(col.id, { 
      name: col.name, 
      type: col.type, 
      options: options,
      order: col.order 
    }).then(loadTable).catch(err => {
      console.error('Ошибка обновления столбца:', err);
      alert('Ошибка обновления столбца');
    });
  } catch (err) {
    console.error('Ошибка updateColumn:', err);
  }
}
function reorderColumns(newColumns) {
  // Сохраняем новый порядок столбцов последовательно
  const updatePromises = newColumns.map((col, idx) => 
    tablesService.updateColumn(col.id, { order: idx })
  );
  
  Promise.all(updatePromises)
    .then(() => loadTable())
    .catch(err => {
      console.error('Ошибка переупорядочивания столбцов:', err);
      alert('Ошибка переупорядочивания столбцов');
    });
}
function onCellInput(rowId, colId, value) {
  const key = `${rowId}_${colId}`;
  cellEdits.value[key] = value;
}
function openOptionsEditor(col) {
  editingCol.value = col;
  editingOptions.value = Array.isArray(col.options) ? [...col.options] : [];
  showOptionsEditor.value = true;
}
function saveOptions(newOptions) {
  if (!editingCol.value) return;
  tablesService.updateColumn(editingCol.value.id, { options: newOptions }).then(() => {
    showOptionsEditor.value = false;
    loadTable();
  });
}
function saveTableName() {
  tablesService.updateTable(props.tableId, { name: tableName.value });
}
function saveTableDesc() {
  tablesService.updateTable(props.tableId, { description: tableDesc.value });
}
watch([columns, rows], () => {
  cellEdits.value = {};
});
onMounted(loadTable);
</script>

<style scoped>
.dynamic-table-editor {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.13);
  padding: 28px 22px 18px 22px;
  max-width: 900px;
  margin: 40px auto;
  position: relative;
}
.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
}
.table-title-input {
  font-size: 1.3em;
  font-weight: bold;
  border: none;
  outline: none;
  background: transparent;
  flex: 1;
  padding: 4px 8px;
  border-radius: 4px;
}
.table-desc-input {
  font-size: 0.9em;
  border: 1px solid #ccc;
  outline: none;
  padding: 4px 8px;
  border-radius: 4px;
  resize: none;
  height: 60px;
  width: 200px;
}
.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #333;
}
.table-controls {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}
.dynamic-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 18px;
}
.dynamic-table th, .dynamic-table td {
  border: 1px solid #eee;
  padding: 6px 10px;
  text-align: left;
}
.dynamic-table th {
  background: #f5f7fa;
}
.btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 0.95rem;
  border: none;
  cursor: pointer;
}
.btn-success {
  background: #28a745;
  color: #fff;
}
.btn-danger {
  background: #dc3545;
  color: #fff;
}
.btn-sm {
  font-size: 0.85rem;
  padding: 2px 8px;
}
.loading {
  color: #888;
  margin: 16px 0;
}
.empty-table {
  color: #aaa;
  text-align: center;
  margin: 24px 0;
  font-size: 1.1em;
}
</style> 