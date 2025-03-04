<template>
  <div class="access-test-view">
    <h1>Тестирование доступа</h1>
    <p>Эта страница предназначена для тестирования смарт-контрактов и управления доступом.</p>

    <div class="access-test-container">
      <AccessControl />
    </div>
  </div>
</template>

<script setup>
import AccessControl from '../components/AccessControl.vue';
</script>

<style scoped>
.access-test-view {
  padding: 20px;
}

.access-test-container {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
}
</style>
