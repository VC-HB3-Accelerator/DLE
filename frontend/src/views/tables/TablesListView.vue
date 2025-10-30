<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <BaseLayout>
    <div class="tables-list-block">
      <button class="close-btn" @click="goBack">×</button>
    <h2>Список таблиц</h2>
    <UserTablesList v-if="canViewData" />
    <div v-else class="empty-table-placeholder">Нет данных для отображения</div>
    </div>
  </BaseLayout>
</template>

<script setup>
import BaseLayout from '../../components/BaseLayout.vue';
import UserTablesList from '../../components/tables/UserTablesList.vue';
import { useRouter } from 'vue-router';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import { onMounted } from 'vue';
const router = useRouter();
const { canViewData } = usePermissions();

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[TablesListView] Clearing tables data');
    // Очищаем данные при выходе из системы
    tables.value = [];
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[TablesListView] Refreshing tables data');
    loadTables(); // Обновляем данные при входе в систему
  });
});

function goBack() {
  router.push({ name: 'crm' });
}
</script> 

<style scoped>
.tables-list-block {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.12);
  padding: 32px 24px 24px 24px;
  width: 100%;
  margin-top: 40px;
  position: relative;
  overflow-x: auto;
}
.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #333;
}
</style> 