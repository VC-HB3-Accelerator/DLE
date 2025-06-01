<template>
  <div class="columns-container">
    <div v-for="(col, index) in localColumns" :key="col.id" class="column-header">
      <input v-model="col.name" @blur="updateColumn(col)" class="col-name-input" :placeholder="'Название'" />
      <select v-model="col.type" @change="updateColumn(col)" class="col-type-select">
        <option value="text">Текст</option>
        <option value="select">Список</option>
      </select>
      <button class="btn btn-danger btn-sm" @click="$emit('delete-column', col.id)">×</button>
      <button v-if="col.type==='select'" class="btn btn-secondary btn-xs" @click="$emit('edit-options', col)">Опции</button>
      <div class="reorder-buttons">
        <button v-if="index > 0" class="btn btn-light btn-xs" @click="moveColumn(index, -1)">←</button>
        <button v-if="index < localColumns.length - 1" class="btn btn-light btn-xs" @click="moveColumn(index, 1)">→</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
const props = defineProps({
  columns: { type: Array, required: true }
});
const emit = defineEmits(['update:columns', 'update-column', 'delete-column', 'edit-options', 'columns-reordered']);
const localColumns = ref([...props.columns]);

watch(() => props.columns, (val) => {
  localColumns.value = [...val];
});
function updateColumn(col) {
  emit('update-column', col);
}
function moveColumn(index, direction) {
  const newIndex = index + direction;
  if (newIndex >= 0 && newIndex < localColumns.value.length) {
    const columns = [...localColumns.value];
    [columns[index], columns[newIndex]] = [columns[newIndex], columns[index]];
    localColumns.value = columns;
    emit('columns-reordered', localColumns.value);
  }
}
</script>

<style scoped>
.columns-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.column-header {
  background: #f5f7fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 180px;
  position: relative;
}
.col-name-input {
  flex: 1 1 80px;
  border: 1px solid #b0b0b0;
  border-radius: 5px;
  padding: 2px 6px;
}
.col-type-select {
  border-radius: 5px;
  padding: 2px 6px;
}
.btn {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8em;
  border: none;
  cursor: pointer;
  color: #fff;
}
.btn-danger {
  background: #dc3545;
}
.btn-secondary {
  background: #6c757d;
}
.btn-light {
  background: #f8f9fa;
  color: #333;
  border: 1px solid #ddd;
}
.btn-xs {
  font-size: 0.7em;
  padding: 2px 6px;
}
.btn-sm {
  font-size: 0.75em;
  padding: 3px 6px;
}
.reorder-buttons {
  display: flex;
  gap: 2px;
  margin-left: 4px;
}
</style> 