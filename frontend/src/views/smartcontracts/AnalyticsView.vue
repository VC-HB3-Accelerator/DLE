<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="analytics-container">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Аналитика DLE</h1>
          <p v-if="selectedDle">{{ selectedDle.name }} ({{ selectedDle.symbol }}) - {{ formatAddress(dleAddress) }}</p>
          <p v-else-if="isLoadingDle">Загрузка...</p>
          <p v-else>Подробная аналитика и статистика DLE</p>
        </div>
        <button class="close-btn" @click="goBackToBlocks">×</button>
      </div>

      <!-- Основная информация -->
      <div class="info-section">
        <h2>Основная информация</h2>
        <div class="info-grid">
          <div class="info-card">
            <h3>Название</h3>
            <p class="info-value">{{ selectedDle?.name || 'Загрузка...' }}</p>
          </div>
          <div class="info-card">
            <h3>Символ</h3>
            <p class="info-value">{{ selectedDle?.symbol || 'Загрузка...' }}</p>
          </div>
          <div class="info-card">
            <h3>Статус</h3>
            <p class="info-value" :class="selectedDle?.isActive ? 'status-active' : 'status-inactive'">
              {{ selectedDle?.isActive ? 'Активен' : 'Неактивен' }}
            </p>
          </div>
          <div class="info-card">
            <h3>Дата создания</h3>
            <p class="info-value">{{ formatDate(selectedDle?.creationTimestamp) }}</p>
          </div>
          <div class="info-card">
            <h3>Местоположение</h3>
            <p class="info-value">{{ selectedDle?.location || 'Не указано' }}</p>
          </div>
          <div class="info-card">
            <h3>Юрисдикция</h3>
            <p class="info-value">{{ selectedDle?.jurisdiction || 'Не указано' }}</p>
          </div>
        </div>
      </div>

      <!-- Токеномика -->
      <div class="tokenomics-section">
        <h2>Токеномика</h2>
        <div class="tokenomics-grid">
          <div class="tokenomics-card">
            <h3>Общий объем токенов</h3>
            <p class="tokenomics-value">{{ formatNumber(tokenomics.totalSupply) }}</p>
            <p class="tokenomics-label">Токенов в обращении</p>
          </div>
          <div class="tokenomics-card">
            <h3>Держатели токенов</h3>
            <p class="tokenomics-value">{{ tokenomics.holdersCount }}</p>
            <p class="tokenomics-label">Активных держателей</p>
          </div>
          <div class="tokenomics-card">
            <h3>Крупнейший держатель</h3>
            <p class="tokenomics-value">{{ tokenomics.topHolderPercentage }}%</p>
            <p class="tokenomics-label">{{ formatAddress(tokenomics.topHolderAddress) }}</p>
          </div>
              </div>
            </div>

      <!-- Управление -->
      <div class="governance-section">
        <h2>Управление</h2>
        <div class="governance-grid">
          <div class="governance-card">
            <h3>Всего предложений</h3>
            <p class="governance-value">{{ governance.totalProposals }}</p>
          </div>
          <div class="governance-card">
            <h3>Исполнено</h3>
            <p class="governance-value">{{ governance.executedProposals }}</p>
          </div>
          <div class="governance-card">
            <h3>Отклонено</h3>
            <p class="governance-value">{{ governance.defeatedProposals }}</p>
          </div>
          <div class="governance-card">
            <h3>Кворум</h3>
            <p class="governance-value">{{ governance.quorumPercentage }}%</p>
          </div>
          <div class="governance-card">
            <h3>Поддерживаемые сети</h3>
            <p class="governance-value">{{ governance.supportedChainsCount }}</p>
            </div>
          <div class="governance-card">
            <h3>Текущая сеть</h3>
            <p class="governance-value">{{ getChainName(governance.currentChainId) }}</p>
          </div>
        </div>
              </div>

      <!-- Статистика предложений -->
      <div class="proposals-section">
        <h2>Статистика предложений</h2>
        <div class="proposals-grid">
          <div class="proposals-card">
            <h3>Статусы предложений</h3>
            <div class="proposals-stats">
              <div class="stat-item">
                <span class="stat-label">Ожидают голосования</span>
                <span class="stat-value">{{ proposalsStats.pending }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Успешные</span>
                <span class="stat-value">{{ proposalsStats.succeeded }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Отклоненные</span>
                <span class="stat-value">{{ proposalsStats.defeated }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Исполненные</span>
                <span class="stat-value">{{ proposalsStats.executed }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Отмененные</span>
                <span class="stat-value">{{ proposalsStats.canceled }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Готовы к исполнению</span>
                <span class="stat-value">{{ proposalsStats.readyForExecution }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Модули -->
      <div class="modules-section">
        <h2>Модули</h2>
        <div class="modules-grid">
          <div class="modules-card">
            <h3>Активные модули</h3>
            <div class="modules-list">
              <div v-if="modules.length === 0" class="no-modules">
                <p>Нет активных модулей</p>
              </div>
              <div 
                v-for="module in modules" 
                :key="module.id"
                class="module-item"
              >
                <div class="module-info">
                  <span class="module-id">{{ module.id }}</span>
                  <span class="module-address">{{ formatAddress(module.address) }}</span>
                </div>
                <div class="module-status">
                  <span class="status-badge active">Активен</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Мульти-чейн -->
      <div class="multichain-section">
        <h2>Мульти-чейн</h2>
        <div class="multichain-grid">
          <div class="multichain-card">
            <h3>Поддерживаемые сети</h3>
            <div class="chains-list">
              <div 
                v-for="chainId in multichain.supportedChains" 
                :key="chainId"
                class="chain-item"
              >
                <span class="chain-name">{{ getChainName(chainId) }}</span>
                <span class="chain-id">ID: {{ chainId }}</span>
              </div>
            </div>
          </div>
            </div>
          </div>

      <!-- Топ держатели -->
      <div class="holders-section">
        <h2>Топ держатели токенов</h2>
        <div class="holders-grid">
          <div class="holders-card">
            <div class="holders-list">
              <div 
                v-for="(holder, index) in topHolders" 
                :key="holder.address"
                class="holder-item"
              >
                <div class="holder-rank">#{{ index + 1 }}</div>
                <div class="holder-info">
                  <div class="holder-address">{{ formatAddress(holder.address) }}</div>
                  <div class="holder-balance">{{ formatNumber(holder.balance) }} токенов</div>
                </div>
                <div class="holder-percentage">{{ holder.percentage.toFixed(2) }}%</div>
            </div>
              <div v-if="topHolders.length === 0" class="no-holders">
                <p>Нет данных о держателях токенов</p>
          </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, defineProps, defineEmits, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import api from '../../api/axios';

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

// Данные аналитики
const tokenomics = ref({
  totalSupply: 0,
  holdersCount: 0,
  topHolderAddress: '',
  topHolderPercentage: 0
});

const governance = ref({
  totalProposals: 0,
  executedProposals: 0,
  defeatedProposals: 0,
  quorumPercentage: 0,
  supportedChainsCount: 0,
  currentChainId: 0
});

const proposalsStats = ref({
  pending: 0,
  succeeded: 0,
  defeated: 0,
  executed: 0,
  canceled: 0,
  readyForExecution: 0
});

const modules = ref([]);
const multichain = ref({
  supportedChains: []
});

const topHolders = ref([]);

// Загрузка данных DLE
async function loadDleData() {
  try {
    isLoadingDle.value = true;
    
    if (!dleAddress.value) {
      console.error('Адрес DLE не указан');
      return;
    }

    console.log('[AnalyticsView] Загрузка данных DLE:', dleAddress.value);
    
    // Читаем данные из блокчейна
    const response = await api.post('/dle-core/read-dle-info', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      selectedDle.value = response.data.data;
      console.log('[AnalyticsView] Данные DLE загружены:', selectedDle.value);
      
      // Загружаем все аналитические данные
      await Promise.all([
        loadTokenomics(),
        loadGovernance(),
        loadProposalsStats(),
        loadModules(),
        loadMultichain(),
        loadTopHolders()
      ]);
    } else {
      console.error('[AnalyticsView] Ошибка загрузки DLE:', response.data.error);
    }
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки DLE:', error);
  } finally {
    isLoadingDle.value = false;
  }
}

// Загрузка токеномики
async function loadTokenomics() {
  try {
    const response = await api.post('/dle-tokens/get-total-supply', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      tokenomics.value.totalSupply = response.data.data.totalSupply;
      
      // Получаем держателей токенов
      const holdersResponse = await api.post('/dle-tokens/get-token-holders', {
        dleAddress: dleAddress.value
      });
      
      if (holdersResponse.data.success) {
        const holders = holdersResponse.data.data.holders;
        tokenomics.value.holdersCount = holders.length;
        
        if (holders.length > 0) {
          const topHolder = holders[0];
          tokenomics.value.topHolderAddress = topHolder.address;
          tokenomics.value.topHolderPercentage = topHolder.percentage;
        }
      }
    }
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки токеномики:', error);
  }
}

// Загрузка данных управления
async function loadGovernance() {
  try {
    const response = await api.post('/dle-core/get-governance-params', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      const data = response.data.data;
      governance.value.quorumPercentage = data.quorumPct;
      governance.value.currentChainId = data.chainId;
      governance.value.supportedChainsCount = data.supportedCount;
    }
    
    // Получаем количество предложений
    const proposalsResponse = await api.post('/dle-proposals/get-proposals-count', {
      dleAddress: dleAddress.value
    });
    
    if (proposalsResponse.data.success) {
      governance.value.totalProposals = proposalsResponse.data.data.count;
    }
    
    // Получаем статистику предложений
    const listResponse = await api.post('/dle-proposals/get-proposals', {
      dleAddress: dleAddress.value
    });
    
    if (listResponse.data.success) {
      const proposals = listResponse.data.data.proposals || [];
      let executed = 0;
      let defeated = 0;
      
      for (const proposal of proposals) {
        if (proposal.executed) executed++;
        else if (proposal.state === 2) defeated++; // Defeated
      }
      
      governance.value.executedProposals = executed;
      governance.value.defeatedProposals = defeated;
    }
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки управления:', error);
  }
}

// Загрузка статистики предложений
async function loadProposalsStats() {
  try {
    const response = await api.post('/dle-proposals/get-proposals', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      const proposals = response.data.data.proposals || [];
      const stats = {
        pending: 0,
        succeeded: 0,
        defeated: 0,
        executed: 0,
        canceled: 0,
        readyForExecution: 0
      };
      
      for (const proposal of proposals) {
        // Определяем статус предложения по той же логике что и в DleProposalsView
        let status = 'active';
        const now = Math.floor(Date.now() / 1000);
        const deadline = proposal.deadline || 0;
        
        if (proposal.canceled) {
          status = 'canceled';
        } else if (proposal.executed) {
          status = 'executed';
        } else if (deadline > 0 && now >= deadline) {
          // Если дедлайн истек, определяем результат по голосам
          const forVotes = Number(proposal.forVotes) || 0;
          const againstVotes = Number(proposal.againstVotes) || 0;
          
          if (forVotes > againstVotes) {
            status = 'succeeded';
          } else {
            status = 'defeated';
          }
        } else {
          // Если дедлайн не истек, но есть голоса, определяем текущий статус
          const forVotes = Number(proposal.forVotes) || 0;
          const againstVotes = Number(proposal.againstVotes) || 0;
          
          if (forVotes > 0 || againstVotes > 0) {
            if (forVotes > againstVotes) {
              status = 'succeeded';
            } else if (againstVotes > forVotes) {
              status = 'defeated';
            }
          }
        }
        
        switch (status) {
          case 'active': stats.pending++; break;
          case 'succeeded': stats.succeeded++; break;
          case 'defeated': stats.defeated++; break;
          case 'executed': stats.executed++; break;
          case 'canceled': stats.canceled++; break;
          default: stats.pending++; break;
        }
      }
      
      proposalsStats.value = stats;
    }
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки статистики предложений:', error);
  }
}

// Загрузка модулей
async function loadModules() {
  try {
    const response = await api.post('/dle-modules/get-all-modules', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      modules.value = response.data.data.modules || [];
    }
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки модулей:', error);
  }
}

// Загрузка мульти-чейн данных
async function loadMultichain() {
  try {
    const response = await api.post('/dle-multichain/get-supported-chains', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      multichain.value.supportedChains = response.data.data.chains || [];
    }
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки мульти-чейн данных:', error);
  }
}

// Загрузка топ держателей
async function loadTopHolders() {
  try {
    const response = await api.post('/dle-tokens/get-token-holders', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      topHolders.value = response.data.data.holders || [];
    }
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки топ держателей:', error);
  }
}

// Методы
const formatAddress = (address) => {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};

const formatNumber = (number) => {
  if (!number) return '0';
  return Number(number).toLocaleString();
};

const formatDate = (timestamp) => {
  if (!timestamp) return 'Не указано';
  return new Date(Number(timestamp) * 1000).toLocaleDateString('ru-RU');
};

const getChainName = (chainId) => {
  const chains = {
    1: 'Ethereum Mainnet',
    11155111: 'Sepolia Testnet',
    17000: 'Holesky Testnet',
    84532: 'Base Sepolia Testnet',
    80002: 'Polygon Amoy Testnet',
    421614: 'Arbitrum Sepolia Testnet',
    137: 'Polygon',
    56: 'BSC',
    42161: 'Arbitrum One'
  };
  return chains[chainId] || `Chain ID: ${chainId}`;
};

// Загружаем данные при монтировании компонента
onMounted(() => {
  if (dleAddress.value) {
    loadDleData();
  }
});
</script>

<style scoped>
.analytics-container {
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
.info-section,
.tokenomics-section,
.governance-section,
.proposals-section,
.modules-section,
.multichain-section,
.holders-section {
  margin-bottom: 40px;
}

.info-section h2,
.tokenomics-section h2,
.governance-section h2,
.proposals-section h2,
.modules-section h2,
.multichain-section h2,
.holders-section h2 {
  color: var(--color-primary);
  margin-bottom: 20px;
  font-size: 1.8rem;
}

/* Основная информация */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.info-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: var(--radius-lg);
  border-left: 4px solid var(--color-primary);
}

.info-card h3 {
  color: var(--color-primary);
  margin-bottom: 10px;
  font-size: 1rem;
  text-transform: uppercase;
  font-weight: 600;
}

.info-value {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
  color: var(--color-grey-dark);
}

.status-active {
  color: #28a745 !important;
}

.status-inactive {
  color: #dc3545 !important;
}

/* Токеномика */
.tokenomics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.tokenomics-card {
  background: white;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
  text-align: center;
}

.tokenomics-card h3 {
  color: var(--color-primary);
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.tokenomics-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--color-primary);
  margin: 10px 0;
}

.tokenomics-label {
  color: var(--color-grey-dark);
  font-size: 0.9rem;
  margin: 0;
}

/* Управление */
.governance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.governance-card {
  background: white;
  padding: 20px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
  text-align: center;
}

.governance-card h3 {
  color: var(--color-primary);
  margin-bottom: 10px;
  font-size: 1rem;
}

.governance-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-secondary);
  margin: 0;
}

/* Предложения */
.proposals-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.proposals-card {
  background: white;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
}

.proposals-card h3 {
  color: var(--color-primary);
  margin-bottom: 20px;
  font-size: 1.3rem;
}

.proposals-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
}

.stat-label {
  color: var(--color-grey-dark);
  font-size: 0.9rem;
}

.stat-value {
  font-weight: 600;
  color: var(--color-primary);
  font-size: 1.1rem;
}

/* Модули */
.modules-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.modules-card {
  background: white;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
}

.modules-card h3 {
  color: var(--color-primary);
  margin-bottom: 20px;
  font-size: 1.3rem;
}

.modules-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.module-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
}

.module-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.module-id {
  font-weight: 600;
  color: var(--color-primary);
  font-family: monospace;
}

.module-address {
  font-family: monospace;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
}

.status-badge {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 600;
}

.status-badge.active {
  background: #d4edda;
  color: #155724;
}

.no-modules {
  text-align: center;
  padding: 20px;
  color: var(--color-grey-dark);
}

/* Мульти-чейн */
.multichain-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.multichain-card {
  background: white;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
}

.multichain-card h3 {
  color: var(--color-primary);
  margin-bottom: 20px;
  font-size: 1.3rem;
}

.chains-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chain-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
}

.chain-name {
  font-weight: 600;
  color: var(--color-primary);
}

.chain-id {
  font-family: monospace;
  color: var(--color-grey-dark);
  font-size: 0.9rem;
}

/* Держатели */
.holders-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.holders-card {
  background: white;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
}

.holders-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.holder-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
}

.holder-rank {
  font-weight: 700;
  color: var(--color-primary);
  min-width: 30px;
}

.holder-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.holder-address {
  font-family: monospace;
  font-weight: 600;
  color: var(--color-grey-dark);
}

.holder-balance {
  font-size: 0.9rem;
  color: var(--color-grey-dark);
}

.holder-percentage {
  font-weight: 600;
  color: var(--color-secondary);
  min-width: 60px;
  text-align: right;
}

.no-holders {
  text-align: center;
  padding: 20px;
  color: var(--color-grey-dark);
}

/* Адаптивность */
@media (max-width: 768px) {
  .info-grid,
  .tokenomics-grid,
  .governance-grid {
    grid-template-columns: 1fr;
  }
  
  .proposals-stats {
    grid-template-columns: 1fr;
  }
  
  .holder-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .holder-percentage {
    align-self: flex-end;
  }
}
</style> 