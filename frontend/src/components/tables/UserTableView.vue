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
  <div class="user-table-header" v-if="tableMeta">
    <h2>{{ tableMeta.name }}</h2>
    <div class="table-desc">{{ tableMeta.description }}</div>
    <div class="table-header-actions btn-row">
      <button
        v-if="canEditData"
        type="button"
        class="btn btn-danger"
        :disabled="!selectedRows.length"
        @click="deleteSelectedRows"
      >{{ t('tables.common.deleteSelected') }}</button>
      <span v-if="selectedRows.length" class="selection-hint">{{ t('tables.common.selected', { count: selectedRows.length }) }}</span>
      <button
        v-if="canEditData"
        type="button"
        class="btn btn-primary"
        @click="rebuildIndex"
        :disabled="rebuilding"
      >
        {{ rebuilding ? t('tables.common.rebuilding') : t('tables.common.rebuildIndex') }}
      </button>
      <button type="button" class="btn btn-outline" @click="resetFilters">{{ t('tables.common.resetFilters') }}</button>
      <template v-for="def in relationFilterDefs" :key="def.col.id">
        <el-select
          v-model="relationFilters[def.filterKey]"
          :multiple="def.isMulti"
          filterable
          clearable
          :placeholder="def.col.name"
          class="relation-filter-select"
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
            <button type="button" class="btn btn-primary btn-sm" @click="saveColEdit(col)">{{ t('tables.common.save') }}</button>
            <button type="button" class="btn btn-outline btn-sm" @click="cancelColEdit">{{ t('tables.common.cancel') }}</button>
          </template>
          <template v-else>
            <span>{{ col.name }}</span>
            <button v-if="canEditData" class="col-menu" @click.stop="openColMenu(col, $event)">⋮</button>
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
          <button v-if="canEditData" class="add-col-btn" @click.stop="openAddMenu($event)" :title="t('tables.common.add')">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="10" fill="var(--theme-surface)" stroke="currentColor"/>
              <rect x="10" y="5.5" width="2" height="11" rx="1" fill="currentColor"/>
              <rect x="5.5" y="10" width="11" height="2" rx="1" fill="currentColor"/>
            </svg>
          </button>
          <teleport to="body">
            <div v-if="showAddMenu" class="context-menu" :style="addMenuStyle">
              <button class="menu-item" @click="addColumn">{{ t('tables.common.addColumn') }}</button>
              <button class="menu-item" @click="addRow">{{ t('tables.common.addRow') }}</button>
            </div>
          </teleport>
        </template>
        <template #default="{ row }">
          <button v-if="canEditData" class="row-menu" @click.stop="openRowMenu(row, $event)">⋮</button>
          <teleport to="body">
            <div v-if="openedRowMenuId === row.id" class="context-menu" :style="rowMenuStyle">
              <button class="menu-item" @click="addRowAfter(row)">{{ t('tables.common.addRow') }}</button>
              <button class="menu-item" @click="moveRowUp(row)" :disabled="rows.findIndex(r => r.id === row.id) === 0">{{ t('tables.common.moveUp') }}</button>
              <button class="menu-item" @click="moveRowDown(row)" :disabled="rows.findIndex(r => r.id === row.id) === rows.length - 1">{{ t('tables.common.moveDown') }}</button>
              <button class="menu-item danger" @click="deleteRow(row)">{{ t('tables.common.delete') }}</button>
            </div>
          </teleport>
        </template>
      </el-table-column>
    </el-table>
    <teleport to="body">
      <div v-if="openedColMenuId" class="context-menu" :style="colMenuStyle">
        <button class="menu-item" @click="editColumn(columns.find(c => c.id === openedColMenuId))">{{ t('tables.common.edit') }}</button>
        <button class="menu-item danger" @click="deleteColumn(columns.find(c => c.id === openedColMenuId))">{{ t('tables.common.delete') }}</button>
        <!-- <button class="menu-item" @click="addColumn">Добавить столбец</button> -->
      </div>
    </teleport>
    <teleport to="body">
      <div
        v-if="openedColMenuId || openedRowMenuId || showAddMenu"
        class="menu-overlay"
        @click="closeMenus"
      ></div>
    </teleport>
    <!-- Модалка добавления столбца -->
    <div v-if="showAddColModal" class="modal-backdrop">
      <div class="modal add-col-modal">
        <h4>{{ t('tables.common.addColumn') }}</h4>
        <label>{{ t('tables.common.name') }}</label>
        <input v-model="newColName" class="notion-input" :placeholder="t('tables.common.columnName')" />
        <label>{{ t('tables.common.type') }}</label>
        <select v-model="newColType" class="notion-input">
          <option value="text">{{ t('tables.common.typeText') }}</option>
          <option value="number">{{ t('tables.common.typeNumber') }}</option>
          <option value="multiselect">{{ t('tables.common.typeMultiselect') }}</option>
          <option value="multiselect-relation">{{ t('tables.common.typeMultiselectRelation') }}</option>
          <option value="relation">{{ t('tables.common.typeRelation') }}</option>
          <option value="lookup">Lookup</option>
        </select>
        <div v-if="newColType === 'relation' || newColType === 'lookup' || newColType === 'multiselect-relation'">
          <label>{{ t('tables.common.relatedTable') }}</label>
          <select v-model="relatedTableId" class="notion-input">
            <option v-for="tbl in allTables" :key="tbl.id" :value="tbl.id">{{ tbl.name }}</option>
          </select>
          <label>{{ t('tables.common.relatedColumn') }}</label>
          <select v-model="relatedColumnId" class="notion-input">
            <option v-for="col in relatedTableColumns" :key="col.id" :value="col.id">{{ col.name }}</option>
          </select>
        </div>
        <div v-if="newColType === 'multiselect'">
          <label>{{ t('tables.common.multiselectOptions') }}</label>
          <input v-model="multiOptionsInput" class="notion-input" :placeholder="t('tables.common.multiselectOptionsPlaceholder')" />
        </div>
        <label>{{ t('tables.common.placeholder') }}</label>
        <input v-model="newColPlaceholder" class="notion-input" :placeholder="t('tables.common.placeholderAuto')" />
        <label>{{ t('tables.common.ragPurpose') }}</label>
        <select v-model="newColPurpose" class="notion-input">
          <option value="">{{ t('tables.common.noPurpose') }}</option>
          <option value="question">{{ t('tables.common.purposeQuestion') }}</option>
          <option value="answer">{{ t('tables.common.purposeAnswer') }}</option>
          <option value="product">{{ t('tables.common.purposeProduct') }}</option>
          <option value="userTags">{{ t('tables.common.purposeUserTags') }}</option>
          <option value="context">{{ t('tables.common.purposeContext') }}</option>
          <option value="priority">{{ t('tables.common.purposePriority') }}</option>
          <option value="date">{{ t('tables.common.purposeDate') }}</option>
        </select>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary btn-sm" @click="handleAddColumn">{{ t('tables.common.add') }}</button>
          <button type="button" class="btn btn-outline btn-sm" @click="closeAddColModal">{{ t('tables.common.cancel') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import tablesService from '../../services/tablesService';
import TableCell from './TableCell.vue';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import axios from 'axios';
import { getClientTagsTableMeta, findClientTagsTableInList } from '../../utils/clientTagsTable';

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    // Очищаем данные при выходе из системы
    tableData.value = [];
    columns.value = [];
  });
  
  window.addEventListener('refresh-application-data', () => {
    fetchTable(); // Обновляем данные при входе в систему
  });
});
// Импортируем компоненты Element Plus
import { ElSelect, ElOption } from 'element-plus';
import websocketService from '../../services/websocketService';
import cacheService from '../../services/cacheService';
import { useTagsWebSocket } from '../../composables/useTagsWebSocket';
let unsubscribeFromTableUpdate = null;
let unsubscribeFromTagsUpdate = null;

const { canEditData } = usePermissions();
const { t } = useI18n();
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
  if (!confirm(t('tables.common.confirmDeleteRows', { count: selectedRows.value.length }))) return;
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
const newColPurpose = ref('');

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

// Автоматизация для столбца тегов клиентов
watch([newColType, selectedTagIds], async ([type, tagIds]) => {
  if ((type === 'relation' || type === 'multiselect') && tagIds.length > 0) {
    const tagsMeta = getClientTagsTableMeta();
    // Найти или создать таблицу тегов клиентов
    let tables = await tablesService.getTables();
    let tagsTable = findClientTagsTableInList(tables);
    if (!tagsTable) {
      tagsTable = await tablesService.createTable({
        name: tagsMeta.name,
        description: tagsMeta.description,
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

// Меню добавления
const showAddMenu = ref(false);
const addMenuStyle = ref('');

function closeAddColModal() {
  showAddColModal.value = false;
  newColName.value = '';
  newColType.value = 'text';
  selectedTagIds.value = [];
  newColPlaceholder.value = '';
  multiOptionsInput.value = '';
  newColPurpose.value = '';
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
  if (newColPurpose.value) {
    options.purpose = newColPurpose.value;
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
  if (!confirm(t('tables.common.confirmDeleteColumn', { name: col.name }))) return;
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
      // console.log('fetchFilteredRows params:', params.toString()); // Для отладки
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
  const startTime = Date.now();
      // console.log(`[UserTableView] 🚀 Начало загрузки таблицы ${props.tableId} в ${startTime}`);
  
  const data = await tablesService.getTable(props.tableId);
  columns.value = data.columns;
  rows.value = data.rows;
  cellValues.value = data.cellValues;
  tableMeta.value = { name: data.name, description: data.description };
  
      // console.log(`[UserTableView] 📊 Загружено ${rows.value.length} строк, ${columns.value.length} столбцов`);
  
  // Предварительно загружаем все relations для всех строк параллельно
  const relationColumns = columns.value.filter(col => col.type === 'multiselect-relation');
  if (relationColumns.length > 0) {
    // console.log(`[UserTableView] 🔄 Предварительно загружаем relations для ${relationColumns.length} столбцов`);
    
    const relationPromises = [];
    for (const row of rows.value) {
      for (const col of relationColumns) {
        const promise = fetch(`/api/tables/${col.table_id}/row/${row.id}/relations`)
          .then(res => res.json())
          .then(relations => {
            // Сохраняем в кэш
            cacheService.setRelationsData(row.id, col.id, relations);
            return { rowId: row.id, colId: col.id, relations };
          })
          .catch(error => {
            // console.error(`[UserTableView] Ошибка загрузки relations для row:${row.id} col:${col.id}:`, error);
            return { rowId: row.id, colId: col.id, relations: [] };
          });
        relationPromises.push(promise);
      }
    }
    
    // Ждем загрузки всех relations
    const results = await Promise.all(relationPromises);
    // console.log(`[UserTableView] ✅ Предварительно загружено ${results.length} relations`);
  }
  
  // Предварительно загружаем данные связанных таблиц для опций
  const relatedTableIds = new Set();
  for (const col of relationColumns) {
    if (col.options && col.options.relatedTableId) {
      relatedTableIds.add(col.options.relatedTableId);
    }
  }
  
  if (relatedTableIds.size > 0) {
    // console.log(`[UserTableView] 🔄 Предварительно загружаем данные ${relatedTableIds.size} связанных таблиц для опций`);
    
    const tablePromises = Array.from(relatedTableIds).map(tableId => 
      fetch(`/api/tables/${tableId}`)
        .then(res => res.json())
        .then(tableData => {
          // Сохраняем в кэш с разными ключами для разных столбцов
          cacheService.setTableData(tableId, 'default', tableData);
          return { tableId, tableData };
        })
        .catch(error => {
          // console.error(`[UserTableView] Ошибка загрузки таблицы ${tableId}:`, error);
          return { tableId, tableData: null };
        })
    );
    
    const tableResults = await Promise.all(tablePromises);
    // console.log(`[UserTableView] ✅ Предварительно загружено ${tableResults.length} связанных таблиц`);
  }
  
  // Выполняем обновление фильтров и фильтрацию строк параллельно
  await Promise.all([
    updateRelationFilterDefs(),
    fetchFilteredRows()
  ]);
  
  // Выводим статистику кэша для отладки
  const cacheStats = cacheService.getStats();
      // console.log('[UserTableView] Статистика кэша после загрузки таблицы:', {
    //   tableCacheSize: cacheStats.tableCacheSize,
    //   relationsCacheSize: cacheStats.relationsCacheSize,
    //   tableCacheKeys: cacheStats.tableCacheKeys,
    //   relationsCacheKeys: cacheStats.relationsCacheKeys.slice(0, 5) // Показываем только первые 5 ключей
    // });
  
  const endTime = Date.now();
  // console.log(`[UserTableView] ✅ Завершена загрузка таблицы ${props.tableId} за ${endTime - startTime}ms`);
}

async function updateRelationFilterDefs() {
  const defs = [];
  const relatedTableMap = new Map();
  
  // Сначала собираем все уникальные relatedTableId и создаем промисы для параллельной загрузки
  for (const col of columns.value) {
    if (col.type === 'multiselect-relation' && col.options && col.options.relatedTableId && col.options.relatedColumnId) {
      const tableId = col.options.relatedTableId;
      if (!relatedTableMap.has(tableId)) {
        // Проверяем кэш
        const cached = cacheService.getTableData(tableId);
        if (cached) {
          // console.log(`[updateRelationFilterDefs] Используем кэшированные данные таблицы ${tableId}`);
          relatedTableMap.set(tableId, Promise.resolve(cached));
        } else {
          relatedTableMap.set(tableId, tablesService.getTable(tableId));
        }
      }
    }
  }
  
  // Загружаем все связанные таблицы параллельно
  const relatedTables = await Promise.all(Array.from(relatedTableMap.values()));
  
  // Создаем Map для быстрого доступа к загруженным таблицам
  const tableMap = new Map();
  let tableIndex = 0;
  for (const tableId of relatedTableMap.keys()) {
    const tableData = relatedTables[tableIndex++];
    tableMap.set(tableId, tableData);
    
    // Сохраняем в кэш, если это новые данные
    if (!cacheService.getTableData(tableId)) {
      cacheService.setTableData(tableId, 'default', tableData);
    }
  }

  // Теперь формируем опции фильтров
  for (const col of columns.value) {
    if (col.type === 'multiselect-relation' && col.options && col.options.relatedTableId && col.options.relatedColumnId) {
      // Собираем все уникальные id из этого столбца по всем строкам
      const idsSet = new Set();
      for (const row of rows.value) {
        const cell = cellValues.value.find(c => c.row_id === row.id && c.column_id === col.id);
        const arr = parseIfArray(cell ? cell.value : []);
        arr.forEach(val => idsSet.add(val));
      }
      
      // Получаем значения из связанной таблицы (уже загружена)
      const relTable = tableMap.get(col.options.relatedTableId);
      const opts = Array.from(idsSet).map(id => {
        const relRow = relTable.rows.find(r => String(r.id) === String(id));
        const cell = relTable.cellValues.find(c => c.row_id === (relRow ? relRow.id : id) && c.column_id === col.options.relatedColumnId);
        return { id, display: cell ? cell.value : t('tables.common.idFallback', { id }) };
      });
      defs.push({
        col,
        filterKey: `multiselect-relation_${col.id}`,
        isMulti: true,
        options: opts
      });
    }
  }
  // console.log('relationFilterDefs:', defs); // Для отладки
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
  // Подписка на WebSocket обновления таблицы
  unsubscribeFromTableUpdate = websocketService.onTableUpdate(props.tableId, () => {
    // console.log('[UserTableView] Получено событие table-updated, перезагружаем данные');
    // Очищаем кэш текущей таблицы
    cacheService.clearTableCache(props.tableId);
    fetchTable();
  });
  
  // Подписка на WebSocket обновления тегов
  const { onTagsUpdate } = useTagsWebSocket();
  // console.log('[UserTableView] Подписываемся на обновления тегов для таблицы:', props.tableId);
      // console.log('[UserTableView] onTagsUpdate функция:', typeof onTagsUpdate);
  unsubscribeFromTagsUpdate = onTagsUpdate(async (data) => {
          // console.log('[UserTableView] 🔔 ПОЛУЧЕНО СОБЫТИЕ TAGS-UPDATED!');
          // console.log('[UserTableView] Получено событие tags-updated, обновляем данные для таблицы:', props.tableId, data);
    
    // Если есть информация о конкретной строке, обновляем только её
    if (data && data.rowId) {
              // console.log('[UserTableView] Точечное обновление для строки:', data.rowId);
      try {
        // Очищаем кэш relations только для конкретной строки
        const tagColumns = columns.value.filter(col => 
          col.type === 'multirelation' && 
          col.options?.relatedTableId
        );
        
        for (const col of tagColumns) {
          cacheService.clearRelationsData(data.rowId, col.id);
        }
        
                  // console.log('[UserTableView] Кэш relations очищен для строки, обновляем данные строки:', data.rowId);
        
        // Обновляем только данные конкретной строки
        await updateRowData(data.rowId);
                  // console.log('[UserTableView] Данные строки обновлены:', data.rowId);
      } catch (error) {
                  // console.error('[UserTableView] Ошибка при точечном обновлении:', error);
        // Fallback: полная перезагрузка при ошибке
        await fetchTable();
      }
    } else {
      // Если нет информации о строке, используем старую логику
              // console.log('[UserTableView] Общее обновление тегов');
      try {
        // Очищаем кэш relations для всех строк этой таблицы
        const tableRows = rows.value || [];
        for (const row of tableRows) {
          // Находим колонки с мульти-связями (теги)
          const tagColumns = columns.value.filter(col => 
            col.type === 'multirelation' && 
            col.options?.relatedTableId
          );
          
          for (const col of tagColumns) {
            cacheService.clearRelationsData(row.id, col.id);
          }
        }
        
                  // console.log('[UserTableView] Кэш relations очищен, перезагружаем данные таблицы:', props.tableId);
        await fetchTable();
                  // console.log('[UserTableView] Данные таблицы перезагружены:', props.tableId);
      } catch (error) {
                  // console.error('[UserTableView] Ошибка при обновлении после tags-updated:', error);
        // Fallback: полная перезагрузка при ошибке
        cacheService.clearTableCache(props.tableId);
        await fetchTable();
      }
    }
  });
});

onUnmounted(() => {
  if (unsubscribeFromTableUpdate) {
    unsubscribeFromTableUpdate();
  }
  if (unsubscribeFromTagsUpdate) {
    unsubscribeFromTagsUpdate();
  }
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
  showAddMenu.value = false;
  setMenuPosition(event, colMenuStyle, { minWidth: 160, minHeight: 80 });
}
function openRowMenu(row, event) {
  openedRowMenuId.value = row.id;
  openedColMenuId.value = null;
  showAddMenu.value = false;
  setMenuPosition(event, rowMenuStyle, { minWidth: 200, minHeight: 160 });
}
function closeMenus() {
  openedColMenuId.value = null;
  openedRowMenuId.value = null;
  showAddMenu.value = false;
}

function openAddMenu(event) {
  showAddMenu.value = true;
  openedColMenuId.value = null;
  openedRowMenuId.value = null;
  setMenuPosition(event, addMenuStyle, { minWidth: 200, minHeight: 88 });
}
function setMenuPosition(event, styleRef, { minWidth = 200, minHeight = 96 } = {}) {
  // Кнопка или ближайший button (клик мог попасть в SVG внутри)
  const anchor =
    (event.currentTarget instanceof Element && event.currentTarget)
    || (event.target instanceof Element && event.target.closest('button'))
    || event.target;
  const rect = anchor.getBoundingClientRect();
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(minWidth, vw - pad * 2);

  // У правого края — открываем влево от якоря
  let left = rect.left;
  if (left + width > vw - pad) {
    left = rect.right - width;
  }
  left = Math.min(Math.max(pad, left), vw - width - pad);

  let top = rect.bottom + 4;
  if (top + minHeight > vh - pad) {
    top = Math.max(pad, rect.top - minHeight - 4);
  }

  styleRef.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${width}px`,
    maxWidth: `calc(100vw - ${pad * 2}px)`,
    zIndex: 3000,
  };
}

async function deleteRow(row) {
  // Можно добавить подтверждение
  if (!confirm(t('tables.common.confirmDeleteRowWithId', { id: row.id }))) return;
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
    rebuildStatus.value = { success: true, message: t('tables.common.indexRebuildSuccess', { count: result.count || 0 }) };
    await fetchTable();
  } catch (e) {
    let msg = t('tables.common.indexRebuildError');
    if (e?.response?.data?.error) msg += `: ${e.response.data.error}`;
    rebuildStatus.value = { success: false, message: msg };
  } finally {
    rebuilding.value = false;
  }
}

// Функция для точечного обновления данных конкретной строки
async function updateRowData(rowId) {
  const startTime = Date.now();
      // console.log(`[UserTableView] 🔄 Начало обновления данных строки ${rowId}`);
  
  try {
    // Находим строку в текущих данных
    const rowIndex = rows.value.findIndex(row => row.id === rowId);
    if (rowIndex === -1) {
      // console.log(`[UserTableView] Строка ${rowId} не найдена в текущих данных`);
      return;
    }
    
    // Загружаем relations только для этой строки
    const tagColumns = columns.value.filter(col => 
      col.type === 'multirelation' && 
      col.options?.relatedTableId
    );
    
    if (tagColumns.length > 0) {
      // console.log(`[UserTableView] 🔄 Загружаем relations для строки ${rowId} (${tagColumns.length} столбцов)`);
      
      const relationPromises = tagColumns.map(col => 
        fetch(`/api/tables/${col.table_id}/row/${rowId}/relations`)
          .then(res => res.json())
          .then(relations => {
            // Сохраняем в кэш
            cacheService.setRelationsData(rowId, col.id, relations);
            return { rowId, colId: col.id, relations };
          })
          .catch(error => {
            // console.error(`[UserTableView] Ошибка загрузки relations для row:${rowId} col:${col.id}:`, error);
            return { rowId, colId: col.id, relations: [] };
          })
      );
      
      await Promise.all(relationPromises);
      // console.log(`[UserTableView] ✅ Relations для строки ${rowId} обновлены`);
    }
    
    const endTime = Date.now();
    // console.log(`[UserTableView] ✅ Завершено обновление строки ${rowId} за ${endTime - startTime}ms`);
  } catch (error) {
          // console.error(`[UserTableView] ❌ Ошибка при обновлении строки ${rowId}:`, error);
    throw error;
  }
}

</script>

<style scoped>
.user-table-header {
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  max-width: 100%;
  box-sizing: border-box;
}
.user-table-header h2 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 4px 0;
  letter-spacing: 0.5px;
}
.table-desc {
  color: var(--theme-text-muted);
  font-size: 1.08rem;
  margin-bottom: 6px;
}
.table-header-actions {
  margin: var(--spacing-xs) 0 var(--spacing-md);
  max-width: 100%;
}
.table-header-actions .selection-hint {
  color: var(--theme-text-muted);
  font-size: var(--font-size-sm, 0.9rem);
  align-self: center;
}
.relation-filter-select {
  min-width: 180px;
  max-width: 100%;
}
.rebuild-status {
  margin-top: 6px;
  font-size: 1rem;
  font-weight: 500;
}
.rebuild-status.success { color: var(--color-primary); }
.rebuild-status.error { color: var(--color-danger); }

.table-filters-el {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  margin: 18px auto 0 auto;
  max-width: 100%;
  width: 100%;
  padding: 0 var(--spacing-lg);
  box-sizing: border-box;
  flex-wrap: wrap;
}

.notion-table-wrapper {
  margin: 0 auto;
  max-width: 100%;
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
}

.el-table__cell, .el-table th, .el-table td {
  height: auto !important;
  min-height: 36px;
  white-space: normal !important;
  word-break: break-word !important;
  min-width: 80px;
  max-width: 600px;
}

.notion-input {
  width: 100%;
  padding: 4px 7px;
  border: 1px solid var(--theme-border);
  border-radius: var(--radius-md);
  font-size: 0.98rem;
  background: var(--theme-bg);
  transition: border 0.2s;
}

.notion-input:focus {
  border-color: var(--color-primary);
  outline: none;
}

.add-row,
.add-col {
  background: var(--theme-surface);
  color: var(--theme-text);
  border: 1px solid var(--theme-border);
  border-radius: var(--radius-md);
  padding: 5px 12px;
  font-size: 0.98rem;
  cursor: pointer;
  transition: background 0.18s, border 0.18s;
  margin: 0 2px;
}

.add-row:hover,
.add-col:hover {
  background: var(--color-grey-light);
  border-color: var(--color-grey);
}

.col-menu, .row-menu {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  color: var(--theme-text-muted);
  padding: 2px 6px;
  border-radius: 3px;
  transition: background 0.15s;
}

.col-menu:hover, .row-menu:hover {
  background: var(--theme-surface);
  color: var(--color-primary);
}

.context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 160px;
  max-width: calc(100vw - 16px);
  box-sizing: border-box;
  background: var(--theme-surface, #fff);
  border: 1px solid var(--theme-border, #e5e7eb);
  border-radius: var(--radius-md, 4px);
  box-shadow: var(--shadow-md, 0 2px 8px rgba(0, 0, 0, 0.07));
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
  color: var(--theme-text, #222);
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.13s;
  white-space: nowrap;
  width: 100%;
  box-sizing: border-box;
}

.menu-item:hover {
  background: var(--color-grey-light, #f5f7fa);
}

.menu-item.danger {
  color: var(--color-danger, #ef4444);
}

.menu-item.danger:hover {
  background: #fee2e2;
}

.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 2990;
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
  padding: var(--spacing-md);
  box-sizing: border-box;
  overflow-x: hidden;
}

.modal {
  background: var(--color-white);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--spacing-md);
  min-width: 0;
  width: 100%;
  max-width: min(480px, 100%);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  box-sizing: border-box;
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
  stroke: var(--color-primary);
}
.add-col-header .add-col-btn:active svg circle {
  fill: #dbeafe;
}

@media (max-width: 768px) {
  .user-table-header {
    max-width: 100%;
    box-sizing: border-box;
  }

  .table-filters-el {
    padding: var(--spacing-xs) var(--spacing-sm);
    flex-direction: column;
    align-items: stretch;
  }

  .notion-table-wrapper {
    padding: 0;
  }

  .modal {
    padding: var(--block-padding-mobile);
  }

  .modal-actions {
    flex-direction: column;
  }

  .modal-actions button {
    width: 100%;
    height: var(--button-height-mobile);
  }

  .notion-table th,
  .notion-table td {
    padding: 4px 2px;
    font-size: 0.95rem;
  }
}

@media (max-width: 480px) {
  .user-table-header h2 {
    font-size: 1.25rem;
  }

  .modal-backdrop {
    padding: var(--spacing-sm);
    align-items: flex-start;
  }
}
</style>