<template>
  <form @submit.prevent="submitForm" class="add-card-form">
    <div class="form-group">
      <label for="title">Заголовок</label>
      <input 
        type="text" 
        id="title" 
        v-model="form.title" 
        class="form-control" 
        required
        placeholder="Введите заголовок карточки"
      >
    </div>
    
    <div class="form-group">
      <label for="description">Описание</label>
      <textarea 
        id="description" 
        v-model="form.description" 
        class="form-control" 
        rows="3"
        placeholder="Введите описание карточки"
      ></textarea>
    </div>
    
    <div class="form-group">
      <label for="dueDate">Срок выполнения</label>
      <input 
        type="date" 
        id="dueDate" 
        v-model="form.dueDate" 
        class="form-control"
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
  name: 'AddCardForm',
  props: {
    columnId: {
      type: Number,
      required: true
    }
  },
  emits: ['add-card', 'cancel'],
  setup(props, { emit }) {
    const form = ref({
      title: '',
      description: '',
      dueDate: ''
    });
    
    const submitForm = async () => {
      try {
        const response = await axios.post('/api/kanban/cards', {
          title: form.value.title,
          description: form.value.description,
          columnId: props.columnId,
          dueDate: form.value.dueDate || null
        });
        
        emit('add-card', response.data);
        form.value = { title: '', description: '', dueDate: '' };
      } catch (error) {
        console.error('Error creating card:', error);
        alert('Не удалось создать карточку');
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
.add-card-form {
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