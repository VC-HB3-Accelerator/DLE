<template>
  <span>{{ value }}</span>
</template>
<script setup>
defineProps({ value: String });
</script>
<style scoped>
span { white-space: pre-line; }
</style> 