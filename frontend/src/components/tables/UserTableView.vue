<template>
  <div class="user-table-header" v-if="tableMeta">
    <h2>{{ tableMeta.name }}</h2>
    <div class="table-desc">{{ tableMeta.description }}</div>
  </div>
  <div class="notion-table-wrapper">
    <table class="notion-table">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.id" @dblclick="editColumn(col)" class="th-col">
            <span v-if="!editingCol || editingCol.id !== col.id">{{ col.name }}</span>
            <input v-else v-model="colEditValue" @blur="saveColEdit(col)" @keyup.enter="saveColEdit(col)" @keyup.esc="cancelColEdit" class="notion-input" />
            <button class="col-menu" @click.stop="openColMenu(col, $event)">⋮</button>
            <!-- Меню столбца -->
            <div v-if="openedColMenuId === col.id" class="context-menu" :style="colMenuStyle">
              <button class="menu-item" @click="startRenameCol(col)">Переименовать</button>
              <button class="menu-item" @click="startChangeTypeCol(col)">Изменить тип</button>
              <button class="menu-item danger" @click="deleteColumn(col)">Удалить</button>
            </div>
          </th>
          <th>
            <button class="add-col" @click="showAddColModal = true">+</button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td v-for="col in columns" :key="col.id">
            <TableCell
              :rowId="row.id"
              :column="col"
              :cellValues="cellValues"
              @update="val => saveCellValue(row.id, col.id, val)"
            />
          </td>
          <td>
            <button class="row-menu" @click.stop="openRowMenu(row, $event)">⋮</button>
            <!-- Меню строки -->
            <div v-if="openedRowMenuId === row.id" class="context-menu" :style="rowMenuStyle">
              <button class="menu-item danger" @click="deleteRow(row)">Удалить</button>
            </div>
          </td>
        </tr>
        <tr>
          <td :colspan="columns.length + 1">
            <button class="add-row" @click="addRow">+ Добавить строку</button>
          </td>
        </tr>
      </tbody>
    </table>
    <!-- Оверлей для закрытия меню по клику вне -->
    <div v-if="openedColMenuId || openedRowMenuId" class="menu-overlay" @click="closeMenus"></div>
    <!-- Модалка добавления столбца -->
    <div v-if="showAddColModal" class="modal-backdrop">
      <div class="modal add-col-modal">
        <h4>Добавить столбец</h4>
        <label>Название</label>
        <input v-model="newColName" class="notion-input" placeholder="Название столбца" />
        <label>Тип</label>
        <select v-model="newColType" class="notion-input">
          <option value="text">Текст</option>
          <option value="number">Число</option>
          <option value="tags">Теги</option>
        </select>
        <label>Назначение столбца</label>
        <select v-model="newColPurpose" class="notion-input">
          <option value="">— Не выбрано —</option>
          <option value="question">Это столбец с вопросами</option>
          <option value="answer">Это столбец с ответами</option>
          <option value="clarifyingAnswer">Ответ с уточняющим вопросом</option>
          <option value="objectionAnswer">Ответ на возражение</option>
          <option value="userTags">Это столбец с тегами пользователей</option>
          <option value="context">Это столбец с дополнительным контекстом</option>
          <option value="product">Это столбец с продуктом/услугой</option>
          <option value="priority">Это столбец с приоритетом</option>
          <option value="date">Это столбец с датой</option>
        </select>
        <div v-if="newColType === 'tags'">
          <label>Выберите теги</label>
          <div class="tags-multiselect">
            <div v-for="tag in tags" :key="tag.id" class="tag-option">
              <input type="checkbox" :id="'tag-' + tag.id" :value="tag.id" v-model="selectedTagIds" />
              <label :for="'tag-' + tag.id">{{ tag.name }}</label>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="save-btn" @click="handleAddColumn">Добавить</button>
          <button class="cancel-btn" @click="closeAddColModal">Отмена</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import tablesService from '../../services/tablesService';
import TableCell from './TableCell.vue';

const props = defineProps({ tableId: Number });
const columns = ref([]);
const rows = ref([]);
const cellValues = ref([]);
const tableMeta = ref(null);

// Для модалки добавления столбца
const showAddColModal = ref(false);
const newColName = ref('');
const newColType = ref('text');
const tags = ref([]);
const selectedTagIds = ref([]);
const newColPurpose = ref("");

// Меню столбца
const openedColMenuId = ref(null);
const openedRowMenuId = ref(null);
const colMenuStyle = ref('');
const rowMenuStyle = ref('');

function closeAddColModal() {
  showAddColModal.value = false;
  newColName.value = '';
  newColType.value = 'text';
  selectedTagIds.value = [];
  newColPurpose.value = '';
}

async function handleAddColumn() {
  if (!newColName.value) return;
  const data = { name: newColName.value, type: newColType.value };
  if (newColType.value === 'tags') {
    data.tagIds = selectedTagIds.value;
  }
  if (newColPurpose.value) {
    data.purpose = newColPurpose.value;
  }
  await tablesService.addColumn(props.tableId, data);
  closeAddColModal();
  fetchTable();
}

async function loadTags() {
  const res = await fetch('/api/tags');
  tags.value = await res.json();
}

onMounted(() => {
  fetchTable();
  loadTags();
});

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
  showAddColModal.value = true;
}
function addRow() {
  tablesService.addRow(props.tableId).then(fetchTable);
}
function openColMenu(col, event) {
  openedColMenuId.value = col.id;
  openedRowMenuId.value = null;
  setMenuPosition(event, colMenuStyle);
}
function openRowMenu(row, event) {
  openedRowMenuId.value = row.id;
  openedColMenuId.value = null;
  setMenuPosition(event, rowMenuStyle);
}
function closeMenus() {
  openedColMenuId.value = null;
  openedRowMenuId.value = null;
}
function setMenuPosition(event, styleRef) {
  // Позиционируем меню под кнопкой
  const rect = event.target.getBoundingClientRect();
  styleRef.value = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;z-index:2000;`;
}
// Действия меню столбца
function startRenameCol(col) {
  closeMenus();
  editColumn(col);
}
function startChangeTypeCol(col) {
  closeMenus();
  // TODO: реализовать смену типа столбца (можно открыть модалку выбора типа)
  alert('Изменение типа столбца пока не реализовано');
}

// Загрузка данных
async function fetchTable() {
  const data = await tablesService.getTable(props.tableId);
  columns.value = data.columns;
  rows.value = data.rows;
  cellValues.value = data.cellValues;
  tableMeta.value = { name: data.name, description: data.description };
}

function saveCellValue(rowId, columnId, value) {
  tablesService.saveCell({ row_id: rowId, column_id: columnId, value }).then(fetchTable);
}

function deleteRow(row) {
  if (confirm('Удалить эту строку?')) {
    tablesService.deleteRow(row.id).then(fetchTable);
  }
}
function deleteColumn(col) {
  if (confirm('Удалить этот столбец?')) {
    tablesService.deleteColumn(col.id).then(fetchTable);
  }
}
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
.modal-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.18);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.13);
  padding: 2em 2em 1.5em 2em;
  min-width: 320px;
  max-width: 95vw;
}
.add-col-modal label {
  font-weight: 500;
  margin-top: 0.7em;
  display: block;
}
.add-col-modal input,
.add-col-modal select {
  width: 100%;
  border: 1px solid #ececec;
  border-radius: 7px;
  padding: 0.5em 0.8em;
  font-size: 1em;
  background: #fafbfc;
  margin-bottom: 0.7em;
}
.tags-multiselect {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em 1.2em;
  margin-bottom: 1em;
}
.tag-option {
  display: flex;
  align-items: center;
  gap: 0.3em;
}
.save-btn {
  background: #2ecc40;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.5em 1.2em;
  font-weight: 600;
  cursor: pointer;
  margin-right: 0.7em;
  transition: background 0.2s;
}
.save-btn:hover {
  background: #27ae38;
}
.cancel-btn {
  background: #eaeaea;
  color: #333;
  border: none;
  border-radius: 8px;
  padding: 0.5em 1.2em;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.cancel-btn:hover {
  background: #d5d5d5;
}
.th-col {
  position: relative;
}
.delete-col-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  background: none;
  border: none;
  color: #ff4d4f;
  font-size: 1.1em;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}
.th-col:hover .delete-col-btn {
  opacity: 1;
}
.delete-row-btn {
  background: none;
  border: none;
  color: #ff4d4f;
  font-size: 1.1em;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}
tr:hover .delete-row-btn {
  opacity: 1;
}
.context-menu {
  background: #fff;
  border: 1px solid #ececec;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.13);
  min-width: 150px;
  padding: 0.3em 0.2em;
  display: flex;
  flex-direction: column;
  position: fixed;
  z-index: 2001;
}
.menu-item {
  background: none;
  border: none;
  text-align: left;
  padding: 0.6em 1.1em;
  font-size: 1em;
  color: #222;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.18s;
}
.menu-item:hover {
  background: #f2f8f4;
}
.menu-item.danger {
  color: #ff4d4f;
}
.menu-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1999;
}
</style> 