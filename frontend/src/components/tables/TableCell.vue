<template>
  <template v-if="column.type === 'tags'">
    <div v-if="!editing" @click="editing = true" class="tags-cell-view">
      <span v-if="selectedTagNames.length">{{ selectedTagNames.join(', ') }}</span>
      <span v-else style="color:#bbb">—</span>
    </div>
    <div v-else class="tags-cell-edit">
      <div class="tags-multiselect">
        <div v-for="tag in allTags" :key="tag.id" class="tag-option">
          <input type="checkbox" :id="'cell-tag-' + tag.id + '-' + rowId" :value="tag.id" v-model="editTagIds" />
          <label :for="'cell-tag-' + tag.id + '-' + rowId">{{ tag.name }}</label>
        </div>
      </div>
      <button class="save-btn" @click="saveTags">Сохранить</button>
      <button class="cancel-btn" @click="cancelTags">Отмена</button>
    </div>
  </template>
  <template v-else>
    <input
      v-model="localValue"
      @blur="save"
      @keyup.enter="save"
      :placeholder="column.name"
      class="cell-input"
    />
  </template>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
const props = defineProps(['rowId', 'column', 'cellValues']);
const emit = defineEmits(['update']);

const localValue = ref('');
const editing = ref(false);
const allTags = ref([]); // Все теги из /api/tags
const editTagIds = ref([]); // id выбранных тегов в режиме редактирования

// Для отображения выбранных тегов
const selectedTagNames = ref([]);

onMounted(async () => {
  if (props.column.type === 'tags') {
    await loadTags();
    updateSelectedTagNames();
  }
});

async function loadTags() {
  const res = await fetch('/api/tags');
  allTags.value = await res.json();
}

watch(
  () => [props.rowId, props.column.id, props.cellValues],
  () => {
    if (props.column.type === 'tags') {
      // Значение ячейки — строка с JSON-массивом id тегов
      const cell = props.cellValues.find(
        c => c.row_id === props.rowId && c.column_id === props.column.id
      );
      let ids = [];
      if (cell && cell.value) {
        try {
          ids = JSON.parse(cell.value);
        } catch {}
      }
      editTagIds.value = Array.isArray(ids) ? ids : [];
      updateSelectedTagNames();
    } else {
      const cell = props.cellValues.find(
        c => c.row_id === props.rowId && c.column_id === props.column.id
      );
      localValue.value = cell ? cell.value : '';
    }
  },
  { immediate: true }
);

function updateSelectedTagNames() {
  if (props.column.type === 'tags') {
    selectedTagNames.value = allTags.value
      .filter(tag => editTagIds.value.includes(tag.id))
      .map(tag => tag.name);
  }
}

function saveTags() {
  emit('update', JSON.stringify(editTagIds.value));
  editing.value = false;
}
function cancelTags() {
  editing.value = false;
  updateSelectedTagNames();
}

function save() {
  emit('update', localValue.value);
}
</script>

<style scoped>
.cell-input {
  width: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 5px;
  padding: 0.3em 0.5em;
  font-size: 1em;
  background: #fff;
  transition: border 0.2s;
}
.cell-input:focus {
  border: 1.5px solid #2ecc40;
  outline: none;
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
</style> 