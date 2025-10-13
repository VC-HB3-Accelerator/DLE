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
    <div class="delete-table-confirm">
      <h2>Удалить таблицу?</h2>
      <p>Вы уверены, что хотите удалить эту таблицу? Это действие необратимо.</p>
      <div class="actions">
        <button v-if="canDeleteData" class="danger" @click="remove">Удалить</button>
        <button @click="cancel">Отмена</button>
      </div>
      <div v-if="!canDeleteData" class="empty-table-placeholder">Нет прав для удаления таблицы</div>
    </div>
  </BaseLayout>
</template>
<script setup>
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import axios from 'axios';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import { onMounted } from 'vue';
const $route = useRoute();
const router = useRouter();
const { canDeleteData } = usePermissions();

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[DeleteTableView] Clearing confirmation data');
    // Очищаем данные при выходе из системы
    table.value = null;
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[DeleteTableView] Refreshing confirmation data');
    // DeleteTableView не нуждается в обновлении данных
  });
});

async function remove() {
      await axios.delete(`/tables/${$route.params.id}`);
  router.push({ name: 'tables-list' });
}
function cancel() {
  router.push({ name: 'user-table-view', params: { id: $route.params.id } });
}
</script>
<style scoped>
.delete-table-confirm {
  max-width: 400px;
  margin: 2em auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.07);
  padding: 2em 1.5em;
  text-align: center;
}
.actions {
  display: flex;
  gap: 1em;
  margin-top: 2em;
  justify-content: center;
}
.danger {
  background: #ff4d4f;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.5em 1.2em;
  font-weight: 600;
  cursor: pointer;
  font-size: 1em;
  transition: background 0.2s;
}
.danger:hover {
  background: #d9363e;
}
</style> 