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
    <div class="create-table-container">
      <h2>Создать новую таблицу</h2>
      <form v-if="canEditData" @submit.prevent="handleCreateTable" class="create-table-form">
        <label>Название таблицы</label>
        <input v-model="newTableName" required placeholder="Введите название" />
        <label>Описание</label>
        <textarea v-model="newTableDescription" placeholder="Описание (необязательно)" />
        <label>Источник для ИИ ассистента</label>
        <select v-model="newTableIsRagSourceId" required>
          <option :value="1">Да</option>
          <option :value="2">Нет</option>
        </select>
        <div class="form-actions">
          <button type="submit">Создать</button>
          <button type="button" @click="goBack">Отмена</button>
        </div>
      </form>
      <div v-else class="empty-table-placeholder">
        <p>Нет прав для создания таблицы</p>
        <button type="button" @click="goBack" class="btn btn-primary">Назад</button>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import tablesService from '../../services/tablesService';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';

const router = useRouter();
const newTableName = ref('');
const newTableDescription = ref('');
const newTableIsRagSourceId = ref(2);
const { canEditData } = usePermissions();

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    console.log('[CreateTableView] Clearing form data');
    // Очищаем данные формы при выходе из системы
    form.value = { name: '', description: '' };
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[CreateTableView] Refreshing form data');
    // CreateTableView не нуждается в обновлении данных
  });
});

async function handleCreateTable() {
  if (!newTableName.value) return;
  await tablesService.createTable({
    name: newTableName.value,
    description: newTableDescription.value,
    isRagSourceId: newTableIsRagSourceId.value
  });
  router.push({ name: 'tables-list' });
}
function goBack() {
  router.back();
}
</script>

<style scoped>
.create-table-container {
  background: #fff;
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-top: 20px;
  margin-bottom: 20px;
  width: 100%;
  position: relative;
  overflow-x: auto;
  margin-left: 0;
  margin-right: 0;
}
.create-table-form {
  display: flex;
  flex-direction: column;
  gap: 1.1em;
}
.create-table-form label {
  font-weight: 500;
  margin-bottom: 0.2em;
}
.create-table-form input,
.create-table-form textarea,
.create-table-form select {
  border: 1px solid #ececec;
  border-radius: 7px;
  padding: 0.5em 0.8em;
  font-size: 1em;
  background: #fafbfc;
}
.create-table-form textarea {
  min-height: 60px;
  resize: vertical;
}
.form-actions {
  display: flex;
  gap: 1em;
  margin-top: 1.2em;
}
.form-actions button[type="submit"] {
  background: #2ecc40;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.5em 1.2em;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.form-actions button[type="submit"]:hover {
  background: #27ae38;
}
.form-actions button[type="button"] {
  background: #eaeaea;
  color: #333;
  border: none;
  border-radius: 8px;
  padding: 0.5em 1.2em;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.form-actions button[type="button"]:hover {
  background: #d5d5d5;
}

.empty-table-placeholder {
  text-align: center;
  padding: 2em;
  color: #666;
}

.empty-table-placeholder p {
  margin-bottom: 1.5em;
  font-size: 1.1em;
}

.empty-table-placeholder .btn {
  background: #2ecc40;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.5em 1.2em;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.empty-table-placeholder .btn:hover {
  background: #27ae38;
}
</style> 