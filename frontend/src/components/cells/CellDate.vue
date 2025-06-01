<template>
  <span>{{ formatted }}</span>
</template>
<script setup>
import { computed } from 'vue';
const props = defineProps({ value: String });
const formatted = computed(() => {
  if (!props.value) return '';
  const d = new Date(props.value);
  if (isNaN(d)) return props.value;
  return d.toISOString().slice(0, 10);
});
</script>
<style scoped>
span { color: #3a3a3a; }
</style> 