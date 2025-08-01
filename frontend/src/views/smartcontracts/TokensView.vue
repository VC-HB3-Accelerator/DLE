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
    <div class="tokens-container">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Токены DLE</h1>
          <p>Балансы, трансферы и распределение токенов</p>
        </div>
        <button class="close-btn" @click="router.push('/management')">×</button>
      </div>

      <!-- Информация о токенах -->
      <div class="token-info-section">
        <h2>Информация о токенах</h2>
        <div class="token-info-grid">
          <div class="info-card">
            <h3>Общий запас</h3>
            <p class="token-amount">{{ totalSupply }} {{ tokenSymbol }}</p>
          </div>
          <div class="info-card">
            <h3>Ваш баланс</h3>
            <p class="token-amount">{{ userBalance }} {{ tokenSymbol }}</p>
          </div>
          <div class="info-card">
            <h3>Кворум</h3>
            <p class="token-amount">{{ quorumPercentage }}%</p>
          </div>
          <div class="info-card">
            <h3>Цена токена</h3>
            <p class="token-amount">${{ tokenPrice }}</p>
          </div>
        </div>
      </div>

      <!-- Трансфер токенов -->
      <div class="transfer-section">
        <h2>Перевод токенов</h2>
        <form @submit.prevent="transferTokens" class="transfer-form">
          <div class="form-row">
            <div class="form-group">
              <label for="recipient">Получатель:</label>
              <input 
                id="recipient"
                v-model="transferData.recipient" 
                type="text" 
                placeholder="0x..."
                required
              >
            </div>
            
            <div class="form-group">
              <label for="amount">Количество токенов:</label>
              <input 
                id="amount"
                v-model="transferData.amount" 
                type="number" 
                min="0.01" 
                step="0.01"
                placeholder="0.00"
                required
              >
            </div>
          </div>
          
          <div class="form-group">
            <label for="transferDescription">Описание (опционально):</label>
            <textarea 
              id="transferDescription"
              v-model="transferData.description" 
              placeholder="Укажите причину перевода..."
              rows="3"
            ></textarea>
          </div>
          
          <button type="submit" class="btn-primary" :disabled="isTransferring">
            {{ isTransferring ? 'Перевод...' : 'Перевести токены' }}
          </button>
        </form>
      </div>

      <!-- Распределение токенов -->
      <div class="distribution-section">
        <h2>Распределение токенов</h2>
        <form @submit.prevent="distributeTokens" class="distribution-form">
          <div class="form-group">
            <label for="distributionType">Тип распределения:</label>
            <select id="distributionType" v-model="distributionData.type" required>
              <option value="">Выберите тип</option>
              <option value="partners">Партнерам</option>
              <option value="employees">Сотрудникам</option>
              <option value="investors">Инвесторам</option>
              <option value="custom">Пользовательское</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Получатели:</label>
            <div class="recipients-list">
              <div 
                v-for="(recipient, index) in distributionData.recipients" 
                :key="index"
                class="recipient-item"
              >
                <input 
                  v-model="recipient.address" 
                  type="text" 
                  placeholder="Адрес получателя"
                  required
                >
                <input 
                  v-model="recipient.amount" 
                  type="number" 
                  placeholder="Количество"
                  min="0.01"
                  step="0.01"
                  required
                >
                <button 
                  type="button" 
                  @click="removeRecipient(index)"
                  class="btn-remove"
                >
                  ✕
                </button>
              </div>
            </div>
            <button 
              type="button" 
              @click="addRecipient"
              class="btn-secondary"
            >
              + Добавить получателя
            </button>
          </div>
          
          <button type="submit" class="btn-primary" :disabled="isDistributing">
            {{ isDistributing ? 'Распределение...' : 'Распределить токены' }}
          </button>
        </form>
      </div>

      <!-- Держатели токенов -->
      <div class="holders-section">
        <h2>Держатели токенов</h2>
        <div v-if="tokenHolders.length === 0" class="empty-state">
          <p>Нет данных о держателях токенов</p>
        </div>
        <div v-else class="holders-list">
          <div 
            v-for="holder in tokenHolders" 
            :key="holder.address" 
            class="holder-item"
          >
            <div class="holder-info">
              <span class="holder-address">{{ formatAddress(holder.address) }}</span>
              <span class="holder-balance">{{ holder.balance }} {{ tokenSymbol }}</span>
            </div>
            <div class="holder-percentage">
              {{ ((holder.balance / totalSupply) * 100).toFixed(2) }}%
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
const isTransferring = ref(false);
const isDistributing = ref(false);

// Данные токенов
const tokenSymbol = ref('MDLE');
const totalSupply = ref(10000);
const userBalance = ref(1000);
const quorumPercentage = ref(51);
const tokenPrice = ref(1.25);

// Данные трансфера
const transferData = ref({
  recipient: '',
  amount: '',
  description: ''
});

// Данные распределения
const distributionData = ref({
  type: '',
  recipients: [
    { address: '', amount: '' }
  ]
});

// Держатели токенов (временные данные)
const tokenHolders = ref([
  { address: '0x1234567890123456789012345678901234567890', balance: 2500 },
  { address: '0x2345678901234567890123456789012345678901', balance: 1800 },
  { address: '0x3456789012345678901234567890123456789012', balance: 1200 },
  { address: '0x4567890123456789012345678901234567890123', balance: 800 },
  { address: '0x5678901234567890123456789012345678901234', balance: 600 }
]);

// Методы
const transferTokens = async () => {
  if (isTransferring.value) return;
  
  try {
    isTransferring.value = true;
    
    // Здесь будет логика трансфера токенов
    // console.log('Трансфер токенов:', transferData.value);
    
    // Временная логика
    const amount = parseFloat(transferData.value.amount);
    if (amount > userBalance.value) {
      alert('Недостаточно токенов для перевода');
      return;
    }
    
    userBalance.value -= amount;
    
    // Сброс формы
    transferData.value = {
      recipient: '',
      amount: '',
      description: ''
    };
    
    alert('Токены успешно переведены!');
    
  } catch (error) {
          // console.error('Ошибка трансфера токенов:', error);
    alert('Ошибка при переводе токенов');
  } finally {
    isTransferring.value = false;
  }
};

const distributeTokens = async () => {
  if (isDistributing.value) return;
  
  try {
    isDistributing.value = true;
    
    // Здесь будет логика распределения токенов
    // console.log('Распределение токенов:', distributionData.value);
    
    // Временная логика
    const totalAmount = distributionData.value.recipients.reduce((sum, recipient) => {
      return sum + parseFloat(recipient.amount || 0);
    }, 0);
    
    if (totalAmount > userBalance.value) {
      alert('Недостаточно токенов для распределения');
      return;
    }
    
    userBalance.value -= totalAmount;
    
    // Сброс формы
    distributionData.value = {
      type: '',
      recipients: [{ address: '', amount: '' }]
    };
    
    alert('Токены успешно распределены!');
    
  } catch (error) {
          // console.error('Ошибка распределения токенов:', error);
    alert('Ошибка при распределении токенов');
  } finally {
    isDistributing.value = false;
  }
};

const addRecipient = () => {
  distributionData.value.recipients.push({ address: '', amount: '' });
};

const removeRecipient = (index) => {
  if (distributionData.value.recipients.length > 1) {
    distributionData.value.recipients.splice(index, 1);
  }
};

const formatAddress = (address) => {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};
</script>

<style scoped>
.tokens-container {
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
.token-info-section,
.transfer-section,
.distribution-section,
.holders-section {
  margin-bottom: 40px;
}

.token-info-section h2,
.transfer-section h2,
.distribution-section h2,
.holders-section h2 {
  color: var(--color-primary);
  margin-bottom: 20px;
  font-size: 1.8rem;
}

/* Информация о токенах */
.token-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.info-card {
  background: #f8f9fa;
  padding: 25px;
  border-radius: var(--radius-lg);
  border-left: 4px solid var(--color-primary);
  text-align: center;
}

.info-card h3 {
  color: var(--color-primary);
  margin-bottom: 15px;
  font-size: 1rem;
  text-transform: uppercase;
  font-weight: 600;
}

.token-amount {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0;
  color: var(--color-primary);
}

/* Формы */
.transfer-form,
.distribution-form {
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

/* Получатели */
.recipients-list {
  display: grid;
  gap: 15px;
  margin-bottom: 15px;
}

.recipient-item {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 15px;
  align-items: center;
}

.btn-remove {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-remove:hover {
  background: #c82333;
}

/* Держатели токенов */
.holders-list {
  display: grid;
  gap: 15px;
}

.holder-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: white;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.holder-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.holder-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.holder-address {
  font-family: monospace;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
}

.holder-balance {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-primary);
}

.holder-percentage {
  font-size: 0.9rem;
  color: var(--color-grey-dark);
  font-weight: 600;
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
  
  .recipient-item {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  
  .holder-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .token-info-grid {
    grid-template-columns: 1fr;
  }
}
</style> 