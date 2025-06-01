<template>
  <span v-if="Array.isArray(value)">
    <span v-for="(v, i) in value" :key="i" class="select-tag">{{ v }}</span>
  </span>
  <span v-else>{{ value }}</span>
</template>
<script setup>
defineProps({ value: [String, Array], options: [Array, Object] });
</script>
<style scoped>
.select-tag {
  display: inline-block;
  background: #e0f3ff;
  color: #1976d2;
  border-radius: 6px;
  padding: 2px 8px;
  margin-right: 4px;
  font-size: 0.95em;
}
</style> 