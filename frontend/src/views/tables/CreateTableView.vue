<template>
  <BaseLayout>
    <div class="create-table-container">
      <h2>Создать новую таблицу</h2>
      <form @submit.prevent="handleCreateTable" class="create-table-form">
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
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import tablesService from '../../services/tablesService';

const router = useRouter();
const newTableName = ref('');
const newTableDescription = ref('');
const newTableIsRagSourceId = ref(2);

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
  max-width: 500px;
  margin: 2rem auto;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.07);
  padding: 2rem 1.5rem;
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
</style> 