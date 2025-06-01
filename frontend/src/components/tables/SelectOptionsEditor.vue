<template>
  <div class="select-options-editor">
    <h4>Опции для select</h4>
    <ul>
      <li v-for="(opt, idx) in localOptions" :key="idx">
        <input v-model="localOptions[idx]" @blur="emitOptions" class="option-input" />
        <button class="btn btn-danger btn-xs" @click="removeOption(idx)">×</button>
      </li>
    </ul>
    <button class="btn btn-success btn-xs" @click="addOption">Добавить опцию</button>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
const props = defineProps({
  options: { type: Array, default: () => [] }
});
const emit = defineEmits(['update:options']);
const localOptions = ref([...props.options]);

watch(() => props.options, (val) => {
  localOptions.value = [...val];
});
function addOption() {
  localOptions.value.push('');
  emitOptions();
}
function removeOption(idx) {
  localOptions.value.splice(idx, 1);
  emitOptions();
}
function emitOptions() {
  emit('update:options', localOptions.value.filter(opt => opt.trim() !== ''));
}
</script>

<style scoped>
.select-options-editor {
  background: #f8fafc;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
  max-width: 320px;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0 0 8px 0;
}
li {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.option-input {
  flex: 1 1 80px;
  border: 1px solid #b0b0b0;
  border-radius: 5px;
  padding: 2px 6px;
}
.btn-xs {
  font-size: 0.8em;
  padding: 2px 6px;
}
</style> 