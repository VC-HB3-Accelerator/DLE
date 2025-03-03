<template>
  <div class="kanban-card" :class="{ 'has-due-date': hasDueDate, 'overdue': isOverdue }">
    <div class="card-labels" v-if="card.labels && card.labels.length > 0">
      <span 
        v-for="label in card.labels" 
        :key="label.id" 
        class="card-label"
        :style="{ backgroundColor: label.color }"
        :title="label.name"
      ></span>
    </div>
    
    <div class="card-title">{{ card.title }}</div>
    
    <div class="card-footer">
      <div class="card-due-date" v-if="hasDueDate" :title="formattedDueDate">
        <i class="far fa-clock"></i> {{ dueDateDisplay }}
      </div>
      
      <div class="card-assignee" v-if="card.assigned_username">
        <span class="avatar" :title="card.assigned_username">
          {{ getInitials(card.assigned_username) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'KanbanCard',
  props: {
    card: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    // Проверяем, есть ли срок выполнения
    const hasDueDate = computed(() => {
      return !!props.card.due_date;
    });
    
    // Проверяем, просрочена ли задача
    const isOverdue = computed(() => {
      if (!props.card.due_date) return false;
      
      const dueDate = new Date(props.card.due_date);
      const now = new Date();
      
      return dueDate < now;
    });
    
    // Форматируем дату для отображения
    const formattedDueDate = computed(() => {
      if (!props.card.due_date) return '';
      
      const dueDate = new Date(props.card.due_date);
      return dueDate.toLocaleString('ru-RU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    });
    
    // Сокращенное отображение даты
    const dueDateDisplay = computed(() => {
      if (!props.card.due_date) return '';
      
      const dueDate = new Date(props.card.due_date);
      const now = new Date();
      
      // Если сегодня
      if (dueDate.toDateString() === now.toDateString()) {
        return 'Сегодня ' + dueDate.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // Если завтра
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (dueDate.toDateString() === tomorrow.toDateString()) {
        return 'Завтра ' + dueDate.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // В остальных случаях
      return dueDate.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short'
      });
    });
    
    // Получаем инициалы пользователя
    const getInitials = (name) => {
      if (!name) return '';
      
      return name
        .split(' ')
        .map(part => part.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2);
    };
    
    return {
      hasDueDate,
      isOverdue,
      formattedDueDate,
      dueDateDisplay,
      getInitials
    };
  }
}
</script>

<style scoped>
.kanban-card {
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.kanban-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}

.card-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 0.5rem;
}

.card-label {
  width: 32px;
  height: 8px;
  border-radius: 4px;
}

.card-title {
  font-weight: 500;
  margin-bottom: 0.5rem;
  word-break: break-word;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: #666;
}

.card-due-date {
  display: flex;
  align-items: center;
  gap: 4px;
}

.has-due-date.overdue .card-due-date {
  color: #e74c3c;
  font-weight: bold;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background-color: #3498db;
  color: white;
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: bold;
}
</style> 