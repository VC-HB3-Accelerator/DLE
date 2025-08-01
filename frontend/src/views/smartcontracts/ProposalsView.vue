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
    <div class="proposals-container">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Предложения</h1>
          <p>Создание, подписание и выполнение предложений</p>
        </div>
        <button class="close-btn" @click="router.push('/management')">×</button>
      </div>

      <!-- Создание нового предложения -->
      <div class="create-proposal-section">
        <h2>Создать новое предложение</h2>
        <form @submit.prevent="createProposal" class="proposal-form">
          <div class="form-row">
            <div class="form-group">
              <label for="operationType">Тип операции:</label>
              <select id="operationType" v-model="newProposal.operationType" required>
                <option value="">Выберите тип операции</option>
                <option value="token_transfer">Перевод токенов</option>
                <option value="treasury_operation">Казначейская операция</option>
                <option value="module_install">Установка модуля</option>
                <option value="parameter_change">Изменение параметров</option>
                <option value="emergency_action">Экстренные действия</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="timelockDelay">Задержка таймлока (часы):</label>
              <input 
                id="timelockDelay"
                type="number" 
                v-model="newProposal.timelockDelay" 
                min="1" 
                max="168" 
                required
              >
            </div>
          </div>
          
          <div class="form-group">
            <label for="description">Описание операции:</label>
            <textarea 
              id="description"
              v-model="newProposal.description" 
              placeholder="Опишите детали операции..."
              required
            ></textarea>
          </div>
          
          <div class="form-group">
            <label>Целевые сети:</label>
            <div class="networks-grid">
              <label v-for="network in availableNetworks" :key="network.id" class="network-checkbox">
                <input 
                  type="checkbox" 
                  :value="network.id" 
                  v-model="newProposal.targetChains"
                >
                {{ network.name }}
              </label>
            </div>
          </div>
          
          <button type="submit" class="btn-primary" :disabled="isCreatingProposal">
            {{ isCreatingProposal ? 'Создание...' : 'Создать предложение' }}
          </button>
        </form>
      </div>

      <!-- Активные предложения -->
      <div class="proposals-section">
        <h2>Активные предложения</h2>
        <div v-if="proposals.length === 0" class="empty-state">
          <p>Нет активных предложений</p>
        </div>
        <div v-else class="proposals-list">
          <div 
            v-for="proposal in proposals" 
            :key="proposal.id" 
            class="proposal-card"
            :class="{ 'proposal-executed': proposal.executed }"
          >
            <div class="proposal-header">
              <h3>Предложение #{{ proposal.id }}</h3>
              <span class="proposal-status" :class="getStatusClass(proposal)">
                {{ getStatusText(proposal) }}
              </span>
            </div>
            
            <div class="proposal-details">
              <p><strong>Описание:</strong> {{ proposal.description }}</p>
              <p><strong>Инициатор:</strong> {{ formatAddress(proposal.initiator) }}</p>
              <p><strong>Таймлок:</strong> {{ formatTimestamp(proposal.timelock) }}</p>
              <p><strong>Подписи:</strong> {{ proposal.signaturesCount }} / {{ proposal.quorumRequired }}</p>
            </div>
            
            <div class="proposal-actions">
              <button 
                v-if="!proposal.hasSigned && !proposal.executed"
                @click="signProposal(proposal.id)"
                class="btn-secondary"
                :disabled="isSigning"
              >
                Подписать
              </button>
              <button 
                v-if="canExecuteProposal(proposal)"
                @click="executeProposal(proposal.id)"
                class="btn-success"
                :disabled="isExecuting"
              >
                Выполнить
              </button>
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
const isCreatingProposal = ref(false);
const isSigning = ref(false);
const isExecuting = ref(false);

const newProposal = ref({
  operationType: '',
  description: '',
  targetChains: [],
  timelockDelay: 24
});

// Доступные сети
const availableNetworks = ref([
  { id: 1, name: 'Ethereum Mainnet' },
  { id: 137, name: 'Polygon' },
  { id: 56, name: 'BSC' },
  { id: 42161, name: 'Arbitrum' }
]);

// Предложения (временные данные)
const proposals = ref([
  {
    id: 1,
    description: 'Перевод 100 токенов партнеру',
    initiator: '0x1234567890123456789012345678901234567890',
    timelock: Math.floor(Date.now() / 1000) + 3600,
    signaturesCount: 5000,
    quorumRequired: 5100,
    executed: false,
    hasSigned: false
  }
]);

// Методы
const createProposal = async () => {
  if (isCreatingProposal.value) return;
  
  try {
    isCreatingProposal.value = true;
    
    // Здесь будет создание предложения в смарт-контракте
    // console.log('Создание предложения:', newProposal.value);
    
    // Временная логика
    const proposal = {
      id: proposals.value.length + 1,
      description: newProposal.value.description,
      initiator: '0x' + Math.random().toString(16).substr(2, 40),
      timelock: Math.floor(Date.now() / 1000) + (newProposal.value.timelockDelay * 3600),
      signaturesCount: 0,
      quorumRequired: 5100,
      executed: false,
      hasSigned: false
    };
    
    proposals.value.push(proposal);
    
    // Сброс формы
    newProposal.value = {
      operationType: '',
      description: '',
      targetChains: [],
      timelockDelay: 24
    };
    
  } catch (error) {
          // console.error('Ошибка создания предложения:', error);
  } finally {
    isCreatingProposal.value = false;
  }
};

const signProposal = async (proposalId) => {
  if (isSigning.value) return;
  
  try {
    isSigning.value = true;
    
    // Здесь будет подписание предложения в смарт-контракте
    // console.log('Подписание предложения:', proposalId);
    
    const proposal = proposals.value.find(p => p.id === proposalId);
    if (proposal) {
      proposal.signaturesCount += 1000;
      proposal.hasSigned = true;
    }
    
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
    
    // Здесь будет выполнение предложения в смарт-контракте
    // console.log('Выполнение предложения:', proposalId);
    
    const proposal = proposals.value.find(p => p.id === proposalId);
    if (proposal) {
      proposal.executed = true;
    }
    
  } catch (error) {
          // console.error('Ошибка выполнения предложения:', error);
  } finally {
    isExecuting.value = false;
  }
};

const canExecuteProposal = (proposal) => {
  return !proposal.executed && 
         proposal.signaturesCount >= proposal.quorumRequired &&
         Date.now() >= proposal.timelock * 1000;
};

const formatAddress = (address) => {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};

const formatTimestamp = (timestamp) => {
  return new Date(timestamp * 1000).toLocaleString('ru-RU');
};

const getStatusClass = (proposal) => {
  if (proposal.executed) return 'status-executed';
  if (proposal.signaturesCount >= proposal.quorumRequired) return 'status-ready';
  return 'status-pending';
};

const getStatusText = (proposal) => {
  if (proposal.executed) return 'Выполнено';
  if (proposal.signaturesCount >= proposal.quorumRequired) return 'Готово к выполнению';
  return 'Ожидает подписей';
};
</script>

<style scoped>
.proposals-container {
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
.create-proposal-section,
.proposals-section {
  margin-bottom: 40px;
}

.create-proposal-section h2,
.proposals-section h2 {
  color: var(--color-primary);
  margin-bottom: 20px;
  font-size: 1.8rem;
}

/* Форма */
.proposal-form {
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
  min-height: 100px;
  resize: vertical;
}

.networks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.network-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px;
  border-radius: var(--radius-sm);
  transition: background 0.2s;
}

.network-checkbox:hover {
  background: #e9ecef;
}

.network-checkbox input[type="checkbox"] {
  width: auto;
}

/* Предложения */
.proposals-list {
  display: grid;
  gap: 20px;
}

.proposal-card {
  background: white;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.proposal-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.proposal-card.proposal-executed {
  opacity: 0.7;
  background: #f8f9fa;
}

.proposal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.proposal-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.3rem;
}

.proposal-status {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
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

.proposal-details {
  margin-bottom: 20px;
}

.proposal-details p {
  margin: 8px 0;
  font-size: 0.95rem;
}

.proposal-actions {
  display: flex;
  gap: 12px;
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

.btn-secondary:hover:not(:disabled) {
  background: var(--color-secondary-dark);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-success {
  background: #28a745;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-success:hover:not(:disabled) {
  background: #218838;
}

.btn-success:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  
  .proposal-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .proposal-actions {
    flex-direction: column;
  }
  
  .networks-grid {
    grid-template-columns: 1fr;
  }
}
</style> 