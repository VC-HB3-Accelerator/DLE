<template>
  <div class="user-table-header" v-if="tableMeta">
    <h2>{{ tableMeta.name }}</h2>
    <div class="table-desc">{{ tableMeta.description }}</div>
    <button v-if="isAdmin" class="rebuild-btn" @click="rebuildIndex" :disabled="rebuilding">
      {{ rebuilding ? 'Пересборка...' : 'Пересобрать индекс' }}
    </button>
    <span v-if="rebuildStatus" :class="['rebuild-status', rebuildStatus.success ? 'success' : 'error']">
      {{ rebuildStatus.message }}
    </span>
  </div>
  <!-- Фильтры на Element Plus -->
  <div class="table-filters-el" v-if="relationFilterDefs.length">
    <!-- Только фильтры по multiselect-relation -->
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
    <el-button @click="resetFilters" type="default" icon="el-icon-refresh">Сбросить фильтры</el-button>
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
        <tr v-for="row in filteredRows" :key="row.id">
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
}

async function deleteColumn(col) {
  // Можно добавить подтверждение
  if (!confirm(`Удалить столбец "${col.name}"?`)) return;
  await tablesService.deleteColumn(col.id);
  await fetchTable();
  await updateRelationFilterDefs(); // Явно обновляем фильтры
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
  max-width: 1100px;
  margin: 32px auto 0 auto;
  padding: 32px 24px 18px 24px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
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
  max-width: 1100px;
  margin: 24px auto 0 auto;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  padding: 12px 6px 18px 6px;
}

.notion-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.98rem;
  background: #fff;
}

.notion-table th, .notion-table td {
  border: 1px solid #e5e7eb;
  padding: 6px 10px;
  text-align: left;
  background: #fff;
  font-size: 0.98rem;
  min-width: 80px;
}

.notion-table th {
  background: #f3f4f6;
  font-weight: 600;
  border-bottom: 2px solid #d1d5db;
  border-top: 1px solid #e5e7eb;
  padding-top: 7px;
  padding-bottom: 7px;
}

.notion-table tr:hover td {
  background: #f5f7fa;
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
  z-index: 10;
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