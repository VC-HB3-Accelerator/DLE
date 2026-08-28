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
    <div class="history-container page-with-close">
      <PageCloseButton :on-navigate="goBackToBlocks" />
      <!-- Фильтры -->
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div v-if="selectedDle?.dleAddress || dleAddress" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ selectedDle?.dleAddress || dleAddress }}
        </div>
        <div v-else-if="isLoadingDle" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ t('common.loading') }}
        </div>
      </div>
      <div v-if="dleAddress" class="voting-chain-hub">
        <VotingChainSelect
          v-model="votingChain"
          :chains="votingChains"
          :is-loading="isLoadingVotingChains"
          :label="t('smartcontracts.history.networkLabel')"
          :placeholder="t('smartcontracts.history.networkPlaceholder')"
          :hint="t('smartcontracts.history.networkHint')"
          select-id="historyChain"
        />
        <p class="voting-chain-hub__note">{{ t('smartcontracts.history.networkNote') }}</p>
      </div>
      <div v-if="!hasVotingChain" class="select-network-first">
        <p>{{ t('smartcontracts.history.selectNetworkFirst') }}</p>
      </div>
      <template v-else>
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
            <button @click="applyFilters" class="btn-action">{{ t('smartcontracts.history.applyFilters') }}</button>
            <button @click="clearFilters" class="btn-action">{{ t('smartcontracts.history.reset') }}</button>
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
            <button @click="toggleSortOrder" class="btn-action sort-btn">
              {{ sortOrder === 'desc' ? t('smartcontracts.history.sortDesc') : t('smartcontracts.history.sortAsc') }}
            </button>
          </div>
        </div>
        
        <div v-if="filteredHistory.length === 0" class="empty-state">
          <p>{{ t('smartcontracts.history.emptyState') }}</p>
        </div>
        <div v-else class="history-list">
          <div 
            v-for="event in pagedHistory" 
            :key="event.uniqueId || `${event.type}-${event.blockNumber}-${event.transactionHash}-${event.id}`" 
            class="history-item"
          >
            <div class="event-content">
              <div class="event-header">
                <h3>{{ getEventTitle(event) }}</h3>
                <span class="event-status">
                  {{ t('smartcontracts.history.success') }}
                </span>
              </div>
              
              <div class="event-details">
                <p class="event-description">{{ getEventDescription(event) }}</p>
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
              <button @click="viewDetails(event)" class="btn-action">
                {{ t('common.details') }}
              </button>
              <button @click="viewOnExplorer(event)" class="btn-action">
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
            class="btn-action"
          >
            {{ t('common.prev') }}
          </button>
          
          <span class="page-info">
            {{ t('smartcontracts.history.pageInfo', { current: currentPage, total: totalPages }) }}
          </span>
          
          <button 
            @click="changePage(currentPage + 1)" 
            :disabled="currentPage === totalPages"
            class="btn-action"
          >
            {{ t('common.next') }}
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
                <span class="detail-value">
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
                <span class="detail-value">{{ getEventDescription(selectedEvent) }}</span>
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
      </template>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, defineProps, defineEmits, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import VotingChainSelect from '@/components/VotingChainSelect.vue';
import { useVotingChains } from '@/composables/useVotingChains.js';
import api from '../../api/axios';
import { translateIfExists, hasCyrillic, localeSafeFallback } from '../../utils/helpers.js';

const { t, locale, messages } = useI18n();

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

const {
  chains: votingChains,
  votingChain,
  isLoading: isLoadingVotingChains,
  hasVotingChain,
} = useVotingChains(dleAddress);

function selectedChainId() {
  const n = Number(votingChain.value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function withChain(extra = {}) {
  const body = { dleAddress: dleAddress.value, ...extra };
  const cid = selectedChainId();
  if (cid) body.chainId = cid;
  return body;
}

function persistChainQuery() {
  const cid = selectedChainId();
  if (!cid) return;
  if (String(route.query.votingChain || '') === String(cid)) return;
  router.replace({
    query: {
      ...route.query,
      address: dleAddress.value,
      votingChain: String(cid),
    },
  });
}

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

    if (!dleAddress.value || !selectedChainId()) {
      return;
    }

    // История первой (без тяжёлого read-dle-info), чтобы страница не «висела»
    const historyPromise = loadEventHistory();

    try {
      const response = await api.post('/blockchain/read-dle-info', withChain());
      if (response.data.success) {
        selectedDle.value = response.data.data;
      } else {
        console.error('[HistoryView] Ошибка загрузки DLE:', response.data.error);
        selectedDle.value = { dleAddress: dleAddress.value };
      }
    } catch (error) {
      console.error('[HistoryView] Ошибка загрузки DLE:', error);
      selectedDle.value = { dleAddress: dleAddress.value };
    }

    await historyPromise;
  } finally {
    isLoadingDle.value = false;
  }
}

// Загрузка истории событий
async function loadEventHistory() {
  try {
    // Загружаем расширенную историю из блокчейна
    const response = await api.post('/dle-history/get-extended-history', withChain());
    
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
watch(votingChain, (cid) => {
  if (Number(cid) > 0) {
    persistChainQuery();
    loadDleData();
  }
});

// Вычисляемые свойства
const filteredHistory = computed(() => {
  // ВАЖНО: всегда новая копия — .sort на history.value вызывает бесконечный цикл реактивности
  let filtered = [...history.value];

  if (filters.value.eventType) {
    filtered = filtered.filter((event) => event.type === filters.value.eventType);
  }

  if (filters.value.dateFrom) {
    const fromDate = new Date(filters.value.dateFrom).getTime();
    filtered = filtered.filter((event) => Number(event.timestamp) >= fromDate);
  }

  if (filters.value.dateTo) {
    const toDate = new Date(filters.value.dateTo).getTime() + 24 * 60 * 60 * 1000 - 1;
    filtered = filtered.filter((event) => Number(event.timestamp) <= toDate);
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (event) =>
        getEventTitle(event).toLowerCase().includes(query) ||
        getEventDescription(event).toLowerCase().includes(query) ||
        (event.transactionHash && event.transactionHash.toLowerCase().includes(query))
    );
  }

  const dir = sortOrder.value === 'desc' ? -1 : 1;
  filtered.sort((a, b) => {
    let aValue = a[sortBy.value];
    let bValue = b[sortBy.value];

    if (sortBy.value === 'timestamp') {
      aValue = Number(aValue) || 0;
      bValue = Number(bValue) || 0;
    } else {
      aValue = String(aValue ?? '');
      bValue = String(bValue ?? '');
    }

    if (aValue === bValue) return 0;
    return aValue > bValue ? dir : -dir;
  });

  return filtered;
});

const totalOperations = computed(() => history.value.length);
const successfulOperations = computed(() => history.value.length);
const failedOperations = computed(() => 0);
const pendingOperations = computed(() => 0);

const totalPages = computed(() => Math.max(1, Math.ceil(filteredHistory.value.length / itemsPerPage.value)));

const pagedHistory = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return filteredHistory.value.slice(start, start + itemsPerPage.value);
});

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

function msgTree() {
  return messages.value?.[locale.value] || messages.value?.en;
}

function localizedModuleName(event) {
  const type = event?.details?.moduleType;
  const key = `smartcontracts.createProposal.modules.${type}.title`;
  if (!type) return event?.details?.moduleName || '';
  return translateIfExists(
    t,
    key,
    undefined,
    localeSafeFallback(locale.value, event?.details?.moduleName || ''),
    msgTree()
  );
}

function proposalIdOf(event) {
  const id = event?.details?.proposalId;
  if (id === 0 || id) return id;
  const m = String(event?.title || '').match(/#(\d+)/);
  return m ? m[1] : '';
}

const getEventTitle = (event) => {
  const type = event?.type || '';
  const id = proposalIdOf(event);
  const params = {
    id,
    name: event?.details?.name || '',
    symbol: event?.details?.symbol || '',
    module: localizedModuleName(event),
    chain: event?.details?.chainName || '',
  };
  const key = `smartcontracts.history.eventTitles.${type}`;
  const translated = translateIfExists(t, key, params, '', msgTree());
  if (translated) return translated;
  const fallback = event.title || t('smartcontracts.history.defaultOperation');
  if (locale.value !== 'ru' && hasCyrillic(fallback)) {
    return t('smartcontracts.history.defaultOperation');
  }
  return fallback;
};

const BACKEND_RU_COPY = /^(DLE создан|Создан DLE|Предложение #|Предложение успешно|Предложение "|Изменен кворум|Обновлена информация|Модуль |Сеть |Исполнение предложения)/;

const getEventDescription = (event) => {
  const type = event?.type || '';
  const raw = String(event?.description || '');
  if (type === 'proposal_created' && raw) return raw;
  if (type === 'proposal_executed' && event?.details?.fromSummary && raw && !BACKEND_RU_COPY.test(raw)) {
    return raw;
  }
  const key = `smartcontracts.history.eventDescriptions.${type}`;
  const translated = translateIfExists(t, key, {
    id: proposalIdOf(event),
    name: event?.details?.name || '',
    symbol: event?.details?.symbol || '',
    module: localizedModuleName(event),
    chain: event?.details?.chainName || '',
    chainId: event?.details?.chainId ?? '',
    oldQuorum: event?.details?.oldQuorum ?? '',
    newQuorum: event?.details?.newQuorum ?? '',
    reason: event?.details?.reason || '',
  }, '', msgTree());
  if (translated) return translated;
  if (raw && !BACKEND_RU_COPY.test(raw)) return raw;
  if (locale.value !== 'ru' && hasCyrillic(raw)) return '';
  return raw;
};

const formatDate = (timestamp) => {
  const dateLocale = locale.value === 'en' ? 'en-US' : 'ru-RU';
  const n = Number(timestamp);
  // backend иногда кладёт blockNumber*1000 вместо unix ms — не форматируем как дату
  if (!Number.isFinite(n) || n < 1e11 || n > 1e14) {
    return n ? String(n) : '—';
  }
  return new Date(n).toLocaleString(dateLocale);
};

const formatHash = (hash) => {
  if (!hash) return '';
  return hash.substring(0, 10) + '...' + hash.substring(hash.length - 8);
};

const formatDataValue = (value) => {
  if (value == null) return '';
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((v) => formatDataValue(v)).join(', ');
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
    } catch (_) {
      return String(value);
    }
  }
  if (typeof value === 'string' && value.startsWith('0x') && value.length === 42) {
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
  const hash = event?.transactionHash;
  if (!hash || hash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    return;
  }
  const cid = Number(event.chainId || event.details?.chainId || votingChain.value);
  const bases = {
    1: 'https://etherscan.io/tx/',
    11155111: 'https://sepolia.etherscan.io/tx/',
    17000: 'https://holesky.etherscan.io/tx/',
    84532: 'https://sepolia.basescan.org/tx/',
    8453: 'https://basescan.org/tx/',
    137: 'https://polygonscan.com/tx/',
    80002: 'https://amoy.polygonscan.com/tx/',
    42161: 'https://arbiscan.io/tx/',
    421614: 'https://sepolia.arbiscan.io/tx/',
    56: 'https://bscscan.com/tx/',
  };
  const base = bases[cid] || 'https://etherscan.io/tx/';
  window.open(`${base}${hash}`, '_blank');
};
</script>

<style scoped>
.history-container {
  position: relative;
  padding: 20px;
  background: transparent;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-grey-light, #e9ecef);
  margin-top: 20px;
  margin-bottom: 20px;
}

.voting-chain-hub {
  max-width: 520px;
  margin: 0 0 1.5rem;
}

.voting-chain-hub__note {
  margin: -8px 0 0;
  font-size: 0.85rem;
  color: var(--color-grey-dark, #555);
}

.select-network-first {
  padding: 12px 0 24px;
  color: var(--color-grey-dark, #555);
}

.close-btn {
  width: 40px;
  height: 40px;
  min-width: 40px;
  background-color: var(--color-white);
  color: var(--color-dark, #333);
  border: 1px solid var(--color-grey, #ced4da);
  border-radius: var(--radius-lg);
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: background-color 0.2s, border-color 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background-color: var(--color-grey-light, #e9ecef);
  border-color: var(--color-dark, #333);
}

.filters-section,
.stats-section,
.history-section {
  margin-bottom: 32px;
}

.filters-section h2,
.stats-section h2,
.history-section h2 {
  color: var(--color-dark, #333);
  margin-bottom: 16px;
  font-size: 1.25rem;
  font-weight: 600;
}

.filters-form {
  background: var(--theme-bg, #fff);
  padding: 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-grey-light, #e9ecef);
}

.filters-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-group label {
  font-weight: 600;
  color: var(--color-dark, #333);
  font-size: 0.9rem;
}

.filter-group input,
.filter-group select,
.search-box input,
.sort-controls select {
  padding: 10px 12px;
  border: 1px solid var(--color-grey-light, #e4e7ed);
  border-radius: var(--radius-lg);
  font-size: 0.95rem;
  background: var(--color-white);
  color: var(--color-dark, #333);
}

.filters-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.stat-card {
  background: var(--theme-bg, #fff);
  padding: 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-grey-light, #e9ecef);
  text-align: center;
}

.stat-card h3 {
  color: var(--color-dark, #333);
  margin-bottom: 10px;
  font-size: 0.85rem;
  font-weight: 600;
}

.stat-value {
  font-size: 1.6rem;
  font-weight: 600;
  margin: 0;
  color: var(--color-dark, #333);
}

.history-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 16px;
}

.search-box {
  flex-grow: 1;
}

.search-box input {
  width: 100%;
  box-sizing: border-box;
}

.sort-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-action {
  height: 40px;
  background-color: var(--theme-bg, #fff);
  color: var(--color-dark, #333);
  border: 1px solid var(--color-grey-light, #e4e7ed);
  border-radius: var(--radius-lg);
  padding: 0 16px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: background-color 0.2s, border-color 0.2s;
}

.btn-action:hover:not(:disabled) {
  background-color: var(--color-grey-light, #e9ecef);
  border-color: var(--color-grey, #ced4da);
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sort-btn {
  white-space: nowrap;
}

.history-list {
  display: grid;
  gap: 12px;
}

.history-item {
  display: flex;
  gap: 16px;
  padding: 18px;
  background: var(--color-white);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-grey-light, #e9ecef);
}

.event-content {
  flex-grow: 1;
  min-width: 0;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.event-header h3 {
  margin: 0;
  color: var(--color-dark, #333);
  font-size: 1.05rem;
  font-weight: 600;
}

.event-status {
  padding: 4px 10px;
  border-radius: var(--radius-lg);
  font-size: 0.8rem;
  font-weight: 500;
  background: var(--theme-bg, #fff);
  color: var(--color-dark, #333);
  border: 1px solid var(--color-grey-light, #e4e7ed);
  white-space: nowrap;
}

.event-description {
  margin: 0 0 12px 0;
  color: var(--color-grey-dark, #666);
  line-height: 1.5;
}

.event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-bottom: 12px;
  font-size: 0.875rem;
  color: var(--color-grey-dark, #666);
}

.event-hash,
.event-block {
  font-family: monospace;
}

.event-data {
  display: grid;
  gap: 6px;
}

.data-item {
  display: flex;
  gap: 10px;
  font-size: 0.9rem;
}

.data-label {
  font-weight: 600;
  color: var(--color-grey-dark, #666);
  min-width: 120px;
}

.data-value {
  color: var(--color-dark, #333);
}

.event-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.page-info {
  font-size: 0.95rem;
  color: var(--color-grey-dark, #666);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-grey-light, #e9ecef);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-grey-light, #e9ecef);
}

.modal-header h3 {
  margin: 0;
  color: var(--color-dark, #333);
  font-size: 1.1rem;
}

.modal-body {
  padding: 20px;
}

.event-details-full {
  display: grid;
  gap: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-grey-light, #eee);
}

.detail-label {
  font-weight: 600;
  color: var(--color-grey-dark, #666);
}

.detail-value {
  color: var(--color-dark, #333);
  font-family: monospace;
  word-break: break-all;
  text-align: right;
}

.detail-section {
  margin-top: 16px;
}

.detail-section h4 {
  color: var(--color-dark, #333);
  margin-bottom: 12px;
}

.data-grid {
  display: grid;
  gap: 8px;
}

.data-item-full {
  display: flex;
  gap: 12px;
  padding: 10px;
  background: var(--theme-bg, #fff);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-grey-light, #e9ecef);
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--color-grey-dark, #666);
  background: var(--theme-bg, #fff);
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-grey, #ced4da);
}

.empty-state p {
  margin: 0;
  font-size: 1rem;
}

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
    gap: 12px;
  }

  .event-actions {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .event-meta {
    flex-direction: column;
    gap: 6px;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .filters-actions {
    flex-direction: column;
  }

  .filters-actions .btn-action {
    width: 100%;
  }

  .detail-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .detail-value {
    text-align: left;
  }
}


/* TZ package G/SC stack */
@media (max-width: 768px) {
  [class*="grid"], .form-row, .management-blocks {
    grid-template-columns: 1fr !important;
  }
  .row, .actions, .toolbar, .filters, .form-actions {
    flex-wrap: wrap;
  }
}
</style> 