<template>
  <td>
    <input
      v-model="localValue"
      @blur="save"
      @keyup.enter="save"
      :placeholder="column.name"
      class="cell-input"
    />
  </td>
</template>

<script setup>
import { ref, watch } from 'vue';
const props = defineProps(['rowId', 'column', 'cellValues']);
const emit = defineEmits(['update']);

const localValue = ref('');
watch(
  () => [props.rowId, props.column.id, props.cellValues],
  () => {
    const cell = props.cellValues.find(
      c => c.row_id === props.rowId && c.column_id === props.column.id
    );
    localValue.value = cell ? cell.value : '';
  },
  { immediate: true }
);

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
</style> 