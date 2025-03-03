<template>
  <div class="kanban-view">
    <div v-if="!isAuthenticated" class="auth-required">
      <h2>Требуется аутентификация</h2>
      <p>Для доступа к Канбан-доскам необходимо подключить кошелек.</p>
    </div>
    
    <div v-else-if="loading" class="loading-container">
      <div class="spinner"></div>
      <p>Загрузка досок...</p>
    </div>
    
    <div v-else-if="error" class="error-container">
      <p>{{ error }}</p>
      <button @click="loadBoards" class="btn btn-primary">Повторить</button>
    </div>
    
    <div v-else>
      <div class="boards-header">
        <h1>Канбан-доски</h1>
        <button @click="showAddBoardModal = true" class="btn btn-primary">
          <i class="fas fa-plus"></i> Создать доску
        </button>
      </div>
      
      <div v-if="ownBoards.length === 0 && sharedBoards.length === 0 && publicBoards.length === 0" class="no-boards">
        <p>У вас пока нет досок. Создайте первую доску, чтобы начать работу.</p>
        <button @click="showAddBoardModal = true" class="btn btn-primary">
          Создать доску
        </button>
      </div>
      
      <div v-else class="boards-container">
        <div v-if="ownBoards.length > 0" class="boards-section">
          <h2>Мои доски</h2>
          <div class="boards-grid">
            <div 
              v-for="board in ownBoards" 
              :key="board.id" 
              class="board-card"
              @click="openBoard(board.id)"
            >
              <h3>{{ board.title }}</h3>
              <p v-if="board.description">{{ board.description }}</p>
              <div class="board-meta">
                <span class="board-date">
                  Обновлено: {{ formatDate(board.updated_at) }}
                </span>
                <span v-if="board.is_public" class="board-public">
                  <i class="fas fa-globe"></i> Публичная
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="sharedBoards.length > 0" class="boards-section">
          <h2>Доступные мне доски</h2>
          <div class="boards-grid">
            <div 
              v-for="board in sharedBoards" 
              :key="board.id" 
              class="board-card"
              @click="openBoard(board.id)"
            >
              <h3>{{ board.title }}</h3>
              <p v-if="board.description">{{ board.description }}</p>
              <div class="board-meta">
                <span class="board-date">
                  Обновлено: {{ formatDate(board.updated_at) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="publicBoards.length > 0" class="boards-section">
          <h2>Публичные доски</h2>
          <div class="boards-grid">
            <div 
              v-for="board in publicBoards" 
              :key="board.id" 
              class="board-card"
              @click="openBoard(board.id)"
            >
              <h3>{{ board.title }}</h3>
              <p v-if="board.description">{{ board.description }}</p>
              <div class="board-meta">
                <span class="board-date">
                  Обновлено: {{ formatDate(board.updated_at) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <modal v-if="showAddBoardModal" @close="showAddBoardModal = false">
      <template #header>Создать новую доску</template>
      <template #body>
        <add-board-form @add-board="addBoard" @cancel="showAddBoardModal = false" />
      </template>
    </modal>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import Modal from '../components/Modal.vue';
import AddBoardForm from '../components/kanban/AddBoardForm.vue';

export default {
  name: 'KanbanView',
  components: {
    Modal,
    AddBoardForm
  },
  setup() {
    const router = useRouter();
    
    const ownBoards = ref([]);
    const sharedBoards = ref([]);
    const publicBoards = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const showAddBoardModal = ref(false);
    
    const isAuthenticated = computed(() => localStorage.getItem('isAuthenticated') === 'true');
    
    const loadBoards = async () => {
      if (!isAuthenticated.value) {
        loading.value = false;
        return;
      }
      
      loading.value = true;
      error.value = null;
      
      try {
        // Пытаемся загрузить доски с сервера
        const response = await axios.get('/api/kanban/boards');
        ownBoards.value = response.data.ownBoards || [];
        sharedBoards.value = response.data.sharedBoards || [];
        publicBoards.value = response.data.publicBoards || [];
      } catch (err) {
        console.error('Error loading boards:', err);
        error.value = `Не удалось загрузить доски: ${err.response?.data?.error || err.message}`;
        
        // Заглушка для разработки - создаем тестовые доски
        ownBoards.value = [
          { 
            id: 1, 
            title: 'Тестовая доска 1', 
            description: 'Описание тестовой доски 1',
            created_at: new Date().toISOString()
          },
          { 
            id: 2, 
            title: 'Тестовая доска 2', 
            description: 'Описание тестовой доски 2',
            created_at: new Date().toISOString()
          }
        ];
        sharedBoards.value = [];
        publicBoards.value = [];
      } finally {
        loading.value = false;
      }
    };
    
    const addBoard = (board) => {
      ownBoards.value.unshift(board);
      showAddBoardModal.value = false;
    };
    
    const openBoard = (boardId) => {
      router.push(`/kanban/boards/${boardId}`);
    };
    
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    };
    
    onMounted(() => {
      loadBoards();
    });
    
    return {
      ownBoards,
      sharedBoards,
      publicBoards,
      loading,
      error,
      showAddBoardModal,
      isAuthenticated,
      loadBoards,
      addBoard,
      openBoard,
      formatDate
    };
  }
}
</script>

<style scoped>
.kanban-view {
  padding: 1rem;
}

.boards-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.boards-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.boards-section h2 {
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.boards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.board-card {
  background-color: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.board-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.board-card h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 1.25rem;
}

.board-card p {
  color: #666;
  margin-bottom: 1rem;
}

.board-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #666;
}

.board-public {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.no-boards {
  text-align: center;
  padding: 3rem;
  background-color: #f9f9f9;
  border-radius: 8px;
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

.auth-required {
  text-align: center;
  padding: 3rem;
  background-color: #f9f9f9;
  border-radius: 8px;
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
</style> 