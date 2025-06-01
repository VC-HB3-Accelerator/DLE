<template>
  <span>{{ value }}</span>
</template>
<script setup>
defineProps({ value: [String, Number] });
</script>
<style scoped>
span { font-variant-numeric: tabular-nums; }
</style> 