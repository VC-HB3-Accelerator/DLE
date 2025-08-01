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
  <div class="embedded-dle-interface">
    <!-- Заголовок встраиваемого интерфейса -->
    <div class="embedded-header">
      <div class="embedded-title">
        <h3>{{ dleInfo.name }}</h3>
        <span class="embedded-subtitle">Встраиваемый интерфейс управления</span>
      </div>
      <div class="embedded-status">
        <span class="status-indicator" :class="connectionStatus">
          {{ getStatusText() }}
        </span>
      </div>
    </div>

    <!-- Информация о DLE -->
    <div class="embedded-info">
      <div class="info-grid">
        <div class="info-item">
          <label>Адрес DLE:</label>
          <span class="address">{{ formatAddress(dleAddress) }}</span>
        </div>
        <div class="info-item">
          <label>Ваш баланс токенов:</label>
          <span class="balance">{{ userTokenBalance }} {{ dleInfo.symbol }}</span>
        </div>
        <div class="info-item">
          <label>Общий запас:</label>
          <span>{{ totalSupply }} {{ dleInfo.symbol }}</span>
        </div>
        <div class="info-item">
          <label>Кворум:</label>
          <span>{{ quorumPercentage }}%</span>
        </div>
      </div>
    </div>

    <!-- Быстрые действия -->
    <div class="quick-actions">
      <h4>Быстрые действия</h4>
      <div class="actions-grid">
        <button 
          @click="createProposal"
          class="action-btn action-primary"
          :disabled="!canCreateProposal"
        >
          <i class="icon">📝</i>
          <span>Создать предложение</span>
        </button>
        
        <button 
          @click="viewProposals"
          class="action-btn action-secondary"
        >
          <i class="icon">📋</i>
          <span>Просмотр предложений</span>
        </button>
        
        <button 
          @click="viewTokenHolders"
          class="action-btn action-secondary"
        >
          <i class="icon">👥</i>
          <span>Держатели токенов</span>
        </button>
        
        <button 
          @click="viewTreasury"
          class="action-btn action-secondary"
        >
          <i class="icon">💰</i>
          <span>Казначейство</span>
        </button>
      </div>
    </div>

    <!-- Активные предложения -->
    <div class="active-proposals">
      <h4>Активные предложения</h4>
      <div v-if="proposals.length === 0" class="empty-state">
        <p>Нет активных предложений</p>
      </div>
      <div v-else class="proposals-list">
        <div 
          v-for="proposal in proposals.slice(0, 3)" 
          :key="proposal.id" 
          class="proposal-item"
          :class="{ 'proposal-signed': proposal.hasSigned }"
        >
          <div class="proposal-content">
            <div class="proposal-title">
              <span class="proposal-id">#{{ proposal.id }}</span>
              <span class="proposal-status" :class="getProposalStatusClass(proposal)">
                {{ getProposalStatusText(proposal) }}
              </span>
            </div>
            <p class="proposal-description">{{ proposal.description }}</p>
            <div class="proposal-meta">
              <span>Подписи: {{ proposal.signaturesCount }}/{{ proposal.quorumRequired }}</span>
              <span>До: {{ formatTimeLeft(proposal.timelock) }}</span>
            </div>
          </div>
          <div class="proposal-actions">
            <button 
              v-if="!proposal.hasSigned && !proposal.executed"
              @click="signProposal(proposal.id)"
              class="btn-sign"
              :disabled="isSigning"
            >
              Подписать
            </button>
            <button 
              v-if="canExecuteProposal(proposal)"
              @click="executeProposal(proposal.id)"
              class="btn-execute"
              :disabled="isExecuting"
            >
              Выполнить
            </button>
          </div>
        </div>
      </div>
      <div v-if="proposals.length > 3" class="view-more">
        <button @click="viewAllProposals" class="btn-view-more">
          Показать все предложения ({{ proposals.length }})
        </button>
      </div>
    </div>

    <!-- Статистика -->
    <div class="embedded-stats">
      <h4>Статистика DLE</h4>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">{{ proposals.length }}</div>
          <div class="stat-label">Всего предложений</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ executedProposals }}</div>
          <div class="stat-label">Выполнено</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ tokenHolders.length }}</div>
          <div class="stat-label">Держателей токенов</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ installedModules.length }}</div>
          <div class="stat-label">Установленных модулей</div>
        </div>
      </div>
    </div>

    <!-- Уведомления -->
    <div v-if="notifications.length > 0" class="notifications">
      <h4>Уведомления</h4>
      <div class="notifications-list">
        <div 
          v-for="notification in notifications" 
          :key="notification.id"
          class="notification-item"
          :class="notification.type"
        >
          <div class="notification-content">
            <span class="notification-title">{{ notification.title }}</span>
            <p class="notification-message">{{ notification.message }}</p>
            <span class="notification-time">{{ formatTime(notification.timestamp) }}</span>
          </div>
          <button @click="dismissNotification(notification.id)" class="btn-dismiss">
            ✕
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, defineProps, defineEmits } from 'vue';

// Props
const props = defineProps({
  dleAddress: {
    type: String,
    required: true
  },
  dleInfo: {
    type: Object,
    default: () => ({
      name: 'Неизвестное DLE',
      symbol: 'TOKEN',
      location: 'Не указано'
    })
  }
});

// Emits
const emit = defineEmits([
  'proposal-created',
  'proposal-signed', 
  'proposal-executed',
  'interface-action'
]);

// Состояние
const connectionStatus = ref('connecting');
const userTokenBalance = ref(0);
const totalSupply = ref(0);
const quorumPercentage = ref(51);
const proposals = ref([]);
const tokenHolders = ref([]);
const installedModules = ref([]);
const notifications = ref([]);

// Состояние загрузки
const isSigning = ref(false);
const isExecuting = ref(false);

// Вычисляемые свойства
const executedProposals = computed(() => {
  return proposals.value.filter(p => p.executed).length;
});

const canCreateProposal = computed(() => {
  return userTokenBalance.value > 0 && connectionStatus.value === 'connected';
});

// Методы
const connectToDLE = async () => {
  try {
    connectionStatus.value = 'connecting';
    
    // Здесь будет подключение к DLE через Web3
    // console.log('Подключение к DLE:', props.dleAddress);
    
    // Имитация подключения
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Загрузка данных
    await loadDLEData();
    
    connectionStatus.value = 'connected';
  } catch (error) {
            // console.error('Ошибка подключения к DLE:', error);
    connectionStatus.value = 'error';
  }
};

const loadDLEData = async () => {
  try {
    // Загрузка баланса токенов пользователя
    userTokenBalance.value = 500; // Временные данные
    
    // Загрузка общего запаса
    totalSupply.value = 10000;
    
    // Загрузка предложений
    proposals.value = [
      {
        id: 1,
        description: 'Перевод 100 токенов партнеру',
        timelock: Math.floor(Date.now() / 1000) + 3600,
        signaturesCount: 3000,
        quorumRequired: 5100,
        executed: false,
        hasSigned: false
      },
      {
        id: 2,
        description: 'Установка нового модуля казначейства',
        timelock: Math.floor(Date.now() / 1000) + 7200,
        signaturesCount: 5100,
        quorumRequired: 5100,
        executed: false,
        hasSigned: true
      }
    ];
    
    // Загрузка держателей токенов
    tokenHolders.value = [
      { address: '0x1234...5678', balance: 2000 },
      { address: '0x8765...4321', balance: 1500 },
      { address: '0xabcd...efgh', balance: 1000 }
    ];
    
    // Загрузка модулей
    installedModules.value = [
      { name: 'Казначейство', address: '0x1111...2222' },
      { name: 'Коммуникации', address: '0x3333...4444' }
    ];
    
    // Загрузка уведомлений
    notifications.value = [
      {
        id: 1,
        type: 'info',
        title: 'Новое предложение',
        message: 'Создано предложение #3 для установки модуля',
        timestamp: Date.now() - 3600000
      }
    ];
    
  } catch (error) {
            // console.error('Ошибка загрузки данных DLE:', error);
  }
};

const createProposal = () => {
  emit('interface-action', {
    action: 'create-proposal',
    dleAddress: props.dleAddress
  });
};

const viewProposals = () => {
  emit('interface-action', {
    action: 'view-proposals',
    dleAddress: props.dleAddress
  });
};

const viewTokenHolders = () => {
  emit('interface-action', {
    action: 'view-token-holders',
    dleAddress: props.dleAddress
  });
};

const viewTreasury = () => {
  emit('interface-action', {
    action: 'view-treasury',
    dleAddress: props.dleAddress
  });
};

const signProposal = async (proposalId) => {
  if (isSigning.value) return;
  
  try {
    isSigning.value = true;
    
    // Здесь будет подписание предложения
    // console.log('Подписание предложения:', proposalId);
    
    const proposal = proposals.value.find(p => p.id === proposalId);
    if (proposal) {
      proposal.signaturesCount += userTokenBalance.value;
      proposal.hasSigned = true;
    }
    
    emit('proposal-signed', { proposalId, dleAddress: props.dleAddress });
    
  } catch (error) {
            // console.error('Ошибка подписания предложения:', error);
  } finally {
    isSigning.value = false;
  }
};

const executeProposal = async (proposalId) => {
  if (isExecuting.value) return;
  
  try {
    isExecuting.value = true;
    
    // Здесь будет выполнение предложения
    // console.log('Выполнение предложения:', proposalId);
    
    const proposal = proposals.value.find(p => p.id === proposalId);
    if (proposal) {
      proposal.executed = true;
    }
    
    emit('proposal-executed', { proposalId, dleAddress: props.dleAddress });
    
  } catch (error) {
            // console.error('Ошибка выполнения предложения:', error);
  } finally {
    isExecuting.value = false;
  }
};

const viewAllProposals = () => {
  emit('interface-action', {
    action: 'view-all-proposals',
    dleAddress: props.dleAddress
  });
};

const dismissNotification = (notificationId) => {
  notifications.value = notifications.value.filter(n => n.id !== notificationId);
};

// Утилиты
const formatAddress = (address) => {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};

const formatTimeLeft = (timestamp) => {
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;
  
  if (diff <= 0) return 'Истекло';
  
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  }
  return `${minutes}м`;
};

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('ru-RU');
};

const getStatusText = () => {
  switch (connectionStatus.value) {
    case 'connecting': return 'Подключение...';
    case 'connected': return 'Подключено';
    case 'error': return 'Ошибка подключения';
    default: return 'Неизвестно';
  }
};

const canExecuteProposal = (proposal) => {
  return !proposal.executed && 
         proposal.signaturesCount >= proposal.quorumRequired &&
         Date.now() >= proposal.timelock * 1000;
};

const getProposalStatusClass = (proposal) => {
  if (proposal.executed) return 'status-executed';
  if (proposal.signaturesCount >= proposal.quorumRequired) return 'status-ready';
  return 'status-pending';
};

const getProposalStatusText = (proposal) => {
  if (proposal.executed) return 'Выполнено';
  if (proposal.signaturesCount >= proposal.quorumRequired) return 'Готово';
  return 'Ожидает';
};

onMounted(() => {
  connectToDLE();
});
</script>

<style scoped>
.embedded-dle-interface {
  background: white;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
  overflow: hidden;
}

/* Заголовок */
.embedded-header {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: white;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.embedded-title h3 {
  margin: 0 0 5px 0;
  font-size: 1.3rem;
}

.embedded-subtitle {
  font-size: 0.9rem;
  opacity: 0.8;
}

.status-indicator {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-indicator.connecting {
  background: #fff3cd;
  color: #856404;
}

.status-indicator.connected {
  background: #d4edda;
  color: #155724;
}

.status-indicator.error {
  background: #f8d7da;
  color: #721c24;
}

/* Информация */
.embedded-info {
  padding: 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.info-item label {
  font-size: 0.8rem;
  color: var(--color-grey-dark);
  font-weight: 600;
}

.info-item span {
  font-size: 1rem;
  font-weight: 600;
}

.address {
  font-family: monospace;
}

.balance {
  color: var(--color-primary);
}

/* Быстрые действия */
.quick-actions {
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.quick-actions h4 {
  margin: 0 0 15px 0;
  color: var(--color-primary);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 15px;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-md);
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  color: inherit;
}

.action-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.action-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.icon {
  font-size: 1.5rem;
}

.action-btn span {
  font-size: 0.8rem;
  font-weight: 600;
}

/* Предложения */
.active-proposals {
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.active-proposals h4 {
  margin: 0 0 15px 0;
  color: var(--color-primary);
}

.proposals-list {
  display: grid;
  gap: 10px;
}

.proposal-item {
  background: #f8f9fa;
  border-radius: var(--radius-md);
  padding: 15px;
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.proposal-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.proposal-item.proposal-signed {
  border-left: 4px solid var(--color-primary);
}

.proposal-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.proposal-id {
  font-weight: 600;
  color: var(--color-primary);
}

.proposal-status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
}

.status-pending {
  background: #fff3cd;
  color: #856404;
}

.status-ready {
  background: #d1ecf1;
  color: #0c5460;
}

.status-executed {
  background: #d4edda;
  color: #155724;
}

.proposal-description {
  margin: 8px 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.proposal-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--color-grey-dark);
  margin-bottom: 10px;
}

.proposal-actions {
  display: flex;
  gap: 8px;
}

.btn-sign, .btn-execute {
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-sign {
  background: var(--color-secondary);
  color: white;
}

.btn-sign:hover:not(:disabled) {
  background: var(--color-secondary-dark);
}

.btn-execute {
  background: #28a745;
  color: white;
}

.btn-execute:hover:not(:disabled) {
  background: #218838;
}

.btn-sign:disabled, .btn-execute:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.view-more {
  margin-top: 15px;
  text-align: center;
}

.btn-view-more {
  background: none;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.btn-view-more:hover {
  background: var(--color-primary);
  color: white;
}

/* Статистика */
.embedded-stats {
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.embedded-stats h4 {
  margin: 0 0 15px 0;
  color: var(--color-primary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 15px;
}

.stat-item {
  text-align: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: var(--radius-md);
  border: 1px solid #e9ecef;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 5px;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--color-grey-dark);
}

/* Уведомления */
.notifications {
  padding: 20px;
}

.notifications h4 {
  margin: 0 0 15px 0;
  color: var(--color-primary);
}

.notifications-list {
  display: grid;
  gap: 10px;
}

.notification-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.notification-item.info {
  background: #d1ecf1;
  border-color: #bee5eb;
}

.notification-item.warning {
  background: #fff3cd;
  border-color: #ffeaa7;
}

.notification-item.error {
  background: #f8d7da;
  border-color: #f5c6cb;
}

.notification-content {
  flex: 1;
}

.notification-title {
  font-weight: 600;
  font-size: 0.9rem;
  display: block;
  margin-bottom: 4px;
}

.notification-message {
  font-size: 0.8rem;
  margin: 4px 0;
  line-height: 1.4;
}

.notification-time {
  font-size: 0.7rem;
  color: var(--color-grey-dark);
}

.btn-dismiss {
  background: none;
  border: none;
  color: var(--color-grey-dark);
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  margin-left: 10px;
}

.btn-dismiss:hover {
  color: #dc3545;
}

/* Состояния */
.empty-state {
  text-align: center;
  padding: 30px;
  color: var(--color-grey-dark);
}

.empty-state p {
  margin: 0;
  font-size: 0.9rem;
}

/* Адаптивность */
@media (max-width: 768px) {
  .embedded-header {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .proposal-meta {
    flex-direction: column;
    gap: 5px;
  }
  
  .proposal-actions {
    flex-direction: column;
  }
}
</style> 