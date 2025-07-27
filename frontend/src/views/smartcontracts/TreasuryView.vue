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
    <div class="treasury-container">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Казна</h1>
          <p>Управление средствами и активами DLE</p>
        </div>
        <button class="close-btn" @click="router.push('/management')">×</button>
      </div>

      <!-- Обзор казны -->
      <div class="treasury-overview">
        <h2>Обзор казны</h2>
        <div class="overview-grid">
          <div class="overview-card">
            <h3>Общий баланс</h3>
            <p class="balance-amount">${{ totalBalance.toLocaleString() }}</p>
            <p class="balance-change positive">+${{ dailyChange.toLocaleString() }} (24ч)</p>
          </div>
          <div class="overview-card">
            <h3>Активы</h3>
            <p class="balance-amount">{{ assetsCount }}</p>
            <p class="balance-description">различных активов</p>
          </div>
          <div class="overview-card">
            <h3>Доходность</h3>
            <p class="balance-amount">{{ yieldPercentage }}%</p>
            <p class="balance-description">годовая доходность</p>
          </div>
          <div class="overview-card">
            <h3>Риск</h3>
            <p class="balance-amount risk-low">Низкий</p>
            <p class="balance-description">уровень риска</p>
          </div>
        </div>
      </div>

      <!-- Активы -->
      <div class="assets-section">
        <h2>Активы</h2>
        <div class="assets-list">
          <div 
            v-for="asset in assets" 
            :key="asset.id" 
            class="asset-card"
          >
            <div class="asset-info">
              <div class="asset-header">
                <h3>{{ asset.name }}</h3>
                <span class="asset-symbol">{{ asset.symbol }}</span>
              </div>
              <div class="asset-balance">
                <p class="asset-amount">{{ asset.balance }} {{ asset.symbol }}</p>
                <p class="asset-value">${{ asset.value.toLocaleString() }}</p>
              </div>
              <div class="asset-change" :class="asset.change >= 0 ? 'positive' : 'negative'">
                {{ asset.change >= 0 ? '+' : '' }}{{ asset.change }}% (24ч)
              </div>
            </div>
            <div class="asset-actions">
              <button @click="depositAsset(asset)" class="btn-secondary">
                Пополнить
              </button>
              <button @click="withdrawAsset(asset)" class="btn-secondary">
                Вывести
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Операции -->
      <div class="operations-section">
        <h2>Операции</h2>
        <div class="operations-tabs">
          <button 
            v-for="tab in operationTabs" 
            :key="tab.id"
            @click="activeTab = tab.id"
            class="tab-button"
            :class="{ active: activeTab === tab.id }"
          >
            {{ tab.name }}
          </button>
        </div>
        
        <!-- Форма депозита -->
        <div v-if="activeTab === 'deposit'" class="operation-form">
          <form @submit.prevent="performDeposit" class="deposit-form">
            <div class="form-row">
              <div class="form-group">
                <label for="depositAsset">Актив:</label>
                <select id="depositAsset" v-model="depositData.asset" required>
                  <option value="">Выберите актив</option>
                  <option v-for="asset in assets" :key="asset.id" :value="asset.id">
                    {{ asset.name }} ({{ asset.symbol }})
                  </option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="depositAmount">Количество:</label>
                <input 
                  id="depositAmount"
                  v-model="depositData.amount" 
                  type="number" 
                  min="0.000001"
                  step="0.000001"
                  placeholder="0.00"
                  required
                >
              </div>
            </div>
            
            <div class="form-group">
              <label for="depositReason">Причина депозита:</label>
              <textarea 
                id="depositReason"
                v-model="depositData.reason" 
                placeholder="Опишите причину депозита..."
                rows="3"
              ></textarea>
            </div>
            
            <button type="submit" class="btn-primary" :disabled="isProcessing">
              {{ isProcessing ? 'Обработка...' : 'Пополнить казну' }}
            </button>
          </form>
        </div>
        
        <!-- Форма вывода -->
        <div v-if="activeTab === 'withdraw'" class="operation-form">
          <form @submit.prevent="performWithdraw" class="withdraw-form">
            <div class="form-row">
              <div class="form-group">
                <label for="withdrawAsset">Актив:</label>
                <select id="withdrawAsset" v-model="withdrawData.asset" required>
                  <option value="">Выберите актив</option>
                  <option v-for="asset in assets" :key="asset.id" :value="asset.id">
                    {{ asset.name }} ({{ asset.symbol }})
                  </option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="withdrawAmount">Количество:</label>
                <input 
                  id="withdrawAmount"
                  v-model="withdrawData.amount" 
                  type="number" 
                  min="0.000001"
                  step="0.000001"
                  placeholder="0.00"
                  required
                >
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="withdrawRecipient">Получатель:</label>
                <input 
                  id="withdrawRecipient"
                  v-model="withdrawData.recipient" 
                  type="text" 
                  placeholder="0x..."
                  required
                >
              </div>
              
              <div class="form-group">
                <label for="withdrawReason">Причина вывода:</label>
                <input 
                  id="withdrawReason"
                  v-model="withdrawData.reason" 
                  type="text" 
                  placeholder="Опишите причину вывода..."
                  required
                >
              </div>
            </div>
            
            <button type="submit" class="btn-primary" :disabled="isProcessing">
              {{ isProcessing ? 'Обработка...' : 'Вывести из казны' }}
            </button>
          </form>
        </div>
      </div>

      <!-- История операций -->
      <div class="history-section">
        <h2>История операций</h2>
        <div v-if="operationsHistory.length === 0" class="empty-state">
          <p>Нет операций в истории</p>
        </div>
        <div v-else class="history-list">
          <div 
            v-for="operation in operationsHistory" 
            :key="operation.id" 
            class="history-item"
          >
            <div class="operation-info">
              <div class="operation-header">
                <h3>{{ operation.type === 'deposit' ? 'Депозит' : 'Вывод' }}</h3>
                <span class="operation-date">{{ formatDate(operation.timestamp) }}</span>
              </div>
              <div class="operation-details">
                <p><strong>Актив:</strong> {{ operation.asset }}</p>
                <p><strong>Количество:</strong> {{ operation.amount }} {{ operation.symbol }}</p>
                <p><strong>Стоимость:</strong> ${{ operation.value.toLocaleString() }}</p>
                <p v-if="operation.reason"><strong>Причина:</strong> {{ operation.reason }}</p>
                <p v-if="operation.recipient"><strong>Получатель:</strong> {{ formatAddress(operation.recipient) }}</p>
              </div>
            </div>
            <div class="operation-status" :class="operation.status">
              {{ getStatusText(operation.status) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';

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

// Состояние
const isProcessing = ref(false);
const activeTab = ref('deposit');

// Данные казны
const totalBalance = ref(1250000);
const dailyChange = ref(25000);
const assetsCount = ref(5);
const yieldPercentage = ref(8.5);

// Активы (временные данные)
const assets = ref([
  {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    balance: 125.5,
    value: 450000,
    change: 2.5
  },
  {
    id: 'usdc',
    name: 'USD Coin',
    symbol: 'USDC',
    balance: 500000,
    value: 500000,
    change: 0.1
  },
  {
    id: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    balance: 2.5,
    value: 150000,
    change: -1.2
  },
  {
    id: 'matic',
    name: 'Polygon',
    symbol: 'MATIC',
    balance: 50000,
    value: 75000,
    change: 5.8
  },
  {
    id: 'link',
    name: 'Chainlink',
    symbol: 'LINK',
    balance: 2500,
    value: 75000,
    change: 3.2
  }
]);

// Вкладки операций
const operationTabs = ref([
  { id: 'deposit', name: 'Депозит' },
  { id: 'withdraw', name: 'Вывод' }
]);

// Данные депозита
const depositData = ref({
  asset: '',
  amount: '',
  reason: ''
});

// Данные вывода
const withdrawData = ref({
  asset: '',
  amount: '',
  recipient: '',
  reason: ''
});

// История операций (временные данные)
const operationsHistory = ref([
  {
    id: 1,
    type: 'deposit',
    asset: 'Ethereum',
    symbol: 'ETH',
    amount: 10.5,
    value: 37500,
    reason: 'Пополнение казны от доходов',
    timestamp: Date.now() - 3600000,
    status: 'completed'
  },
  {
    id: 2,
    type: 'withdraw',
    asset: 'USD Coin',
    symbol: 'USDC',
    amount: 25000,
    value: 25000,
    reason: 'Выплата партнерам',
    recipient: '0x1234567890123456789012345678901234567890',
    timestamp: Date.now() - 7200000,
    status: 'completed'
  }
]);

// Методы
const depositAsset = (asset) => {
  depositData.value.asset = asset.id;
  activeTab.value = 'deposit';
};

const withdrawAsset = (asset) => {
  withdrawData.value.asset = asset.id;
  activeTab.value = 'withdraw';
};

const performDeposit = async () => {
  if (isProcessing.value) return;
  
  try {
    isProcessing.value = true;
    
    // Здесь будет логика депозита
    console.log('Депозит:', depositData.value);
    
    // Временная логика
    const asset = assets.value.find(a => a.id === depositData.value.asset);
    if (asset) {
      const amount = parseFloat(depositData.value.amount);
      asset.balance += amount;
      asset.value = asset.balance * (asset.value / (asset.balance - amount));
      totalBalance.value += amount * (asset.value / asset.balance);
    }
    
    // Добавляем в историю
    operationsHistory.value.unshift({
      id: operationsHistory.value.length + 1,
      type: 'deposit',
      asset: asset.name,
      symbol: asset.symbol,
      amount: parseFloat(depositData.value.amount),
      value: parseFloat(depositData.value.amount) * (asset.value / asset.balance),
      reason: depositData.value.reason,
      timestamp: Date.now(),
      status: 'completed'
    });
    
    // Сброс формы
    depositData.value = {
      asset: '',
      amount: '',
      reason: ''
    };
    
    alert('Депозит успешно выполнен!');
    
  } catch (error) {
    console.error('Ошибка депозита:', error);
    alert('Ошибка при выполнении депозита');
  } finally {
    isProcessing.value = false;
  }
};

const performWithdraw = async () => {
  if (isProcessing.value) return;
  
  try {
    isProcessing.value = true;
    
    // Здесь будет логика вывода
    console.log('Вывод:', withdrawData.value);
    
    // Временная логика
    const asset = assets.value.find(a => a.id === withdrawData.value.asset);
    if (asset) {
      const amount = parseFloat(withdrawData.value.amount);
      if (amount > asset.balance) {
        alert('Недостаточно средств для вывода');
        return;
      }
      
      asset.balance -= amount;
      asset.value = asset.balance * (asset.value / (asset.balance + amount));
      totalBalance.value -= amount * (asset.value / asset.balance);
    }
    
    // Добавляем в историю
    operationsHistory.value.unshift({
      id: operationsHistory.value.length + 1,
      type: 'withdraw',
      asset: asset.name,
      symbol: asset.symbol,
      amount: parseFloat(withdrawData.value.amount),
      value: parseFloat(withdrawData.value.amount) * (asset.value / asset.balance),
      reason: withdrawData.value.reason,
      recipient: withdrawData.value.recipient,
      timestamp: Date.now(),
      status: 'completed'
    });
    
    // Сброс формы
    withdrawData.value = {
      asset: '',
      amount: '',
      recipient: '',
      reason: ''
    };
    
    alert('Вывод успешно выполнен!');
    
  } catch (error) {
    console.error('Ошибка вывода:', error);
    alert('Ошибка при выполнении вывода');
  } finally {
    isProcessing.value = false;
  }
};

const getStatusText = (status) => {
  const statusMap = {
    'completed': 'Завершено',
    'pending': 'В обработке',
    'failed': 'Ошибка'
  };
  return statusMap[status] || status;
};

const formatAddress = (address) => {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleString('ru-RU');
};
</script>

<style scoped>
.treasury-container {
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
.treasury-overview,
.assets-section,
.operations-section,
.history-section {
  margin-bottom: 40px;
}

.treasury-overview h2,
.assets-section h2,
.operations-section h2,
.history-section h2 {
  color: var(--color-primary);
  margin-bottom: 20px;
  font-size: 1.8rem;
}

/* Обзор казны */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.overview-card {
  background: #f8f9fa;
  padding: 25px;
  border-radius: var(--radius-lg);
  border-left: 4px solid var(--color-primary);
  text-align: center;
}

.overview-card h3 {
  color: var(--color-primary);
  margin-bottom: 15px;
  font-size: 1rem;
  text-transform: uppercase;
  font-weight: 600;
}

.balance-amount {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 10px 0;
  color: var(--color-primary);
}

.balance-change {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.balance-change.positive {
  color: #28a745;
}

.balance-change.negative {
  color: #dc3545;
}

.balance-description {
  font-size: 0.9rem;
  color: var(--color-grey-dark);
  margin: 0;
}

.risk-low {
  color: #28a745;
}

/* Активы */
.assets-list {
  display: grid;
  gap: 20px;
}

.asset-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 25px;
  background: white;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.asset-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.asset-info {
  flex-grow: 1;
}

.asset-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 10px;
}

.asset-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.2rem;
}

.asset-symbol {
  background: var(--color-primary);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.asset-balance {
  margin-bottom: 10px;
}

.asset-amount {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 5px 0;
  color: var(--color-primary);
}

.asset-value {
  font-size: 0.9rem;
  color: var(--color-grey-dark);
  margin: 0;
}

.asset-change {
  font-size: 0.9rem;
  font-weight: 600;
}

.asset-change.positive {
  color: #28a745;
}

.asset-change.negative {
  color: #dc3545;
}

.asset-actions {
  display: flex;
  gap: 10px;
}

/* Операции */
.operations-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.tab-button {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  padding: 12px 24px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.tab-button:hover {
  background: #e9ecef;
}

.tab-button.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.operation-form {
  background: #f8f9fa;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.form-group label {
  font-weight: 600;
  color: var(--color-grey-dark);
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: var(--radius-sm);
  font-size: 1rem;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

/* История операций */
.history-list {
  display: grid;
  gap: 20px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 25px;
  background: white;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.history-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.operation-info {
  flex-grow: 1;
}

.operation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.operation-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.2rem;
}

.operation-date {
  font-size: 0.9rem;
  color: var(--color-grey-dark);
}

.operation-details p {
  margin: 5px 0;
  font-size: 0.95rem;
}

.operation-status {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  margin-left: 20px;
}

.operation-status.completed {
  background: #d4edda;
  color: #155724;
}

.operation-status.pending {
  background: #fff3cd;
  color: #856404;
}

.operation-status.failed {
  background: #f8d7da;
  color: #721c24;
}

/* Кнопки */
.btn-primary {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-secondary);
  color: white;
  border: none;
  padding: 10px 20px;
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
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .asset-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }
  
  .asset-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .history-item {
    flex-direction: column;
    gap: 15px;
  }
  
  .operation-status {
    margin-left: 0;
    align-self: flex-start;
  }
  
  .overview-grid {
    grid-template-columns: 1fr;
  }
  
  .operations-tabs {
    flex-direction: column;
  }
}
</style> 