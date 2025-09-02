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
  <template v-if="column.type === 'multiselect'">
    <div v-if="!editing" @click="editing = true" class="tags-cell-view">
      <span v-if="selectedMultiNames.length">{{ selectedMultiNames.join(', ') }}</span>
      <span v-else class="cell-plus-icon" title="Добавить">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="8" fill="#f3f4f6" stroke="#b6c6e6"/>
          <rect x="8" y="4" width="2" height="10" rx="1" fill="#4f8cff"/>
          <rect x="4" y="8" width="10" height="2" rx="1" fill="#4f8cff"/>
        </svg>
      </span>
    </div>
    <div v-else class="tags-cell-edit">
      <div class="tags-multiselect">
        <div v-for="option in multiOptions" :key="option" class="tag-option">
          <input type="checkbox" :id="'cell-multi-' + option + '-' + rowId" :value="option" v-model="editMultiValues" />
          <label :for="'cell-multi-' + option + '-' + rowId">{{ option }}</label>
          <span class="remove-option" @click.stop="removeMultiOption(option)">✕</span>
        </div>
      </div>
      <div class="add-multiselect-option">
        <input v-model="newMultiOption" @keyup.enter="addMultiOption" placeholder="Новое значение" />
        <button class="add-btn" @click="addMultiOption">+</button>
      </div>
      <button class="save-btn" @click="saveMulti">Сохранить</button>
      <button class="cancel-btn" @click="cancelMulti">Отмена</button>
    </div>
  </template>
  <template v-else-if="column.type === 'relation'">
    <div v-if="!editing" @click="editing = true" class="tags-cell-view">
      <span v-if="selectedRelationName">{{ selectedRelationName }}</span>
      <span v-else class="cell-plus-icon" title="Добавить">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="8" fill="#f3f4f6" stroke="#b6c6e6"/>
          <rect x="8" y="4" width="2" height="10" rx="1" fill="#4f8cff"/>
          <rect x="4" y="8" width="10" height="2" rx="1" fill="#4f8cff"/>
        </svg>
      </span>
    </div>
    <div v-else class="tags-cell-edit">
      <select v-model="editRelationValue" class="notion-input">
        <option v-for="opt in relationOptions" :key="opt.id" :value="opt.id">{{ opt.display }}</option>
      </select>
      <button class="save-btn" @click="saveRelation">Сохранить</button>
      <button class="cancel-btn" @click="cancelRelation">Отмена</button>
    </div>
  </template>
  <template v-else-if="column.type === 'lookup'">
    <div class="lookup-cell-view">
      <span v-if="lookupValues.length">{{ lookupValues.join(', ') }}</span>
      <span v-else style="color:#bbb">—</span>
    </div>
  </template>
  <template v-else-if="column.type === 'multiselect-relation'">
    <div v-if="!editing" @click="editing = true" class="tags-cell-view">
      <span v-if="selectedMultiRelationNames.length">{{ selectedMultiRelationNames.map(prettyDisplay).join(', ') }}</span>
      <span v-else class="cell-plus-icon" title="Добавить">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="8" fill="#f3f4f6" stroke="#b6c6e6"/>
          <rect x="8" y="4" width="2" height="10" rx="1" fill="#4f8cff"/>
          <rect x="4" y="8" width="10" height="2" rx="1" fill="#4f8cff"/>
        </svg>
      </span>
    </div>
    <div v-else class="tags-cell-edit">
      <div class="tags-multiselect">
        <div v-for="option in multiRelationOptions" :key="option.id" class="tag-option">
          <input type="checkbox" :id="'cell-multirel-' + option.id + '-' + rowId" :value="String(option.id)" v-model="editMultiRelationValues" />
          <label :for="'cell-multirel-' + option.id + '-' + rowId">{{ prettyDisplay(option.display, multiRelationOptions.value) }}</label>
          <button class="delete-tag-btn" @click.prevent="deleteTag(option.id)" title="Удалить тег">×</button>
        </div>
      </div>
      <div class="add-tag-block">
        <button v-if="!showAddTagInput" class="add-tag-btn" @click="showAddTagInput = true">+ Новый тег</button>
        <div v-else class="add-tag-form">
          <input v-model="newTagName" @keyup.enter="addTag" placeholder="Название тега" />
          <button class="add-tag-confirm" @click="addTag">Добавить</button>
          <button class="add-tag-cancel" @click="showAddTagInput = false; newTagName = ''">×</button>
        </div>
      </div>
      <div class="action-buttons">
        <button class="save-btn" @click="saveMultiRelation">Сохранить</button>
        <button class="cancel-btn" @click="cancelMultiRelation">Отмена</button>
      </div>
    </div>
  </template>
  <template v-else>
    <div v-if="!editing" class="cell-view-value" @click="editing = true">
    <span v-if="isArrayString(localValue)">{{ parseArrayString(localValue).join(', ') }}</span>
      <span v-else-if="localValue">{{ localValue }}</span>
      <span v-else class="cell-plus-icon" title="Добавить">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="8" fill="#f3f4f6" stroke="#b6c6e6"/>
          <rect x="8" y="4" width="2" height="10" rx="1" fill="#4f8cff"/>
          <rect x="4" y="8" width="10" height="2" rx="1" fill="#4f8cff"/>
        </svg>
      </span>
    </div>
    <textarea
      v-else
      v-model="localValue"
      @blur="saveAndExit"
      @keyup.enter="saveAndExit"
      :placeholder="column.name"
      class="cell-input"
      autofocus
      ref="textareaRef"
      @input="autoResize"
    />
  </template>
</template>

<script setup>
import { ref, watch, onMounted, computed, nextTick, onUnmounted } from 'vue';
import tablesService from '../../services/tablesService';
import { useTablesWebSocket } from '../../composables/useTablesWebSocket';
import { useTagsWebSocket } from '../../composables/useTagsWebSocket';
import cacheService from '../../services/cacheService';
const props = defineProps(['rowId', 'column', 'cellValues']);
const emit = defineEmits(['update']);

const localValue = ref('');
const editing = ref(false);
// const allTags = ref([]); // Все теги из /api/tags
const editTagIds = ref([]); // id выбранных тегов в режиме редактирования

// Для отображения выбранных тегов
const selectedTagNames = ref([]);

const multiOptions = ref([]);
const editMultiValues = ref([]);
const selectedMultiNames = ref([]);
const newMultiOption = ref('');
// relation/lookup
const relationOptions = ref([]);
const editRelationValue = ref(null);
const selectedRelationName = ref('');
const lookupValues = ref([]);

const multiRelationOptions = ref([]);
const editMultiRelationValues = ref([]);
const selectedMultiRelationNames = ref([]);

const showAddTagInput = ref(false);
const newTagName = ref('');

const textareaRef = ref(null);

function autoResize() {
  const ta = textareaRef.value;
  if (ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }
}

watch(editing, (val) => {
  if (val) {
    if (props.column.type === 'multiselect-relation') {
      loadMultiRelationOptions();
    }
    nextTick(() => {
      if (textareaRef.value) {
        autoResize();
        setTimeout(() => autoResize(), 0);
      }
    });
  }
});

// Добавляем watch для отслеживания изменений в мультисвязях с дебаунсингом
let debounceTimer = null;
watch(editMultiRelationValues, (newValues, oldValues) => {
      // console.log('[editMultiRelationValues] changed from:', oldValues, 'to:', newValues);
  
  // Очищаем предыдущий таймер
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  // Устанавливаем новый таймер для предотвращения множественных обновлений
  debounceTimer = setTimeout(() => {
    // Здесь можно добавить дополнительную логику, если нужно
  }, 100);
}, { deep: true });

// Флаг для предотвращения циклической загрузки
const isLoadingMultiRelations = ref(false);
const lastLoadedValues = ref(new Map()); // Кэш последних загруженных значений

// WebSocket для обновлений таблиц
const { subscribeToTableRelationsUpdates } = useTablesWebSocket();
let unsubscribeFromWebSocket = null;

// Функция для очистки кэша
function clearCache() {
  cacheService.clearAll();
      // console.log('[TableCell] Кэш очищен');
}

// WebSocket для тегов
const { onTagsUpdate } = useTagsWebSocket();
let unsubscribeFromTags = null;

// Удаляем локальные кэши
// const multiRelationOptionsCache = new Map();
// const multiRelationOptionsCacheTimeout = 30000; // 30 секунд
// const relationsCache = new Map();
// const relationsCacheTimeout = 10000; // 10 секунд

// Флаг для предотвращения повторных вызовов
let isInitialized = false;
let isMultiRelationValuesLoaded = false;
let lastLoadedOptionsKey = null;

onMounted(async () => {
  const startTime = Date.now();
      // console.log(`[TableCell] 🚀 Начало монтирования ячейки row:${props.rowId} col:${props.column.id} в ${startTime}`);
  
  if (props.column.type === 'multiselect') {
    multiOptions.value = (props.column.options && props.column.options.options) || [];
    const cell = props.cellValues.find(
      c => c.row_id === props.rowId && c.column_id === props.column.id
    );
    let values = [];
    if (cell && cell.value) {
      try {
        values = JSON.parse(cell.value);
      } catch {}
    }
    editMultiValues.value = Array.isArray(values) ? values : [];
    selectedMultiNames.value = multiOptions.value.filter(opt => editMultiValues.value.includes(opt));
  } else if (props.column.type === 'relation') {
    await loadRelationOptions();
    const cell = props.cellValues.find(
      c => c.row_id === props.rowId && c.column_id === props.column.id
    );
    editRelationValue.value = cell ? cell.value : null;
    selectedRelationName.value = relationOptions.value.find(opt => String(opt.id) === String(editRelationValue.value))?.display || '';
  } else if (props.column.type === 'lookup') {
    await loadLookupValues();
  } else if (props.column.type === 'multiselect-relation') {
    // Загружаем опции только один раз
    if (!isInitialized) {
      await loadMultiRelationOptions();
      isInitialized = true;
    }
    
    // Загружаем relations только один раз для каждой комбинации rowId + columnId
    if (!isMultiRelationValuesLoaded) {
      await loadMultiRelationValues();
      isMultiRelationValuesLoaded = true;
    }
    
    // Подписываемся на обновления таблицы
    if (props.column.type === 'multiselect-relation') {
      unsubscribeFromWebSocket = subscribeToTableRelationsUpdates(props.column.table_id, async () => {
        // console.log('[TableCell] Получено обновление таблицы, перезагружаем relations');
        // Сбрасываем флаг загрузки
        isMultiRelationValuesLoaded = false;
        // Очищаем кэш relations для текущей строки
        cacheService.clearRelationsCache(props.rowId);
        await loadMultiRelationValues();
      });
    }
    
    // Подписываемся на обновления тегов, если это связанная таблица тегов
    if (props.column.options && props.column.options.relatedTableId) {
      unsubscribeFromTags = onTagsUpdate(async () => {
        // console.log('[TableCell] Получено обновление тегов, перезагружаем опции');
        // Сбрасываем флаги загрузки
        isInitialized = false;
        isMultiRelationValuesLoaded = false;
        // Очищаем кэш таблицы тегов
        cacheService.clearTableCache(props.column.options.relatedTableId);
        await loadMultiRelationOptions();
        await loadMultiRelationValues();
      });
    }
    
    // Инициализация localValue для отображения массива, если нет имен
    const cell = props.cellValues.find(
      c => c.row_id === props.rowId && c.column_id === props.column.id
    );
    localValue.value = cell ? cell.value : '';
  } else {
    const cell = props.cellValues.find(
      c => c.row_id === props.rowId && c.column_id === props.column.id
    );
    localValue.value = cell ? cell.value : '';
  }
  const endTime = Date.now();
      // console.log(`[TableCell] ✅ Завершено монтирование ячейки row:${props.rowId} col:${props.column.id} за ${endTime - startTime}ms`);
});

onUnmounted(() => {
  // Отписываемся от WebSocket при размонтировании компонента
  if (unsubscribeFromWebSocket) {
    unsubscribeFromWebSocket();
    unsubscribeFromWebSocket = null;
  }
  
  // Отписываемся от обновлений тегов
  if (unsubscribeFromTags) {
    unsubscribeFromTags();
    unsubscribeFromTags = null;
  }
  
  // Очищаем таймер дебаунсинга
  if (loadMultiRelationValuesTimer) {
    clearTimeout(loadMultiRelationValuesTimer);
    loadMultiRelationValuesTimer = null;
  }
});

watch(
  () => [props.rowId, props.column.id, props.cellValues],
  async () => {
    // Сбрасываем флаги при изменении столбца
    if (props.column.type === 'multiselect-relation') {
      isMultiRelationValuesLoaded = false;
      lastLoadedOptionsKey = null;
      isInitialized = false;
    }
    if (props.column.type === 'multiselect') {
      multiOptions.value = (props.column.options && props.column.options.options) || [];
      const cell = props.cellValues.find(
        c => c.row_id === props.rowId && c.column_id === props.column.id
      );
      let values = [];
      if (cell && cell.value) {
        try {
          values = JSON.parse(cell.value);
        } catch {}
      }
      editMultiValues.value = Array.isArray(values) ? values : [];
      selectedMultiNames.value = multiOptions.value.filter(opt => editMultiValues.value.includes(opt));
    } else if (props.column.type === 'relation') {
      await loadRelationOptions();
      const cell = props.cellValues.find(
        c => c.row_id === props.rowId && c.column_id === props.column.id
      );
      editRelationValue.value = cell ? cell.value : null;
      selectedRelationName.value = relationOptions.value.find(opt => String(opt.id) === String(editRelationValue.value))?.display || '';
    } else if (props.column.type === 'lookup') {
      await loadLookupValues();
    } else if (props.column.type === 'multiselect-relation') {
      // Загружаем опции только один раз при изменении колонки
      await loadMultiRelationOptions();
      // Загружаем значения
      await loadMultiRelationValues();
      // Инициализация localValue для отображения массива, если нет имен
      const cell = props.cellValues.find(
        c => c.row_id === props.rowId && c.column_id === props.column.id
      );
      localValue.value = cell ? cell.value : '';
    } else {
      const cell = props.cellValues.find(
        c => c.row_id === props.rowId && c.column_id === props.column.id
      );
      localValue.value = cell ? cell.value : '';
    }
  },
  { immediate: true }
);

function saveMulti() {
  emit('update', JSON.stringify(editMultiValues.value));
  editing.value = false;
}
function cancelMulti() {
  editing.value = false;
  selectedMultiNames.value = multiOptions.value.filter(opt => editMultiValues.value.includes(opt));
}

async function addMultiOption() {
  const val = newMultiOption.value.trim();
  if (!val) return;
  // Если multiselect связан с relation-таблицей (например, Теги клиентов)
  if (props.column.options && props.column.options.relatedTableId && props.column.options.relatedColumnId) {
    // 1. Создаём строку в relation-таблице
    const newRow = await tablesService.addRow(props.column.options.relatedTableId);
    // 2. Сохраняем значение в нужную ячейку (название тега)
    await tablesService.saveCell({
      table_id: props.column.options.relatedTableId,
      row_id: newRow.id,
      column_id: props.column.options.relatedColumnId,
      value: val
    });
    // 3. Обновляем multiOptions (заново загружаем из relation-таблицы)
    const relTable = await tablesService.getTable(props.column.options.relatedTableId);
    const colId = props.column.options.relatedColumnId;
    multiOptions.value = relTable.rows.map(row => {
      const cell = relTable.cellValues.find(c => c.row_id === row.id && c.column_id === colId);
      return cell ? cell.value : `ID ${row.id}`;
    });
    // 4. Добавляем новый тег в выбранные
    editMultiValues.value.push(val);
    newMultiOption.value = '';
    return;
  }
  // Обычный multiselect (старый вариант)
  if (multiOptions.value.includes(val)) return;
  const updatedOptions = [...multiOptions.value, val];
  await updateMultiOptionsOnServer(updatedOptions);
  multiOptions.value = updatedOptions;
  newMultiOption.value = '';
}
async function removeMultiOption(option) {
  const updatedOptions = multiOptions.value.filter(o => o !== option);
  await updateMultiOptionsOnServer(updatedOptions);
  multiOptions.value = updatedOptions;
  // Если удалили выбранное — убираем из выбранных
  editMultiValues.value = editMultiValues.value.filter(v => v !== option);
}
async function updateMultiOptionsOnServer(optionsArr) {
  // PATCH /api/tables/column/:columnId
  const body = {
    options: {
      ...(props.column.options || {}),
      options: optionsArr
    }
  };
  await fetch(`/api/tables/column/${props.column.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function loadRelationOptions() {
  // Получаем данные из связанной таблицы (id и display)
  const opts = [];
  try {
    const rel = props.column.options || {};
    if (rel.relatedTableId) {
      const res = await fetch(`/api/tables/${rel.relatedTableId}`);
      const data = await res.json();
      const colId = rel.relatedColumnId || (data.columns[0] && data.columns[0].id);
      for (const row of data.rows) {
        const cell = data.cellValues.find(c => c.row_id === row.id && c.column_id === colId);
        opts.push({ id: row.id, display: cell ? cell.value : `ID ${row.id}` });
      }
    }
  } catch {}
  relationOptions.value = opts;
}
function saveRelation() {
  emit('update', editRelationValue.value);
  editing.value = false;
  selectedRelationName.value = relationOptions.value.find(opt => String(opt.id) === String(editRelationValue.value))?.display || '';
}
function cancelRelation() {
  editing.value = false;
}

async function loadLookupValues() {
  // Получаем связанные rowId через relation-таблицу
  lookupValues.value = [];
  try {
    const rel = props.column.options || {};
    if (rel.relatedTableId && rel.relatedColumnId) {
      // Получаем связи для текущей строки
      const res = await fetch(`/api/tables/${props.column.table_id}/row/${props.rowId}/relations`);
      const relations = await res.json();
      // Фильтруем по нужному столбцу relation
      const relatedRowIds = relations
        .filter(r => String(r.column_id) === String(props.column.id) && String(r.to_table_id) === String(rel.relatedTableId))
        .map(r => r.to_row_id);
      if (relatedRowIds.length) {
        // Получаем значения из связанной таблицы
        const relTable = await fetch(`/api/tables/${rel.relatedTableId}`);
        const relData = await relTable.json();
        lookupValues.value = relatedRowIds.map(rowId => {
          const cell = relData.cellValues.find(c => c.row_id === rowId && c.column_id === rel.relatedColumnId);
          return cell ? cell.value : `ID ${rowId}`;
        });
      }
    }
  } catch {}
}

async function loadMultiRelationOptions() {
  // Проверяем, не загружены ли уже опции для текущего столбца
  const cacheKey = `${props.column.id}_${props.column.options?.relatedTableId}`;
  if (multiRelationOptions.value.length > 0 && lastLoadedOptionsKey === cacheKey) {
    return;
  }
  
  const rel = props.column.options || {};
  if (rel.relatedTableId && rel.relatedColumnId) {
    try {
      // Проверяем кэш для данных таблицы
      const cachedTableData = cacheService.getTableData(rel.relatedTableId, 'default');
      let tableData;
      
      if (cachedTableData) {
        // console.log(`[loadMultiRelationOptions] ✅ Используем предварительно загруженные данные таблицы ${rel.relatedTableId}`);
        tableData = cachedTableData;
      } else {
        // console.log(`[loadMultiRelationOptions] ⚠️ Данные таблицы ${rel.relatedTableId} не найдены в кэше, загружаем заново`);
        const response = await fetch(`/api/tables/${rel.relatedTableId}`);
        tableData = await response.json();
        // Сохраняем в кэш
        cacheService.setTableData(rel.relatedTableId, 'default', tableData);
      }
      
      // Формируем опции из данных таблицы
      const colId = rel.relatedColumnId || (tableData.columns[0] && tableData.columns[0].id);
      const opts = [];
      for (const row of tableData.rows) {
        const cell = tableData.cellValues.find(c => c.row_id === row.id && c.column_id === colId);
        opts.push({ id: row.id, display: cell ? cell.value : `ID ${row.id}` });
      }
      multiRelationOptions.value = opts;
      lastLoadedOptionsKey = cacheKey;
      
      // Обновляем selectedMultiRelationNames на основе текущих значений
      if (editMultiRelationValues.value.length > 0) {
        selectedMultiRelationNames.value = opts
          .filter(opt => editMultiRelationValues.value.includes(String(opt.id)))
          .map(opt => opt.display);
      } else {
        selectedMultiRelationNames.value = [];
      }
    } catch (e) {
      // console.error('[loadMultiRelationOptions] Error:', e);
    }
  }
}

// Дебаунсинг для loadMultiRelationValues
let loadMultiRelationValuesTimer = null;
const LOAD_DEBOUNCE_DELAY = 50; // 50ms (уменьшено для ускорения)

async function loadMultiRelationValues() {
  // Проверяем, не загружены ли уже данные
  if (isMultiRelationValuesLoaded) {
    return;
  }
  
  // Очищаем предыдущий таймер
  if (loadMultiRelationValuesTimer) {
    clearTimeout(loadMultiRelationValuesTimer);
  }
  
  // Устанавливаем новый таймер
  loadMultiRelationValuesTimer = setTimeout(async () => {
    // Получаем связи для текущей строки
    // console.log('[loadMultiRelationValues] called for row:', props.rowId, 'column:', props.column.id);
    
    try {
      const rel = props.column.options || {};
      if (rel.relatedTableId && rel.relatedColumnId) {
        // Проверяем кэш для relations
        let relations;
        let tableData;
        
        const cachedRelations = cacheService.getRelationsData(props.rowId, props.column.id);
        if (cachedRelations) {
          // console.log('[loadMultiRelationValues] ✅ Используем предварительно загруженные relations для строки', props.rowId);
          relations = cachedRelations;
        } else {
          // console.log('[loadMultiRelationValues] ⚠️ Relations не найдены в кэше, загружаем заново для строки', props.rowId);
          // Выполняем запросы параллельно
          const [relationsRes, tableRes] = await Promise.all([
            fetch(`/api/tables/${props.column.table_id}/row/${props.rowId}/relations`),
            fetch(`/api/tables/${rel.relatedTableId}`)
          ]);
          
          [relations, tableData] = await Promise.all([
            relationsRes.json(),
            tableRes.json()
          ]);
          
          // Сохраняем relations в кэш
          cacheService.setRelationsData(props.rowId, props.column.id, relations);
        }
        
        // console.log('[loadMultiRelationValues] API response status: 200 relations:', relations);
        
        // Приводим все id к строке для корректного сравнения
        const relatedRowIds = relations
          .filter(r => String(r.column_id) === String(props.column.id) && String(r.to_table_id) === String(rel.relatedTableId))
          .map(r => String(r.to_row_id));
        // console.log('[loadMultiRelationValues] filtered related row ids:', relatedRowIds);
        
        // Обновляем значения
        editMultiRelationValues.value = relatedRowIds;
        
        // Если tableData не загружена, загружаем её отдельно
        if (!tableData) {
          const tableRes = await fetch(`/api/tables/${rel.relatedTableId}`);
          tableData = await tableRes.json();
        }
        
        // Формируем опции из загруженных данных таблицы
        const colId = rel.relatedColumnId || (tableData.columns[0] && tableData.columns[0].id);
        const opts = [];
        for (const row of tableData.rows) {
          const cell = tableData.cellValues.find(c => c.row_id === row.id && c.column_id === colId);
          opts.push({ id: row.id, display: cell ? cell.value : `ID ${row.id}` });
        }
        multiRelationOptions.value = opts;
        
        // Получаем display-значения
        selectedMultiRelationNames.value = multiRelationOptions.value
          .filter(opt => relatedRowIds.includes(String(opt.id)))
          .map(opt => opt.display);
        
        // Отмечаем, что данные загружены
        isMultiRelationValuesLoaded = true;
      }
    } catch (e) {
      // console.error('[loadMultiRelationValues] Error:', e);
    }
  }, LOAD_DEBOUNCE_DELAY);
}

async function saveMultiRelation() {
  // console.log('[saveMultiRelation] called');
  const rel = props.column.options || {};
  // console.log('[saveMultiRelation] editMultiRelationValues:', editMultiRelationValues.value);
  try {
    const payload = {
      column_id: props.column.id,
      to_table_id: rel.relatedTableId,
      to_row_ids: editMultiRelationValues.value
    };
    // console.log('[saveMultiRelation] POST payload:', payload);
              // console.log('[TableCell] Отправляем запрос на обновление relations для строки:', props.rowId);
    // console.log('[TableCell] Данные запроса:', payload);
    const response = await fetch(`/api/tables/${props.column.table_id}/row/${props.rowId}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    // console.log('[TableCell] Ответ сервера для строки:', props.rowId, 'статус:', response.status, 'результат:', result);
    if (response.ok) {
      // console.log('[TableCell] Успешно сохранены теги для строки:', props.rowId);
    } else {
      // console.error('[TableCell] Ошибка сохранения тегов для строки:', props.rowId, 'статус:', response.status);
    }
    editing.value = false;
    await loadMultiRelationValues();
    // console.log('[saveMultiRelation] emitting update with:', editMultiRelationValues.value);
    emit('update', editMultiRelationValues.value);
  } catch (e) {
    // console.error('[saveMultiRelation] Ошибка при сохранении мультисвязи:', e);
  }
}

async function addTag() {
  if (!newTagName.value.trim()) return;
  const rel = props.column.options || {};
  
  try {
    // console.log('[addTag] Добавляем новый тег:', newTagName.value);
    
    // 1. Создаем новую пустую строку в связанной таблице
    const rowResponse = await fetch(`/api/tables/${rel.relatedTableId}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const newRow = await rowResponse.json();
    
    // console.log('[addTag] Новая строка создана:', newRow);
    
    // 2. Добавляем значение в ячейку через POST /cell
    const cellResponse = await fetch(`/api/tables/cell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        row_id: newRow.id,
        column_id: rel.relatedColumnId,
        value: newTagName.value
      })
    });
    const cellResult = await cellResponse.json();
    
    // console.log('[addTag] Значение ячейки сохранено:', cellResult);
    
    // Очищаем форму
    newTagName.value = '';
    showAddTagInput.value = false;
    
    // Обновляем список опций и добавляем тег в выбранные параллельно
    await Promise.all([
      loadMultiRelationOptions(),
      Promise.resolve(editMultiRelationValues.value.push(String(newRow.id)))
    ]);
    
    // console.log('[addTag] Тег добавлен в выбранные:', editMultiRelationValues.value);
    
    // Сохраняем изменения, чтобы отправить WebSocket уведомление
    await saveMultiRelation();
  } catch (e) {
    // console.error('[addTag] Ошибка при добавлении тега:', e);
  }
}

async function deleteTag(tagId) {
  const rel = props.column.options || {};
  if (!confirm('Удалить этот тег?')) return;
  
  try {
    // console.log('[deleteTag] Удаляем тег с ID:', tagId);
    
    // Удаляем тег из связанной таблицы
    const response = await fetch(`/api/tables/row/${tagId}`, { method: 'DELETE' });
    const result = await response.json();
    
    // console.log('[deleteTag] Ответ сервера:', response.status, result);
    
    // Убираем тег из выбранных значений, если он был выбран
    editMultiRelationValues.value = editMultiRelationValues.value.filter(id => String(id) !== String(tagId));
    
    // Обновляем список опций
    await loadMultiRelationOptions();
    
    // console.log('[deleteTag] Тег удален:', tagId);
    
    // Сохраняем изменения, чтобы отправить WebSocket уведомление
    await saveMultiRelation();
  } catch (e) {
    // console.error('[deleteTag] Ошибка при удалении тега:', e);
  }
}

function cancelMultiRelation() {
  // Сбрасываем форму добавления тега
  showAddTagInput.value = false;
  newTagName.value = '';
  
  // Закрываем режим редактирования
  editing.value = false;
  
  // Перезагружаем исходные значения
  loadMultiRelationValues();
}

function save() {
  emit('update', localValue.value);
}

function saveAndExit() {
  save();
  editing.value = false;
}

function isArrayString(val) {
  if (typeof val !== 'string') return false;
  try {
    const arr = JSON.parse(val);
    return Array.isArray(arr);
  } catch {
    return false;
  }
}
function parseArrayString(val) {
  if (typeof val !== 'string') return [];
  // Пробуем как JSON
  try {
    const arr = JSON.parse(val);
    if (Array.isArray(arr)) return arr.map(String);
  } catch {}
  // Пробуем как PostgreSQL-массив
  if (/^\{.*\}$/.test(val)) {
    return val.replace(/[{}\s"]/g, '').split(',').filter(Boolean);
  }
  // Если просто строка
  if (val.trim().length > 0) return [val.trim()];
  return [];
}

function prettyDisplay(val, optionsArr) {
  const arr = parseArrayString(val);
  if (!arr.length) return '—';
  if (optionsArr && Array.isArray(optionsArr)) {
    // Для relation/multiselect-relation ищу display по id
    return arr.map(id => {
      const found = optionsArr.find(opt => String(opt.id) === String(id) || String(opt) === String(id));
      return found ? (found.display || found) : id;
    }).join(', ');
  }
  return arr.join(', ');
}
</script>

<style scoped>
.cell-input {
  border: none !important;
  outline: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  resize: none !important;
  width: 100% !important;
  min-height: 32px;
  font: inherit;
  color: inherit;
  overflow: hidden;
}
.cell-input:focus {
  border: 1.5px solid #2ecc40;
  outline: none;
}
.tags-cell-view, .tags-cell-edit, .lookup-cell-view, .tag-option, .multi-relation-option, .add-multiselect-option, .add-tag-form, .multi-relation-options, .multi-relation-edit, .multi-relation-actions, .action-buttons {
  white-space: normal !important;
  word-break: break-word !important;
  height: auto !important;
  min-height: 1.7em;
  align-items: flex-start !important;
  vertical-align: top !important;
  overflow: visible !important;
}
.tags-cell-view {
  min-height: 1.7em;
  cursor: pointer;
  padding: 0.2em 0.1em;
}
.tags-cell-edit {
  background: #f8f8f8;
  border-radius: 6px;
  padding: 0.3em 0.2em 0.5em 0.2em;
}
.tags-multiselect {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em 1.2em;
  margin-bottom: 0.7em;
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
  padding: 0.3em 1em;
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
  padding: 0.3em 1em;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.cancel-btn:hover {
  background: #d5d5d5;
}
.add-multiselect-option {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin-bottom: 0.7em;
}
.add-multiselect-option input {
  flex: 1;
  padding: 0.2em 0.5em;
  border: 1px solid #e0e0e0;
  border-radius: 5px;
  font-size: 1em;
}
.add-btn {
  background: #2ecc40;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.3em 1em;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.add-btn:hover {
  background: #27ae38;
}
.remove-option {
  color: #e74c3c;
  font-size: 1.1em;
  margin-left: 0.4em;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}
.remove-option:hover {
  color: #c0392b;
}
.lookup-cell-view {
  min-height: 1.7em;
  padding: 0.2em 0.1em;
  color: #222;
}
.multi-relation-edit {
  padding: 8px 0;
}
.multi-relation-options {
  max-height: 180px;
  overflow-y: auto;
  margin-bottom: 8px;
}
.multi-relation-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
}
.delete-tag-btn {
  background: none;
  border: none;
  color: #e53e3e;
  font-size: 1.1em;
  cursor: pointer;
  padding: 0 4px;
}
.multi-relation-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.save-btn {
  background: #4f8cff;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 4px 12px;
  cursor: pointer;
}
.cancel-btn {
  background: #f3f4f6;
  color: #333;
  border: none;
  border-radius: 4px;
  padding: 4px 12px;
  cursor: pointer;
}
.add-tag-block {
  margin-top: 8px;
}
.add-tag-btn {
  background: #f3f4f6;
  color: #4f8cff;
  border: none;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
}
.add-tag-form {
  display: flex;
  gap: 6px;
  align-items: center;
}
.add-tag-form input {
  padding: 3px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}
.add-tag-confirm {
  background: #4f8cff;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 3px 10px;
  cursor: pointer;
}
.add-tag-cancel {
  background: none;
  border: none;
  color: #e53e3e;
  font-size: 1.1em;
  cursor: pointer;
  padding: 0 4px;
}

.action-buttons {
  display: flex;
  gap: 0.5em;
  margin-top: 0.7em;
}

.delete-tag-btn:hover {
  color: #c0392b;
}

.add-tag-btn:hover {
  background: #e2e8f0;
  color: #3182ce;
}

.add-tag-confirm:hover {
  background: #3182ce;
}

.add-tag-block {
  margin: 0.7em 0;
}
.cell-view-value {
  display: block;
  white-space: pre-wrap !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
  width: 100%;
  cursor: pointer;
  transition: background 0.15s;
  min-height: 32px;
}
.cell-view-value:hover {
  background: #f3f4f6;
}
.cell-plus-icon {
  color: #b6c6e6;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2em;
  transition: color 0.15s;
  vertical-align: middle;
}
.cell-plus-icon:hover {
  color: #4f8cff;
}
</style> 