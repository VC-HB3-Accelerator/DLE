<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <BaseLayout>
    <DleManagement
      :dle-list="dleList"
      :selected-dle-index="selectedDleIndex"
      @close="goBack"
      @dle-updated="reloadDleList"
      class="dle-management-root"
    />
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../components/BaseLayout.vue';
import DleManagement from '../components/DleManagement.vue';
import dleService from '../services/dleService';

const dleList = ref([]);
const selectedDleIndex = ref(0);
const router = useRouter();

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: 'crm' });
  }
}

async function reloadDleList() {
  dleList.value = await dleService.getAllDLEs() || [];
  // Сбросить выбранный индекс, если список изменился
  if (dleList.value.length === 0) {
    selectedDleIndex.value = 0;
  } else if (selectedDleIndex.value >= dleList.value.length) {
    selectedDleIndex.value = 0;
  }
}

onMounted(async () => {
  await reloadDleList();
});
</script>

<style scoped>
.dle-management-root {
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