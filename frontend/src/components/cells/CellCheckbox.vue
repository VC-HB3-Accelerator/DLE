<template>
  <input type="checkbox" :checked="value === true || value === 'true'" disabled />
</template>
<script setup>
defineProps({ value: [Boolean, String, Number] });
</script>
<style scoped>
input[type='checkbox'] {
  pointer-events: none;
  accent-color: #1976d2;
}
</style> 