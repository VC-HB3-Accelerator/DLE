<template>
  <BaseLayout>
    <div class="content-page-block">
      <h2>Контент</h2>
      <p>Здесь будет размещён контент.</p>
    </div>
  </BaseLayout>
</template>

<script setup>
import BaseLayout from '../components/BaseLayout.vue';
</script>

<style scoped>
.content-page-block {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  padding: 32px 24px 24px 24px;
  width: 100%;
  margin-top: 40px;
  position: relative;
  overflow-x: auto;
}
</style> 