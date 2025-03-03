<template>
  <div class="kanban-board">
    <div class="board-header">
      <h1>{{ board.title }}</h1>
      <p v-if="board.description">{{ board.description }}</p>
      
      <div class="board-actions">
        <button @click="showAddCardModal = true" class="btn btn-primary">
          Добавить карточку
        </button>
        <button @click="showBoardSettings = true" class="btn btn-secondary">
          Настройки доски
        </button>
      </div>
    </div>
    
    <div class="columns-container">
      <div 
        v-for="column in board.columns" 
        :key="column.id" 
        class="kanban-column"
        :class="{ 'wip-limit-reached': column.wip_limit && column.cards.length >= column.wip_limit }"
      >
        <div class="column-header">
          <h3>{{ column.title }}</h3>
          <span v-if="column.wip_limit" class="wip-limit">
            {{ column.cards.length }}/{{ column.wip_limit }}
          </span>
          <div class="column-actions">
            <button @click="showAddCardModal = true; selectedColumn = column" class="btn-icon">
              <i class="fas fa-plus"></i>
            </button>
            <button @click="showColumnSettings = true; selectedColumn = column" class="btn-icon">
              <i class="fas fa-cog"></i>
            </button>
          </div>
        </div>
        
        <div class="cards-container">
          <draggable 
            v-model="column.cards" 
            group="cards"
            @change="onCardMove"
            :animation="150"
            ghost-class="ghost-card"
            class="column-cards"
          >
            <kanban-card 
              v-for="card in column.cards" 
              :key="card.id" 
              :card="card"
              @click="openCard(card)"
            />
          </draggable>
        </div>
      </div>
      
      <div class="add-column">
        <button @click="showAddColumnModal = true" class="btn btn-outline">
          <i class="fas fa-plus"></i> Добавить колонку
        </button>
      </div>
    </div>
    
    <!-- Модальные окна -->
    <modal v-if="showAddCardModal" @close="showAddCardModal = false">
      <template #header>Добавить карточку</template>
      <template #body>
        <add-card-form 
          :column-id="selectedColumn ? selectedColumn.id : null" 
          @add-card="addCard" 
          @cancel="showAddCardModal = false"
        />
      </template>
    </modal>
    
    <modal v-if="showAddColumnModal" @close="showAddColumnModal = false">
      <template #header>Добавить колонку</template>
      <template #body>
        <add-column-form 
          :board-id="board.id" 
          @add-column="addColumn" 
          @cancel="showAddColumnModal = false"
        />
      </template>
    </modal>
    
    <modal v-if="showBoardSettings" @close="showBoardSettings = false">
      <template #header>Настройки доски</template>
      <template #body>
        <board-settings-form 
          :board="board" 
          @update-board="updateBoard" 
          @cancel="showBoardSettings = false"
        />
      </template>
    </modal>
    
    <modal v-if="showColumnSettings" @close="showColumnSettings = false">
      <template #header>Настройки колонки</template>
      <template #body>
        <column-settings-form 
          :column="selectedColumn" 
          @update-column="updateColumn" 
          @delete-column="deleteColumn" 
          @cancel="showColumnSettings = false"
        />
      </template>
    </modal>
    
    <card-detail-modal 
      v-if="selectedCard" 
      :card="selectedCard" 
      :column="getColumnForCard(selectedCard)"
      @close="selectedCard = null"
      @update-card="updateCard"
      @delete-card="deleteCard"
    />
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import draggable from 'vuedraggable';
import KanbanCard from './KanbanCard.vue';
import Modal from '../ui/Modal.vue';
import AddCardForm from './AddCardForm.vue';
import AddColumnForm from './AddColumnForm.vue';
import BoardSettingsForm from './BoardSettingsForm.vue';
import ColumnSettingsForm from './ColumnSettingsForm.vue';
import CardDetailModal from './CardDetailModal.vue';

export default {
  name: 'KanbanBoard',
  components: {
    draggable,
    KanbanCard,
    Modal,
    AddCardForm,
    AddColumnForm,
    BoardSettingsForm,
    ColumnSettingsForm,
    CardDetailModal
  },
  props: {
    boardId: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const board = reactive({
      id: null,
      title: '',
      description: '',
      columns: []
    });
    
    const loading = ref(false);
    const error = ref(null);
    const showAddCardModal = ref(false);
    const showAddColumnModal = ref(false);
    const showBoardSettings = ref(false);
    const showColumnSettings = ref(false);
    const selectedColumn = ref(null);
    const selectedCard = ref(null);
    
    // Загрузка данных доски
    const loadBoard = async () => {
      try {
        loading.value = true;
        error.value = null;
        
        const response = await axios.get(`/api/kanban/boards/${props.boardId}`, {
          withCredentials: true
        });
        
        // Обновляем реактивный объект board
        Object.assign(board, response.data);
      } catch (err) {
        console.error('Error loading board:', err);
        error.value = 'Не удалось загрузить доску. Попробуйте позже.';
      } finally {
        loading.value = false;
      }
    };
    
    // Обработка перемещения карточки
    const onCardMove = async (event) => {
      try {
        if (event.added) {
          const { element: card, newIndex } = event.added;
          
          // Обновляем позицию и колонку карточки в БД
          await axios.put(`/api/kanban/cards/${card.id}/move`, {
            columnId: selectedColumn.value.id,
            position: newIndex
          }, {
            withCredentials: true
          });
        }
      } catch (err) {
        console.error('Error moving card:', err);
        // В случае ошибки перезагружаем доску
        await loadBoard();
      }
    };
    
    // Добавление новой карточки
    const addCard = async (cardData) => {
      try {
        const response = await axios.post('/api/kanban/cards', cardData, {
          withCredentials: true
        });
        
        // Находим колонку и добавляем в нее новую карточку
        const column = board.columns.find(col => col.id === cardData.columnId);
        if (column) {
          column.cards.push(response.data);
        }
        
        showAddCardModal.value = false;
      } catch (err) {
        console.error('Error adding card:', err);
        error.value = 'Не удалось добавить карточку. Попробуйте позже.';
      }
    };
    
    // Добавление новой колонки
    const addColumn = async (columnData) => {
      try {
        const response = await axios.post('/api/kanban/columns', {
          ...columnData,
          boardId: board.id
        }, {
          withCredentials: true
        });
        
        // Добавляем новую колонку в список
        board.columns.push({
          ...response.data,
          cards: []
        });
        
        showAddColumnModal.value = false;
      } catch (err) {
        console.error('Error adding column:', err);
        error.value = 'Не удалось добавить колонку. Попробуйте позже.';
      }
    };
    
    // Обновление настроек доски
    const updateBoard = async (boardData) => {
      try {
        const response = await axios.put(`/api/kanban/boards/${board.id}`, boardData, {
          withCredentials: true
        });
        
        // Обновляем данные доски
        Object.assign(board, response.data);
        
        showBoardSettings.value = false;
      } catch (err) {
        console.error('Error updating board:', err);
        error.value = 'Не удалось обновить настройки доски. Попробуйте позже.';
      }
    };
    
    // Обновление настроек колонки
    const updateColumn = async (columnData) => {
      try {
        const response = await axios.put(`/api/kanban/columns/${columnData.id}`, columnData, {
          withCredentials: true
        });
        
        // Находим и обновляем колонку
        const columnIndex = board.columns.findIndex(col => col.id === columnData.id);
        if (columnIndex !== -1) {
          board.columns[columnIndex] = {
            ...board.columns[columnIndex],
            ...response.data
          };
        }
        
        showColumnSettings.value = false;
      } catch (err) {
        console.error('Error updating column:', err);
        error.value = 'Не удалось обновить настройки колонки. Попробуйте позже.';
      }
    };
    
    // Удаление колонки
    const deleteColumn = async (columnId) => {
      try {
        await axios.delete(`/api/kanban/columns/${columnId}`, {
          withCredentials: true
        });
        
        // Удаляем колонку из списка
        const columnIndex = board.columns.findIndex(col => col.id === columnId);
        if (columnIndex !== -1) {
          board.columns.splice(columnIndex, 1);
        }
        
        showColumnSettings.value = false;
      } catch (err) {
        console.error('Error deleting column:', err);
        error.value = 'Не удалось удалить колонку. Попробуйте позже.';
      }
    };
    
    // Открытие карточки для просмотра/редактирования
    const openCard = (card) => {
      selectedCard.value = card;
    };
    
    // Получение колонки для карточки
    const getColumnForCard = (card) => {
      return board.columns.find(col => col.id === card.column_id);
    };
    
    // Обновление карточки
    const updateCard = async (cardData) => {
      try {
        const response = await axios.put(`/api/kanban/cards/${cardData.id}`, cardData, {
          withCredentials: true
        });
        
        // Находим и обновляем карточку
        for (const column of board.columns) {
          const cardIndex = column.cards.findIndex(c => c.id === cardData.id);
          if (cardIndex !== -1) {
            column.cards[cardIndex] = {
              ...column.cards[cardIndex],
              ...response.data
            };
            break;
          }
        }
        
        // Если открыта эта карточка, обновляем ее
        if (selectedCard.value && selectedCard.value.id === cardData.id) {
          selectedCard.value = {
            ...selectedCard.value,
            ...response.data
          };
        }
      } catch (err) {
        console.error('Error updating card:', err);
        error.value = 'Не удалось обновить карточку. Попробуйте позже.';
      }
    };
    
    // Удаление карточки
    const deleteCard = async (cardId) => {
      try {
        await axios.delete(`/api/kanban/cards/${cardId}`, {
          withCredentials: true
        });
        
        // Удаляем карточку из списка
        for (const column of board.columns) {
          const cardIndex = column.cards.findIndex(c => c.id === cardId);
          if (cardIndex !== -1) {
            column.cards.splice(cardIndex, 1);
            break;
          }
        }
        
        selectedCard.value = null;
      } catch (err) {
        console.error('Error deleting card:', err);
        error.value = 'Не удалось удалить карточку. Попробуйте позже.';
      }
    };
    
    onMounted(() => {
      loadBoard();
    });
    
    return {
      board,
      loading,
      error,
      showAddCardModal,
      showAddColumnModal,
      showBoardSettings,
      showColumnSettings,
      selectedColumn,
      selectedCard,
      onCardMove,
      addCard,
      addColumn,
      updateBoard,
      updateColumn,
      deleteColumn,
      openCard,
      getColumnForCard,
      updateCard,
      deleteCard
    };
  }
};
</script>

<style scoped>
.kanban-board {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.board-header {
  padding: 1rem;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.board-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.columns-container {
  display: flex;
  overflow-x: auto;
  padding: 1rem;
  height: calc(100vh - 150px);
}

.kanban-column {
  min-width: 280px;
  max-width: 280px;
  margin-right: 1rem;
  background-color: #f0f0f0;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  max-height: 100%;
}

.column-header {
  padding: 0.75rem;
  background-color: #e0e0e0;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.column-actions {
  display: flex;
  gap: 0.25rem;
}

.cards-container {
  padding: 0.5rem;
  overflow-y: auto;
  flex-grow: 1;
}

.column-cards {
  min-height: 10px;
}

.wip-limit {
  font-size: 0.8rem;
  color: #666;
  margin-left: 0.5rem;
}

.wip-limit-reached .wip-limit {
  color: #e74c3c;
  font-weight: bold;
}

.add-column {
  min-width: 280px;
  display: flex;
  align-items: flex-start;
  padding: 0.5rem;
}

.ghost-card {
  opacity: 0.5;
  background: #c8ebfb;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  border: none;
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