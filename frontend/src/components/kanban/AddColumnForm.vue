<template>
  <form @submit.prevent="submitForm" class="add-column-form">
    <div class="form-group">
      <label for="title">Название колонки</label>
      <input 
        type="text" 
        id="title" 
        v-model="form.title" 
        class="form-control" 
        required
        placeholder="Введите название колонки"
      >
    </div>
    
    <div class="form-group">
      <label for="wipLimit">Лимит WIP (опционально)</label>
      <input 
        type="number" 
        id="wipLimit" 
        v-model="form.wipLimit" 
        class="form-control" 
        min="1"
        placeholder="Введите лимит задач в работе"
      >
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
  name: 'AddColumnForm',
  props: {
    boardId: {
      type: [Number, String],
      required: true
    }
  },
  emits: ['add-column', 'cancel'],
  setup(props, { emit }) {
    const form = ref({
      title: '',
      wipLimit: null
    });
    
    const submitForm = async () => {
      try {
        const response = await axios.post(`/api/kanban/boards/${props.boardId}/columns`, {
          title: form.value.title,
          wipLimit: form.value.wipLimit || null
        });
        
        // Добавляем пустой массив карточек для отображения в UI
        const columnWithCards = {
          ...response.data,
          cards: []
        };
        
        emit('add-column', columnWithCards);
        form.value = { title: '', wipLimit: null };
      } catch (error) {
        console.error('Error creating column:', error);
        alert('Не удалось создать колонку');
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
.add-column-form {
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