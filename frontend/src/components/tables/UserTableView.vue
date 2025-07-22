<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <div class="user-table-header" v-if="tableMeta">
    <h2>{{ tableMeta.name }}</h2>
    <div class="table-desc">{{ tableMeta.description }}</div>
    <div class="table-header-actions" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 8px; margin-bottom: 18px;">
      <el-button type="danger" :disabled="!selectedRows.length" @click="deleteSelectedRows">Удалить выбранные</el-button>
      <span v-if="selectedRows.length">Выбрано: {{ selectedRows.length }}</span>
      <button v-if="isAdmin" class="rebuild-btn" @click="rebuildIndex" :disabled="rebuilding">
        {{ rebuilding ? 'Пересборка...' : 'Пересобрать индекс' }}
      </button>
      <el-button @click="resetFilters" type="default" icon="el-icon-refresh">Сбросить фильтры</el-button>
      <template v-for="def in relationFilterDefs" :key="def.col.id">
        <el-select
          v-model="relationFilters[def.filterKey]"
          :multiple="def.isMulti"
          filterable
          clearable
          :placeholder="def.col.name"
          style="min-width: 180px;"
        >
          <el-option v-for="opt in def.options" :key="opt.id" :label="opt.display" :value="opt.id" />
        </el-select>
      </template>
    </div>
    <span v-if="rebuildStatus" :class="['rebuild-status', rebuildStatus.success ? 'success' : 'error']">
      {{ rebuildStatus.message }}
    </span>
  </div>
  <!-- Удаляю .table-filters-el -->
  <div class="notion-table-wrapper">
    <el-table
      :data="filteredRows"
      border
      style="width: 100%"
      :header-cell-style="{ background: '#f3f4f6', fontWeight: 600 }"
      :cell-style="{ whiteSpace: 'normal', wordBreak: 'break-word', minWidth: '80px' }"
      :row-class-name="() => 'el-table-row-custom'"
      row-key="id"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="48" fixed="left" />
      <el-table-column
        v-for="col in columns"
        :key="col.id"
        :prop="'col_' + col.id"
        :label="col.name"
        :resizable="true"
        :min-width="120"
        :show-overflow-tooltip="false"
      >
        <template #header="{ column }">
          <template v-if="editingCol && editingCol.id === col.id">
            <input v-model="colEditValue" class="notion-input" style="width: 90px; display: inline-block;" @keyup.enter="saveColEdit(col)" />
            <button class="save-btn" @click="saveColEdit(col)">Сохранить</button>
            <button class="cancel-btn" @click="cancelColEdit">Отмена</button>
          </template>
          <template v-else>
            <span>{{ col.name }}</span>
            <button class="col-menu" @click.stop="openColMenu(col, $event)">⋮</button>
          </template>
        </template>
        <template #default="{ row }">
          <TableCell
            :rowId="row.id"
            :column="col"
            :cellValues="cellValues"
            @update="val => saveCellValue(row.id, col.id, val)"
          />
        </template>
      </el-table-column>
      <!-- Было два столбца: один для плюса, один для ⋮. Теперь объединяем: -->
      <el-table-column
        label=""
        width="48"
        align="center"
        fixed="right"
        class-name="add-col-header"
        :resizable="false"
      >
        <template #header>
          <button class="add-col-btn" @click="addColumn" title="Добавить столбец">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="10" fill="#f3f4f6" stroke="#b6c6e6"/>
              <rect x="10" y="5.5" width="2" height="11" rx="1" fill="#4f8cff"/>
              <rect x="5.5" y="10" width="11" height="2" rx="1" fill="#4f8cff"/>
            </svg>
          </button>
        </template>
        <template #default="{ row }">
          <button class="row-menu" @click.stop="openRowMenu(row, $event)">⋮</button>
          <teleport to="body">
            <div v-if="openedRowMenuId === row.id" class="context-menu" :style="rowMenuStyle">
              <button class="menu-item" @click="addRowAfter(row)">Добавить строку</button>
              <button class="menu-item" @click="moveRowUp(row)" :disabled="rows.findIndex(r => r.id === row.id) === 0">Переместить вверх</button>
              <button class="menu-item" @click="moveRowDown(row)" :disabled="rows.findIndex(r => r.id === row.id) === rows.length - 1">Переместить вниз</button>
              <button class="menu-item danger" @click="deleteRow(row)">Удалить</button>
            </div>
          </teleport>
        </template>
      </el-table-column>
    </el-table>
    <teleport to="body">
      <div v-if="openedColMenuId" class="context-menu" :style="colMenuStyle">
        <button class="menu-item" @click="editColumn(columns.find(c => c.id === openedColMenuId))">Редактировать</button>
        <button class="menu-item danger" @click="deleteColumn(columns.find(c => c.id === openedColMenuId))">Удалить</button>
        <!-- <button class="menu-item" @click="addColumn">Добавить столбец</button> -->
      </div>
    </teleport>
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
          <option value="multiselect">Мультивыбор</option>
          <option value="multiselect-relation">Мультивыбор из таблицы</option>
          <option value="relation">Связь (relation)</option>
          <option value="lookup">Lookup</option>
        </select>
        <div v-if="newColType === 'relation' || newColType === 'lookup' || newColType === 'multiselect-relation'">
          <label>Связанная таблица</label>
          <select v-model="relatedTableId" class="notion-input">
            <option v-for="tbl in allTables" :key="tbl.id" :value="tbl.id">{{ tbl.name }}</option>
          </select>
          <label>Связанный столбец</label>
          <select v-model="relatedColumnId" class="notion-input">
            <option v-for="col in relatedTableColumns" :key="col.id" :value="col.id">{{ col.name }}</option>
          </select>
        </div>
        <div v-if="newColType === 'multiselect'">
          <label>Опции для мультивыбора (через запятую)</label>
          <input v-model="multiOptionsInput" class="notion-input" placeholder="например: VIP, B2B, Startup" />
        </div>
        <label>Плейсхолдер</label>
        <input v-model="newColPlaceholder" class="notion-input" placeholder="Плейсхолдер (авто)" />
        <!-- Удаляю блок назначения столбца -->
        <div class="modal-actions">
          <button class="save-btn" @click="handleAddColumn">Добавить</button>
          <button class="cancel-btn" @click="closeAddColModal">Отмена</button>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import tablesService from '../../services/tablesService';
import TableCell from './TableCell.vue';
import { useAuthContext } from '@/composables/useAuth';
import axios from 'axios';
// Импортируем компоненты Element Plus
import { ElSelect, ElOption, ElButton } from 'element-plus';
const { isAdmin } = useAuthContext();
const rebuilding = ref(false);
const rebuildStatus = ref(null);

const props = defineProps({ tableId: Number });
const columns = ref([]);
const rows = ref([]);
const cellValues = ref([]);
const tableMeta = ref(null);

// Фильтры
// Удаляю selectedProduct и productOptions
// const selectedProduct = ref('');
// const productOptions = ref([]);
const filteredRows = ref([]);
const selectedRows = ref([]);
function handleSelectionChange(val) {
  selectedRows.value = val;
}
async function deleteSelectedRows() {
  if (!selectedRows.value.length) return;
  if (!confirm(`Удалить выбранные строки (${selectedRows.value.length})?`)) return;
  for (const row of selectedRows.value) {
    await tablesService.deleteRow(row.id);
  }
  selectedRows.value = [];
  await fetchTable();
}

// Для модалки добавления столбца
const showAddColModal = ref(false);
const newColName = ref('');
const newColType = ref('text');
const tags = ref([]);
const selectedTagIds = ref([]);
const allTables = ref([]);
const relatedTableId = ref(null);
const relatedColumnId = ref(null);
const relatedTableColumns = ref([]);
const newColPlaceholder = ref('');
const multiOptionsInput = ref('');

// Новые фильтры по relation/multiselect/lookup
const relationFilters = ref({});
const relationFilterDefs = ref([]);

watch(newColType, async (val) => {
  if (val === 'relation' || val === 'lookup' || val === 'multiselect-relation') {
    // Загрузить все таблицы
    const tables = await tablesService.getTables();
    allTables.value = tables;
    relatedTableId.value = tables[0]?.id || null;
  }
});
watch(relatedTableId, async (val) => {
  if (val) {
    const table = await tablesService.getTable(val);
    relatedTableColumns.value = table.columns;
    relatedColumnId.value = table.columns[0]?.id || null;
  }
});
watch(newColName, async (val) => {
  // Получить плейсхолдер с бэка
  if (!val) { newColPlaceholder.value = ''; return; }
  try {
    // Имитация генерации плейсхолдера (можно заменить на API)
    newColPlaceholder.value = val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  } catch { newColPlaceholder.value = ''; }
});

// Автоматизация для столбца 'Теги клиентов'
watch([newColType, selectedTagIds], async ([type, tagIds]) => {
  if ((type === 'relation' || type === 'multiselect') && tagIds.length > 0) {
    // Найти или создать таблицу 'Теги клиентов'
    let tables = await tablesService.getTables();
    let tagsTable = tables.find(t => t.name === 'Теги клиентов');
    if (!tagsTable) {
      tagsTable = await tablesService.createTable({
        name: 'Теги клиентов',
        description: 'Справочник тегов для контактов',
        isRagSourceId: 2
      });
      tables = await tablesService.getTables();
    }
    relatedTableId.value = tagsTable.id;
    // Получить первый столбец (название тега)
    const tagTable = await tablesService.getTable(tagsTable.id);
    relatedTableColumns.value = tagTable.columns;
    relatedColumnId.value = tagTable.columns[0]?.id || null;
  }
});

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
  newColPlaceholder.value = '';
  multiOptionsInput.value = '';
}

async function handleAddColumn() {
  if (!newColName.value) return;
  const data = { name: newColName.value, type: newColType.value };
  const options = {};
  if (newColType.value === 'tags') {
    data.tagIds = selectedTagIds.value;
    options.tagIds = selectedTagIds.value;
  }
  if (newColType.value === 'multiselect') {
    options.options = multiOptionsInput.value.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (newColType.value === 'multiselect-relation') {
    options.relatedTableId = relatedTableId.value;
    options.relatedColumnId = relatedColumnId.value;
  }
  if (newColType.value === 'relation' || newColType.value === 'lookup') {
    options.relatedTableId = relatedTableId.value;
    options.relatedColumnId = relatedColumnId.value;
  }
  if (Object.keys(options).length > 0) {
    data.options = options;
  }
  if (newColPlaceholder.value) {
    data.placeholder = newColPlaceholder.value;
  }
  await tablesService.addColumn(props.tableId, data);
  closeAddColModal();
  await fetchTable();
  await updateRelationFilterDefs(); // Явно обновляем фильтры
  window.dispatchEvent(new Event('placeholders-updated'));
}

async function deleteColumn(col) {
  // Можно добавить подтверждение
  if (!confirm(`Удалить столбец "${col.name}"?`)) return;
  await tablesService.deleteColumn(col.id);
  await fetchTable();
  await updateRelationFilterDefs(); // Явно обновляем фильтры
  window.dispatchEvent(new Event('placeholders-updated'));
}

// Удаляю все переменные, функции и UI, связанные с tags, tagOptions, selectedTags, loadTags, updateFilterOptions с tags, и т.д.

function parseIfArray(val) {
  if (typeof val === 'string') {
    // Попытка распарсить как JSON-массив
    try {
      const arr = JSON.parse(val);
      if (Array.isArray(arr)) return arr.map(String);
    } catch {}
    // Попытка распарсить как строку-объект вида {"49","47"}
    if (/^\{.*\}$/.test(val)) {
      return val.replace(/[{}\s]/g, '').split(',').map(s => s.replace(/"/g, ''));
    }
    // Если просто строка с числом/id
    if (val.trim().length > 0) return [val.trim()];
    return [];
  }
  if (Array.isArray(val)) return val.map(String);
  if (val && typeof val === 'number') return [String(val)];
  return [];
}
// Загрузка данных с фильтрацией
async function fetchFilteredRows() {
  const params = new URLSearchParams();
  for (const def of relationFilterDefs.value) {
    const val = relationFilters.value[def.filterKey];
    if (val && (Array.isArray(val) ? val.length : true)) {
      params.append(def.filterKey, Array.isArray(val) ? val.join(',') : val);
    }
  }
  console.log('fetchFilteredRows params:', params.toString()); // Для отладки
  const data = await tablesService.getFilteredRows(props.tableId, params);
  // Локальная фильтрация по multiselect-relation (если backend не фильтрует)
  filteredRows.value = data.filter(row => {
    let ok = true;
    for (const def of relationFilterDefs.value) {
      const filterVal = relationFilters.value[def.filterKey];
      if (!filterVal || (Array.isArray(filterVal) && !filterVal.length)) continue;
      // Найти ячейку для этого столбца
      const cell = cellValues.value.find(c => c.row_id === row.id && c.column_id === def.col.id);
      const cellArr = parseIfArray(cell ? cell.value : []);
      // filterVal может быть массивом (multi) или строкой
      const filterArr = Array.isArray(filterVal) ? filterVal : [filterVal];
      // Если хотя бы одно значение фильтра есть в массиве ячейки — строка проходит
      if (!filterArr.some(val => cellArr.includes(val))) {
        ok = false;
        break;
      }
    }
    return ok;
  });
}

// Основная загрузка таблицы
async function fetchTable() {
  const data = await tablesService.getTable(props.tableId);
  columns.value = data.columns;
  rows.value = data.rows;
  cellValues.value = data.cellValues;
  tableMeta.value = { name: data.name, description: data.description };
  await updateRelationFilterDefs();
  await fetchFilteredRows();
}

async function updateRelationFilterDefs() {
  // Для каждого multiselect-relation-столбца формируем опции
  const defs = [];
  for (const col of columns.value) {
    if (col.type === 'multiselect-relation' && col.options && col.options.relatedTableId && col.options.relatedColumnId) {
      // Собираем все уникальные id из этого столбца по всем строкам
      const idsSet = new Set();
      for (const row of rows.value) {
        const cell = cellValues.value.find(c => c.row_id === row.id && c.column_id === col.id);
        const arr = parseIfArray(cell ? cell.value : []);
        arr.forEach(val => idsSet.add(val));
      }
      // Получаем значения из связанной таблицы
      const relTable = await tablesService.getTable(col.options.relatedTableId);
      const opts = Array.from(idsSet).map(id => {
        const relRow = relTable.rows.find(r => String(r.id) === String(id));
        const cell = relTable.cellValues.find(c => c.row_id === (relRow ? relRow.id : id) && c.column_id === col.options.relatedColumnId);
        return { id, display: cell ? cell.value : `ID ${id}` };
      });
      defs.push({
        col,
        filterKey: `multiselect-relation_${col.id}`,
        isMulti: true,
        options: opts
      });
    }
  }
  console.log('relationFilterDefs:', defs); // Для отладки
  relationFilterDefs.value = defs;
}

// Сброс фильтров
function resetFilters() {
  // selectedProduct.value = '';
  relationFilters.value = {};
  fetchFilteredRows();
}

watch([relationFilters], fetchFilteredRows, { deep: true });

onMounted(() => {
  fetchTable();
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

async function saveCellValue(rowId, colId, value) {
  await tablesService.saveCell({ row_id: rowId, column_id: colId, value });
  await fetchTable();
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
function addRowAfter(row) {
  tablesService.addRow(props.tableId, row.id).then(fetchTable);
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
  styleRef.value = `top: ${rect.bottom + window.scrollY}px; left: ${rect.left + window.scrollX}px;`;
}

async function deleteRow(row) {
  // Можно добавить подтверждение
  if (!confirm(`Удалить строку с ID ${row.id}?`)) return;
  await tablesService.deleteRow(row.id);
  await fetchTable();
}

async function saveRowsOrder() {
  // Сохраняем новый порядок строк на сервере
  const orderArr = rows.value.map((row, idx) => ({ rowId: row.id, order: idx + 1 }));
  await tablesService.updateRowsOrder(props.tableId, orderArr);
}

function moveRowUp(row) {
  const idx = rows.value.findIndex(r => r.id === row.id);
  if (idx > 0) {
    const temp = rows.value[idx - 1];
    rows.value[idx - 1] = rows.value[idx];
    rows.value[idx] = temp;
    saveRowsOrder();
    fetchTable();
  }
}
function moveRowDown(row) {
  const idx = rows.value.findIndex(r => r.id === row.id);
  if (idx < rows.value.length - 1) {
    const temp = rows.value[idx + 1];
    rows.value[idx + 1] = rows.value[idx];
    rows.value[idx] = temp;
    saveRowsOrder();
    fetchTable();
  }
}

async function rebuildIndex() {
  rebuilding.value = true;
  rebuildStatus.value = null;
  try {
    const result = await tablesService.rebuildIndex(props.tableId);
    rebuildStatus.value = { success: true, message: `Индекс успешно пересобран (${result.count || 0} строк)` };
    await fetchTable();
  } catch (e) {
    let msg = 'Ошибка пересборки индекса';
    if (e?.response?.data?.error) msg += `: ${e.response.data.error}`;
    rebuildStatus.value = { success: false, message: msg };
  } finally {
    rebuilding.value = false;
  }
}

</script>

<style scoped>
.user-table-header {
  /* max-width: 1100px; */
  margin: 0 auto 0 auto;
  /* padding: 32px 24px 18px 24px; */
  /* background: #fff; */
  /* border-radius: 18px; */
  /* box-shadow: 0 4px 24px rgba(0,0,0,0.08); */
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.user-table-header h2 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 4px 0;
  letter-spacing: 0.5px;
}
.table-desc {
  color: #6b7280;
  font-size: 1.08rem;
  margin-bottom: 6px;
}
.rebuild-btn {
  background: #4f8cff;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 1rem;
  margin-top: 8px;
  cursor: pointer;
  transition: background 0.2s;
}
.rebuild-btn:disabled {
  background: #b6c6e6;
  cursor: not-allowed;
}
.rebuild-btn:not(:disabled):hover {
  background: #2563eb;
}
.rebuild-status {
  margin-top: 6px;
  font-size: 1rem;
  font-weight: 500;
}
.rebuild-status.success { color: #22c55e; }
.rebuild-status.error { color: #ef4444; }

.table-filters-el {
  display: flex;
  gap: 16px;
  align-items: center;
  margin: 18px auto 0 auto;
  max-width: 1100px;
  padding: 0 24px;
}

.notion-table-wrapper {
  /* max-width: 1100px; */
  margin: 0 auto 0 auto;
  /* background: #fff; */
  /* border-radius: 6px; */
  /* box-shadow: 0 1px 4px rgba(0,0,0,0.04); */
  /* padding: 12px 6px 18px 6px; */
}

.el-table__cell, .el-table th, .el-table td {
  height: auto !important;
  min-height: 36px;
  white-space: normal !important;
  word-break: break-word !important;
  min-width: 80px;
  max-width: 600px;
}
.el-table-row-custom {
  /* Можно добавить стили для высоты строк, если нужно */
}

.notion-input {
  width: 100%;
  padding: 4px 7px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  font-size: 0.98rem;
  background: #fff;
  transition: border 0.2s;
}

.notion-input:focus {
  border-color: #4f8cff;
  outline: none;
}

.add-row, .add-col, .save-btn, .cancel-btn, .rebuild-btn {
  background: #f3f4f6;
  color: #222;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 5px 12px;
  font-size: 0.98rem;
  cursor: pointer;
  transition: background 0.18s, border 0.18s;
  margin: 0 2px;
}

.add-row:hover, .add-col:hover, .save-btn:hover, .cancel-btn:hover, .rebuild-btn:hover {
  background: #e5e7eb;
  border-color: #b6c6e6;
}

.col-menu, .row-menu {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  color: #6b7280;
  padding: 2px 6px;
  border-radius: 3px;
  transition: background 0.15s;
}

.col-menu:hover, .row-menu:hover {
  background: #e5e7eb;
  color: #1d4ed8;
}

.context-menu {
  position: absolute;
  z-index: 2000;
  min-width: 120px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  padding: 4px 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.menu-item {
  background: none;
  border: none;
  text-align: left;
  padding: 7px 14px;
  font-size: 0.98rem;
  color: #222;
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.13s;
}

.menu-item:hover {
  background: #f5f7fa;
}

.menu-item.danger {
  color: #ef4444;
}

.menu-item.danger:hover {
  background: #fee2e2;
}

.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 5;
  background: transparent;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.10);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.10);
  padding: 18px 16px 14px 16px;
  min-width: 320px;
  max-width: 98vw;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.modal h4 {
  margin: 0 0 6px 0;
  font-size: 1.08rem;
  font-weight: 600;
}

.modal label {
  font-size: 0.98rem;
  color: #374151;
  margin-bottom: 1px;
}

.modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.notion-table td:empty::after {
  content: '—';
  color: #b0b0b0;
  font-style: italic;
}

.add-col-header .add-col-btn {
  background: none;
  border: none;
  padding: 0;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.18s;
}
.add-col-header .add-col-btn:hover svg circle {
  fill: #e5e7eb;
  stroke: #4f8cff;
}
.add-col-header .add-col-btn:active svg circle {
  fill: #dbeafe;
}

@media (max-width: 700px) {
  .notion-table-wrapper, .table-filters-el {
    padding: 4px 1vw;
    max-width: 100vw;
  }
  .modal {
    min-width: 90vw;
    padding: 10px 2vw;
  }
  .notion-table th, .notion-table td {
    padding: 4px 2px;
    font-size: 0.95rem;
  }
}
</style>