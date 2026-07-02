<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="history-container">
      <!-- Фильтры -->
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div v-if="selectedDle?.dleAddress" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ selectedDle.dleAddress }}
        </div>
        <div v-else-if="isLoadingDle" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ t('common.loading') }}
        </div>
        <button class="close-btn" @click="goBackToBlocks">×</button>
      </div>
      <div class="filters-section">
        <h2>{{ t('smartcontracts.history.filters') }}</h2>
        <div class="filters-form">
          <div class="filters-row">
            <div class="filter-group">
              <label for="eventType">{{ t('smartcontracts.history.eventType') }}</label>
              <select id="eventType" v-model="filters.eventType">
                <option value="">{{ t('smartcontracts.history.allEvents') }}</option>
                <option value="dle_created">{{ t('smartcontracts.history.eventTypes.dle_created') }}</option>
                <option value="proposal_created">{{ t('smartcontracts.history.eventTypes.proposal_created') }}</option>
                <option value="proposal_executed">{{ t('smartcontracts.history.eventTypes.proposal_executed') }}</option>
                <option value="proposal_cancelled">{{ t('smartcontracts.history.eventTypes.proposal_cancelled') }}</option>
                <option value="module_added">{{ t('smartcontracts.history.eventTypes.module_added') }}</option>
                <option value="module_removed">{{ t('smartcontracts.history.eventTypes.module_removed') }}</option>
                <option value="chain_added">{{ t('smartcontracts.history.eventTypes.chain_added') }}</option>
                <option value="chain_removed">{{ t('smartcontracts.history.eventTypes.chain_removed') }}</option>
                <option value="chain_updated">{{ t('smartcontracts.history.eventTypes.chain_updated') }}</option>
                <option value="quorum_updated">{{ t('smartcontracts.history.eventTypes.quorum_updated') }}</option>
                <option value="dle_info_updated">{{ t('smartcontracts.history.eventTypes.dle_info_updated') }}</option>
                <option value="proposal_execution_approved">{{ t('smartcontracts.history.eventTypes.proposal_execution_approved') }}</option>
              </select>
            </div>
            
            <div class="filter-group">
              <label for="dateFrom">{{ t('smartcontracts.history.dateFrom') }}</label>
              <input 
                id="dateFrom"
                v-model="filters.dateFrom" 
                type="date"
              >
            </div>
            
            <div class="filter-group">
              <label for="dateTo">{{ t('smartcontracts.history.dateTo') }}</label>
              <input 
                id="dateTo"
                v-model="filters.dateTo" 
                type="date"
              >
            </div>
            
            <!-- Убираем фильтр по статусу, так как все события успешны -->
          </div>
          
          <div class="filters-actions">
            <button @click="applyFilters" class="btn-primary">{{ t('smartcontracts.history.applyFilters') }}</button>
            <button @click="clearFilters" class="btn-secondary">{{ t('smartcontracts.history.reset') }}</button>
          </div>
        </div>
      </div>

      <!-- Статистика -->
      <div class="stats-section">
        <h2>{{ t('smartcontracts.history.statistics') }}</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <h3>{{ t('smartcontracts.history.totalEvents') }}</h3>
            <p class="stat-value">{{ totalOperations }}</p>
          </div>
          <div class="stat-card">
            <h3>{{ t('smartcontracts.history.proposals') }}</h3>
            <p class="stat-value">{{ history.filter(e => e.type.includes('proposal')).length }}</p>
          </div>
          <div class="stat-card">
            <h3>{{ t('smartcontracts.history.modules') }}</h3>
            <p class="stat-value">{{ history.filter(e => e.type.includes('module')).length }}</p>
          </div>
          <div class="stat-card">
            <h3>{{ t('smartcontracts.history.chains') }}</h3>
            <p class="stat-value">{{ history.filter(e => e.type.includes('chain')).length }}</p>
          </div>
        </div>
      </div>

      <!-- История событий -->
      <div class="history-section">
        <h2>{{ t('smartcontracts.history.eventHistory') }}</h2>
        <div class="history-controls">
          <div class="search-box">
            <input 
              v-model="searchQuery" 
              type="text" 
              :placeholder="t('smartcontracts.history.searchPlaceholder')"
              @input="filterHistory"
            >
          </div>
          <div class="sort-controls">
            <select v-model="sortBy" @change="sortHistory">
              <option value="timestamp">{{ t('smartcontracts.history.sortByDate') }}</option>
              <option value="type">{{ t('smartcontracts.history.sortByType') }}</option>
              <option value="title">{{ t('smartcontracts.history.sortByTitle') }}</option>
            </select>
            <button @click="toggleSortOrder" class="sort-btn">
              {{ sortOrder === 'desc' ? '↓' : '↑' }}
            </button>
          </div>
        </div>
        
        <div v-if="filteredHistory.length === 0" class="empty-state">
          <p>{{ t('smartcontracts.history.emptyState') }}</p>
        </div>
        <div v-else class="history-list">
          <div 
            v-for="event in filteredHistory" 
            :key="event.id" 
            class="history-item"
            :class="event.type"
          >
            <div class="event-icon">
              <span class="icon">{{ getEventIcon(event.type) }}</span>
            </div>
            
            <div class="event-content">
              <div class="event-header">
                <h3>{{ getEventTitle(event) }}</h3>
                <span class="event-status success">
                  {{ t('smartcontracts.history.success') }}
                </span>
              </div>
              
              <div class="event-details">
                <p class="event-description">{{ event.description }}</p>
                <div class="event-meta">
                  <span class="event-date">{{ formatDate(event.timestamp) }}</span>
                  <span class="event-hash">{{ t('smartcontracts.history.txPrefix') }} {{ formatHash(event.transactionHash) }}</span>
                  <span v-if="event.blockNumber" class="event-block">{{ t('smartcontracts.history.blockPrefix') }} {{ event.blockNumber }}</span>
                </div>
                <div v-if="event.details" class="event-data">
                  <div v-for="(value, key) in event.details" :key="key" class="data-item">
                    <span class="data-label">{{ key }}:</span>
                    <span class="data-value">{{ formatDataValue(value) }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="event-actions">
              <button @click="viewDetails(event)" class="btn-secondary">
                {{ t('common.details') }}
              </button>
              <button @click="viewOnExplorer(event)" class="btn-secondary">
                {{ t('smartcontracts.history.explorer') }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- Пагинация -->
        <div v-if="totalPages > 1" class="pagination">
          <button 
            @click="changePage(currentPage - 1)" 
            :disabled="currentPage === 1"
            class="page-btn"
          >
            ←
          </button>
          
          <span class="page-info">
            {{ t('smartcontracts.history.pageInfo', { current: currentPage, total: totalPages }) }}
          </span>
          
          <button 
            @click="changePage(currentPage + 1)" 
            :disabled="currentPage === totalPages"
            class="page-btn"
          >
            →
          </button>
        </div>
      </div>

      <!-- Модальное окно деталей -->
      <div v-if="showDetailsModal" class="modal-overlay" @click="showDetailsModal = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>{{ t('smartcontracts.history.modalTitle') }}</h3>
            <button @click="showDetailsModal = false" class="close-btn">✕</button>
          </div>
          <div class="modal-body">
            <div v-if="selectedEvent" class="event-details-full">
              <div class="detail-row">
                <span class="detail-label">{{ t('smartcontracts.history.type') }}</span>
                <span class="detail-value">{{ getEventTitle(selectedEvent) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">{{ t('smartcontracts.history.status') }}</span>
                <span class="detail-value success">
                  {{ t('smartcontracts.history.success') }}
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">{{ t('smartcontracts.history.date') }}</span>
                <span class="detail-value">{{ formatDate(selectedEvent.timestamp) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">{{ t('smartcontracts.history.transaction') }}</span>
                <span class="detail-value">{{ selectedEvent.transactionHash }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">{{ t('smartcontracts.history.block') }}</span>
                <span class="detail-value">{{ selectedEvent.blockNumber }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">{{ t('smartcontracts.history.descriptionLabel') }}</span>
                <span class="detail-value">{{ selectedEvent.description }}</span>
              </div>
              <div v-if="selectedEvent.details" class="detail-section">
                <h4>{{ t('smartcontracts.history.eventDetails') }}</h4>
                <div class="data-grid">
                  <div 
                    v-for="(value, key) in selectedEvent.details" 
                    :key="key"
                    class="data-item-full"
                  >
                    <span class="data-label">{{ key }}:</span>
                    <span class="data-value">{{ formatDataValue(value) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, defineProps, defineEmits, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';
import api from '../../api/axios';

const { t, locale } = useI18n();

// Определяем props
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();

// Получаем адрес DLE из URL параметров
const dleAddress = ref(route.query.address || '');

// Функция возврата к блокам управления
const goBackToBlocks = () => {
  if (dleAddress.value) {
    router.push(`/management/dle-blocks?address=${dleAddress.value}`);
  } else {
    router.push('/management');
  }
};

// Состояние
const selectedDle = ref(null);
const isLoadingDle = ref(false);
const showDetailsModal = ref(false);
const selectedEvent = ref(null);
const searchQuery = ref('');
const sortBy = ref('timestamp');
const sortOrder = ref('desc');
const currentPage = ref(1);
const itemsPerPage = ref(20);

// Фильтры
const filters = ref({
  eventType: '',
  dateFrom: '',
  dateTo: '',
  status: ''
});

// История операций (загружается из блокчейна)
const history = ref([]);

// Загрузка данных DLE
async function loadDleData() {
  try {
    isLoadingDle.value = true;
    
    if (!dleAddress.value) {
      console.error('Адрес DLE не указан');
      return;
    }

    // Читаем данные из блокчейна
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      selectedDle.value = response.data.data;
      
      // Загружаем историю событий
      await loadEventHistory();
    } else {
      console.error('[HistoryView] Ошибка загрузки DLE:', response.data.error);
    }
  } catch (error) {
    console.error('[HistoryView] Ошибка загрузки DLE:', error);
  } finally {
    isLoadingDle.value = false;
  }
}

// Загрузка истории событий
async function loadEventHistory() {
  try {
    // Загружаем расширенную историю из блокчейна
    const response = await api.post('/dle-history/get-extended-history', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      const historyData = response.data.data;
      history.value = historyData.history || [];
    } else {
      console.error('[HistoryView] Ошибка загрузки истории:', response.data.error);
      history.value = [];
    }
  } catch (error) {
    console.error('[HistoryView] Ошибка загрузки истории событий:', error);
    history.value = [];
  }
}

// Загружаем данные при монтировании компонента
onMounted(() => {
  if (dleAddress.value) {
    loadDleData();
  }
});

// Вычисляемые свойства
const filteredHistory = computed(() => {
  let filtered = history.value;
  
  // Фильтр по типу события
  if (filters.value.eventType) {
    filtered = filtered.filter(event => event.type === filters.value.eventType);
  }
  
  // Фильтр по статусу - убираем, так как все события успешны
  // if (filters.value.status) {
  //   filtered = filtered.filter(event => event.status === filters.value.status);
  // }
  
  // Фильтр по датам
  if (filters.value.dateFrom) {
    const fromDate = new Date(filters.value.dateFrom).getTime();
    filtered = filtered.filter(event => event.timestamp >= fromDate);
  }
  
  if (filters.value.dateTo) {
    const toDate = new Date(filters.value.dateTo).getTime();
    filtered = filtered.filter(event => event.timestamp <= toDate);
  }
  
  // Поиск
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(event => 
      event.title.toLowerCase().includes(query) ||
      event.description.toLowerCase().includes(query) ||
      (event.transactionHash && event.transactionHash.toLowerCase().includes(query))
    );
  }
  
  // Сортировка
  filtered.sort((a, b) => {
    let aValue = a[sortBy.value];
    let bValue = b[sortBy.value];
    
    if (sortBy.value === 'timestamp') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }
    
    if (sortOrder.value === 'desc') {
      return bValue > aValue ? 1 : -1;
    } else {
      return aValue > bValue ? 1 : -1;
    }
  });
  
  return filtered;
});

const totalOperations = computed(() => history.value.length);
const successfulOperations = computed(() => history.value.length); // Все события из блокчейна успешны
const failedOperations = computed(() => 0); // Нет неуспешных событий в блокчейне
const pendingOperations = computed(() => 0); // Нет ожидающих событий в блокчейне

const totalPages = computed(() => Math.ceil(filteredHistory.value.length / itemsPerPage.value));

// Методы
const applyFilters = () => {
  currentPage.value = 1;
};

const clearFilters = () => {
  filters.value = {
    eventType: '',
    dateFrom: '',
    dateTo: '',
    status: ''
  };
  searchQuery.value = '';
  currentPage.value = 1;
};

const filterHistory = () => {
  currentPage.value = 1;
};

const sortHistory = () => {
  currentPage.value = 1;
};

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
  currentPage.value = 1;
};

const changePage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

const getEventIcon = (type) => {
  const icons = {
    dle_created: '🏢',
    proposal_created: '📋',
    proposal_executed: '✅',
    proposal_cancelled: '❌',
    module_added: '🔧',
    module_removed: '🔧',
    chain_added: '🌐',
    chain_removed: '🌐',
    chain_updated: '🔄',
    quorum_updated: '📊',
    dle_info_updated: '📝',
    proposal_execution_approved: '👍'
  };
  return icons[type] || '📄';
};

const getEventTitle = (event) => {
  return event.title || t('smartcontracts.history.defaultOperation');
};

const getStatusText = () => {
  return t('smartcontracts.history.success');
};

const formatDate = (timestamp) => {
  const dateLocale = locale.value === 'en' ? 'en-US' : 'ru-RU';
  return new Date(timestamp).toLocaleString(dateLocale);
};

const formatHash = (hash) => {
  if (!hash) return '';
  return hash.substring(0, 10) + '...' + hash.substring(hash.length - 8);
};

const formatDataValue = (value) => {
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string' && value.startsWith('0x') && value.length === 42) {
    // Это адрес - форматируем его
    return value.substring(0, 6) + '...' + value.substring(value.length - 4);
  }
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return value;
};

const viewDetails = (event) => {
  selectedEvent.value = event;
  showDetailsModal.value = true;
};

const viewOnExplorer = (event) => {
  // Открываем в Sepolia Etherscan
  if (event.transactionHash && event.transactionHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
    window.open(`https://sepolia.etherscan.io/tx/${event.transactionHash}`, '_blank');
  }
};
</script>

<style scoped>
.history-container {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  margin-bottom: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.header-content {
  flex-grow: 1;
}

.page-header h1 {
  color: var(--color-primary);
  font-size: 2.5rem;
  margin: 0 0 10px 0;
}

.page-header p {
  color: var(--color-grey-dark);
  font-size: 1.1rem;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

/* Секции */
.filters-section,
.stats-section,
.history-section {
  margin-bottom: 40px;
}

.filters-section h2,
.stats-section h2,
.history-section h2 {
  color: var(--color-primary);
  margin-bottom: 20px;
  font-size: 1.8rem;
}

/* Фильтры */
.filters-form {
  background: #f8f9fa;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
}

.filters-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-group label {
  font-weight: 600;
  color: var(--color-grey-dark);
}

.filter-group input,
.filter-group select {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: var(--radius-sm);
  font-size: 1rem;
}

.filters-actions {
  display: flex;
  gap: 15px;
}

/* Статистика */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-card {
  background: #f8f9fa;
  padding: 25px;
  border-radius: var(--radius-lg);
  border-left: 4px solid var(--color-primary);
  text-align: center;
}

.stat-card h3 {
  color: var(--color-primary);
  margin-bottom: 15px;
  font-size: 1rem;
  text-transform: uppercase;
  font-weight: 600;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  color: var(--color-primary);
}

.stat-value.success {
  color: #28a745;
}

.stat-value.error {
  color: #dc3545;
}

.stat-value.pending {
  color: #ffc107;
}

/* История операций */
.history-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 20px;
}

.search-box {
  flex-grow: 1;
}

.search-box input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: var(--radius-sm);
  font-size: 1rem;
}

.sort-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sort-controls select {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: var(--radius-sm);
  font-size: 1rem;
}

.sort-btn {
  background: var(--color-secondary);
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
}

/* Список истории */
.history-list {
  display: grid;
  gap: 20px;
}

.history-item {
  display: flex;
  gap: 20px;
  padding: 25px;
  background: white;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.history-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.history-item.success {
  border-left: 4px solid #28a745;
}

.history-item.pending {
  border-left: 4px solid #ffc107;
}

.history-item.failed {
  border-left: 4px solid #dc3545;
}

.event-icon {
  flex-shrink: 0;
}

.event-icon .icon {
  font-size: 2rem;
  display: block;
}

.event-content {
  flex-grow: 1;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.event-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.2rem;
}

.event-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.event-status.success {
  background: #d4edda;
  color: #155724;
}

.event-status.pending {
  background: #fff3cd;
  color: #856404;
}

.event-status.failed {
  background: #f8d7da;
  color: #721c24;
}

.event-description {
  margin: 0 0 15px 0;
  color: var(--color-grey-dark);
  line-height: 1.5;
}

.event-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
}

.event-hash,
.event-block {
  font-family: monospace;
}

.event-data {
  display: grid;
  gap: 8px;
}

.data-item {
  display: flex;
  gap: 10px;
  font-size: 0.9rem;
}

.data-label {
  font-weight: 600;
  color: var(--color-grey-dark);
  min-width: 120px;
}

.data-value {
  color: var(--color-primary);
}

.event-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

/* Пагинация */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 30px;
}

.page-btn {
  background: var(--color-secondary);
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.page-btn:hover:not(:disabled) {
  background: var(--color-secondary-dark);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 1rem;
  color: var(--color-grey-dark);
}

/* Модальное окно */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  margin: 0;
  color: var(--color-primary);
}

.modal-body {
  padding: 20px;
}

.event-details-full {
  display: grid;
  gap: 15px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.detail-label {
  font-weight: 600;
  color: var(--color-grey-dark);
}

.detail-value {
  color: var(--color-primary);
  font-family: monospace;
  word-break: break-all;
}

.detail-section {
  margin-top: 20px;
}

.detail-section h4 {
  color: var(--color-primary);
  margin-bottom: 15px;
}

.data-grid {
  display: grid;
  gap: 10px;
}

.data-item-full {
  display: flex;
  gap: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
}

/* Кнопки */
.btn-primary {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
}

.btn-secondary {
  background: var(--color-secondary);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  background: var(--color-secondary-dark);
}

/* Состояния */
.empty-state {
  text-align: center;
  padding: 60px;
  color: var(--color-grey-dark);
  background: #f8f9fa;
  border-radius: var(--radius-lg);
  border: 2px dashed #dee2e6;
}

.empty-state p {
  margin: 0;
  font-size: 1.1rem;
}

/* Адаптивность */
@media (max-width: 768px) {
  .filters-row {
    grid-template-columns: 1fr;
  }
  
  .history-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .history-item {
    flex-direction: column;
    gap: 15px;
  }
  
  .event-actions {
    flex-direction: row;
    justify-content: flex-start;
  }
  
  .event-meta {
    flex-direction: column;
    gap: 5px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .filters-actions {
    flex-direction: column;
  }
  
  .detail-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
}
</style> 