<template>
  <div class="create-table-modal">
    <div class="modal-header">
      <h3>Создать новую таблицу</h3>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>
    <form @submit.prevent="createTable">
      <div class="form-group">
        <label>Название таблицы</label>
        <input v-model="name" required maxlength="255" />
      </div>
      <div class="form-group">
        <label>Описание</label>
        <textarea v-model="description" maxlength="500"></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-success" type="submit" :disabled="isLoading">Создать</button>
        <button class="btn btn-secondary" type="button" @click="$emit('close')">Отмена</button>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import tablesService from '../../services/tablesService';
const emit = defineEmits(['close', 'table-created']);
const name = ref('');
const description = ref('');
const isLoading = ref(false);
const error = ref('');

async function createTable() {
  if (!name.value.trim()) return;
  isLoading.value = true;
  error.value = '';
  try {
    await tablesService.createTable({ name: name.value, description: description.value });
    emit('table-created');
    emit('close');
  } catch (e) {
    error.value = 'Ошибка создания таблицы';
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.create-table-modal {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.13);
  padding: 28px 22px 18px 22px;
  max-width: 400px;
  margin: 40px auto;
  position: relative;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #333;
}
.form-group {
  margin-bottom: 16px;
}
input, textarea {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 1rem;
}
.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 10px;
}
.btn {
  padding: 7px 18px;
  border-radius: 6px;
  font-size: 1rem;
  border: none;
  cursor: pointer;
}
.btn-success {
  background: #28a745;
  color: #fff;
}
.btn-secondary {
  background: #bbb;
  color: #fff;
}
.error {
  color: #dc3545;
  margin-top: 10px;
}
</style> 