<template>
  <div class="kanban-board-view">
    <div v-if="!isAuthenticated" class="auth-required">
      <h2>Требуется аутентификация</h2>
      <p>Для доступа к Канбан-доске необходимо подключить кошелек.</p>
    </div>
    
    <div v-else-if="loading" class="loading-container">
      <div class="spinner"></div>
      <p>Загрузка доски...</p>
    </div>
    
    <div v-else-if="error" class="error-container">
      <p>{{ error }}</p>
      <button @click="loadBoard" class="btn btn-primary">Повторить</button>
      <button @click="goBack" class="btn btn-secondary">Назад</button>
    </div>
    
    <div v-else class="board-container">
      <div class="board-header">
        <h1>{{ board.title }}</h1>
        <div class="board-actions">
          <button @click="showAddColumnModal = true" class="btn btn-primary">
            <i class="fas fa-plus"></i> Добавить колонку
          </button>
        </div>
      </div>
      
      <div v-if="board.description" class="board-description">
        {{ board.description }}
      </div>
      
      <div class="columns-container">
        <div 
          v-for="column in board.columns" 
          :key="column.id" 
          class="column"
        >
          <div class="column-header">
            <h3>{{ column.title }}</h3>
            <span v-if="column.wip_limit" class="wip-limit">
              {{ column.cards.length }}/{{ column.wip_limit }}
            </span>
            <button @click="showAddCardModal(column.id)" class="btn btn-sm btn-primary">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          
          <div class="cards-container">
            <div 
              v-for="card in column.cards" 
              :key="card.id" 
              class="card"
              @click="showCardDetails(card)"
            >
              <h4>{{ card.title }}</h4>
              <p v-if="card.description" class="card-description">
                {{ card.description }}
              </p>
              <div v-if="card.due_date" class="card-due-date">
                <i class="fas fa-calendar"></i> {{ formatDate(card.due_date) }}
              </div>
              <div v-if="card.assigned_address" class="card-assigned">
                <i class="fas fa-user"></i> {{ formatAddress(card.assigned_address) }}
              </div>
            </div>
            
            <div v-if="column.cards.length === 0" class="empty-column">
              <p>Нет карточек</p>
            </div>
          </div>
        </div>
        
        <div v-if="board.columns.length === 0" class="no-columns">
          <p>У этой доски пока нет колонок.</p>
          <button @click="showAddColumnModal = true" class="btn btn-primary">
            Добавить колонку
          </button>
        </div>
      </div>
    </div>
    
    <!-- Модальные окна для добавления колонки и карточки -->
    <modal v-if="showAddColumnModal" @close="showAddColumnModal = false">
      <template #header>Добавить колонку</template>
      <template #body>
        <add-column-form 
          :board-id="boardId" 
          @add-column="addColumn" 
          @cancel="showAddColumnModal = false" 
        />
      </template>
    </modal>
    
    <modal v-if="showAddCardModal" @close="showAddCardModal = false">
      <template #header>Добавить карточку</template>
      <template #body>
        <add-card-form 
          :board-id="boardId" 
          :column-id="selectedColumnId" 
          @add-card="addCard" 
          @cancel="showAddCardModal = false" 
        />
      </template>
    </modal>
    
    <modal v-if="showCardModal" @close="showCardModal = false">
      <template #header>{{ selectedCard ? selectedCard.title : 'Карточка' }}</template>
      <template #body>
        <div v-if="selectedCard" class="card-details">
          <p v-if="selectedCard.description">{{ selectedCard.description }}</p>
          <div v-else class="no-description">
            <p>Нет описания</p>
          </div>
          
          <div class="card-meta">
            <div v-if="selectedCard.due_date" class="card-due-date">
              <strong>Срок выполнения:</strong> {{ formatDate(selectedCard.due_date) }}
            </div>
            
            <div v-if="selectedCard.assigned_address" class="card-assignee">
              <strong>Исполнитель:</strong> {{ formatAddress(selectedCard.assigned_address) }}
            </div>
          </div>
        </div>
      </template>
    </modal>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { useRouter, useRoute } from 'vue-router';
import Modal from '../components/Modal.vue';
import KanbanCard from '../components/kanban/KanbanCard.vue';
import AddCardForm from '../components/kanban/AddCardForm.vue';
import AddColumnForm from '../components/kanban/AddColumnForm.vue';

export default {
  name: 'KanbanBoardView',
  components: {
    Modal,
    KanbanCard,
    AddCardForm,
    AddColumnForm
  },
  props: {
    isAuthenticated: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const router = useRouter();
    const route = useRoute();
    const boardId = route.params.id;
    
    const board = ref({});
    const loading = ref(true);
    const error = ref(null);
    const showAddColumnModal = ref(false);
    const showAddCardModal = ref(false);
    const selectedColumnId = ref(null);
    const selectedCard = ref(null);
    const showCardModal = ref(false);
    
    const loadBoard = async () => {
      if (!props.isAuthenticated) {
        loading.value = false;
        return;
      }
      
      loading.value = true;
      error.value = null;
      
      try {
        const response = await axios.get(`/api/kanban/boards/${boardId}`);
        board.value = response.data;
        loading.value = false;
      } catch (err) {
        console.error('Error loading board:', err);
        error.value = `Не удалось загрузить доску: ${err.response?.data?.error || err.message}`;
        loading.value = false;
      }
    };
    
    const goBack = () => {
      router.push('/kanban');
    };
    
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    };
    
    const formatAddress = (address) => {
      if (!address) return '';
      return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };
    
    const addColumn = (column) => {
      board.value.columns.push(column);
      showAddColumnModal.value = false;
    };
    
    const addCard = (card) => {
      const column = board.value.columns.find(col => col.id === card.column_id);
      if (column) {
        column.cards.push(card);
      }
      showAddCardModal.value = false;
    };
    
    const showCardDetails = (card) => {
      selectedCard.value = card;
      showCardModal.value = true;
    };
    
    onMounted(() => {
      loadBoard();
    });
    
    return {
      board,
      loading,
      error,
      showAddColumnModal,
      showAddCardModal,
      selectedColumnId,
      selectedCard,
      showCardModal,
      loadBoard,
      goBack,
      formatDate,
      formatAddress,
      addColumn,
      addCard,
      showCardDetails
    };
  }
}
</script>

<style scoped>
.kanban-board-view {
  padding: 1rem;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 4px solid #3498db;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-container {
  text-align: center;
  padding: 2rem;
  color: #e74c3c;
}

.board-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.board-title h1 {
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.board-description {
  color: #666;
  margin-top: 0;
}

.board-actions {
  display: flex;
  gap: 0.5rem;
}

.no-columns {
  text-align: center;
  padding: 3rem;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.columns-container {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding-bottom: 1rem;
  min-height: 70vh;
}

.column {
  background-color: #f1f1f1;
  border-radius: 4px;
  width: 300px;
  min-width: 300px;
  max-height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid #ddd;
}

.column-header h3 {
  margin: 0;
  font-size: 1rem;
}

.wip-limit {
  font-size: 0.8rem;
  color: #666;
  background-color: #eee;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}

.cards-container {
  padding: 0.75rem;
  flex-grow: 1;
  overflow-y: auto;
}

.card {
  background-color: white;
  border-radius: 4px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
}

.card:hover {
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.card h4 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.card-description {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-due-date, .card-assigned {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.5rem;
}

.empty-column {
  text-align: center;
  padding: 1rem;
  color: #999;
}

.card-details {
  padding: 1rem;
}

.card-meta {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

.no-description {
  color: #999;
  font-style: italic;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background-color: #3498db;
  color: white;
}

.btn-secondary {
  background-color: #95a5a6;
  color: white;
}

.btn-outline {
  background-color: transparent;
  border: 1px dashed #95a5a6;
  color: #666;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: #666;
  padding: 0.25rem;
}

.btn-icon:hover {
  color: #333;
}
</style> 