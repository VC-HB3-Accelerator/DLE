<template>
  <form @submit.prevent="submitForm" class="add-board-form">
    <div class="form-group">
      <label for="title">Название доски</label>
      <input 
        type="text" 
        id="title" 
        v-model="form.title" 
        class="form-control" 
        required
        placeholder="Введите название доски"
      >
    </div>
    
    <div class="form-group">
      <label for="description">Описание</label>
      <textarea 
        id="description" 
        v-model="form.description" 
        class="form-control" 
        rows="3"
        placeholder="Введите описание доски"
      ></textarea>
    </div>
    
    <div class="form-group form-check">
      <input 
        type="checkbox" 
        id="isPublic" 
        v-model="form.isPublic" 
        class="form-check-input"
      >
      <label for="isPublic" class="form-check-label">Публичная доска</label>
    </div>
    
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" @click="cancel">Отмена</button>
      <button type="submit" class="btn btn-primary" :disabled="!form.title">Создать</button>
    </div>
  </form>
</template>

<script>
import { ref } from 'vue';
import axios from 'axios';

export default {
  name: 'AddBoardForm',
  emits: ['add-board', 'cancel'],
  setup(props, { emit }) {
    const form = ref({
      title: '',
      description: '',
      isPublic: false
    });
    
    const submitForm = async () => {
      try {
        const response = await axios.post('/api/kanban/boards', {
          title: form.value.title,
          description: form.value.description,
          isPublic: form.value.isPublic
        });
        
        emit('add-board', response.data);
        form.value = { title: '', description: '', isPublic: false };
      } catch (error) {
        console.error('Error creating board:', error);
        alert('Не удалось создать доску');
      }
    };
    
    const cancel = () => {
      emit('cancel');
    };
    
    return {
      form,
      submitForm,
      cancel
    };
  }
}
</script>

<style scoped>
.add-board-form {
  padding: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-check-label {
  font-weight: normal;
}

.form-check-input {
  margin-top: 0;
}

.form-control {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style> 