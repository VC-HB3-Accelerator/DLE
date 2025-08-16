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
          <h1>Управление токенами DLE</h1>
          <p>Создание предложений для перевода токенов через систему голосования</p>
          <div v-if="selectedDle" class="dle-info">
            <span class="dle-name">{{ selectedDle.name }} ({{ selectedDle.symbol }})</span>
            <span class="dle-address">{{ shortenAddress(selectedDle.dleAddress) }}</span>
          </div>
          <div v-else-if="isLoadingDle" class="loading-info">
            <span>Загрузка данных DLE...</span>
          </div>
          <div v-else class="no-dle-info">
            <span>DLE не выбран</span>
          </div>
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
            <p v-if="currentUserAddress" class="user-address">{{ shortenAddress(currentUserAddress) }}</p>
            <p v-else class="no-wallet">Кошелек не подключен</p>
          </div>
          <div class="info-card">
            <h3>Цена токена</h3>
            <p class="token-amount">${{ tokenPrice }}</p>
          </div>
        </div>
      </div>

      <!-- Перевод токенов через governance -->
      <div class="transfer-section">
        <h2>Перевод токенов через Governance</h2>
        <p class="section-description">
          Создайте предложение для перевода токенов через систему голосования. 
          Токены будут переведены от имени DLE после одобрения кворумом.
          <strong>Важно:</strong> Перевод через governance будет выполнен во всех поддерживаемых сетях DLE.
        </p>
        
        <form @submit.prevent="createTransferProposal" class="transfer-form">
          <div class="form-group">
            <label for="proposal-recipient">Адрес получателя:</label>
            <input 
              id="proposal-recipient"
              v-model="proposalData.recipient" 
              type="text" 
              placeholder="0x..." 
              required
            />
          </div>

          <div class="form-group">
            <label for="proposal-amount">Количество токенов:</label>
            <input 
              id="proposal-amount"
              v-model="proposalData.amount" 
              type="number" 
              step="0.000001" 
              placeholder="0.0" 
              required
            />
          </div>

          <div class="form-group">
            <label for="proposal-description">Описание предложения:</label>
            <textarea 
              id="proposal-description"
              v-model="proposalData.description" 
              placeholder="Опишите причину перевода токенов..." 
              required
            ></textarea>
          </div>

          <div class="form-group">
            <label for="proposal-duration">Длительность голосования (часы):</label>
            <input 
              id="proposal-duration"
              v-model="proposalData.duration" 
              type="number" 
              min="1" 
              max="168" 
              placeholder="24" 
              required
            />
          </div>

          <button type="submit" class="btn-primary" :disabled="isCreatingProposal">
            {{ isCreatingProposal ? 'Создание предложения...' : 'Создать предложение' }}
          </button>
          
          <!-- Статус предложения -->
          <div v-if="proposalStatus" class="proposal-status">
            <p class="status-message">{{ proposalStatus }}</p>
          </div>
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
import { ref, computed, onMounted, watch, defineProps, defineEmits } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import { getTokenBalance, getTotalSupply, getTokenHolders } from '../../services/tokensService.js';
import api from '../../api/axios';
import { ethers } from 'ethers';
import { createTransferTokensProposal } from '../../utils/dle-contract.js';

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

// Получаем адрес DLE из URL
const dleAddress = computed(() => {
  const address = route.query.address;
  console.log('DLE Address from URL (Tokens):', address);
  return address;
});

// Состояние DLE
const selectedDle = ref(null);
const isLoadingDle = ref(false);

// Состояние для предложения о переводе токенов через governance
const isCreatingProposal = ref(false);
const proposalStatus = ref('');

// Данные токенов (загружаются из блокчейна)
const totalSupply = ref(0);
const userBalance = ref(0);
const deployerBalance = ref(0);
const quorumPercentage = ref(0);
const tokenPrice = ref(0);

// Данные для формы
const proposalData = ref({
  recipient: '',
  amount: '',
  description: '',
  duration: 86400, // 24 часа по умолчанию
  governanceChainId: 11155111, // Sepolia по умолчанию
  targetChains: [11155111] // Sepolia по умолчанию
});

// Получаем адрес текущего пользователя
const currentUserAddress = computed(() => {
  console.log('Проверяем identities:', props.identities);
  
  // Получаем адрес из props или из window.ethereum
  if (props.identities && props.identities.length > 0) {
    const walletIdentity = props.identities.find(id => id.provider === 'wallet');
    console.log('Найден wallet identity:', walletIdentity);
    if (walletIdentity) {
      return walletIdentity.provider_id;
    }
  }
  
  // Fallback: пытаемся получить из window.ethereum
  if (window.ethereum && window.ethereum.selectedAddress) {
    console.log('Получаем адрес из window.ethereum:', window.ethereum.selectedAddress);
    return window.ethereum.selectedAddress;
  }
  
  console.log('Адрес пользователя не найден');
  return null;
});

// Держатели токенов (загружаются из блокчейна)
const tokenHolders = ref([]);

// Функции
async function loadDleData() {
  if (!dleAddress.value) {
    console.warn('Адрес DLE не указан');
    return;
  }

  isLoadingDle.value = true;
  try {
    // Читаем актуальные данные из блокчейна
    const response = await api.post('/dle-core/read-dle-info', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      const blockchainData = response.data.data;
      selectedDle.value = blockchainData;
      console.log('Загружены данные DLE из блокчейна:', blockchainData);
      
      // Загружаем баланс текущего пользователя
      await loadUserBalance();
      
      // Загружаем держателей токенов (если есть API)
      await loadTokenHolders();
    } else {
      console.warn('Не удалось прочитать данные из блокчейна для', dleAddress.value);
    }
  } catch (error) {
    console.error('Ошибка загрузки данных DLE из блокчейна:', error);
  } finally {
    isLoadingDle.value = false;
  }
}

// Новая функция для загрузки баланса текущего пользователя
async function loadUserBalance() {
  if (!currentUserAddress.value || !dleAddress.value) {
    userBalance.value = 0;
    console.log('Не удается загрузить баланс: нет адреса пользователя или DLE');
    return;
  }

  try {
    console.log('Загружаем баланс для пользователя:', currentUserAddress.value);
    
    const response = await api.post('/blockchain/get-token-balance', {
      dleAddress: dleAddress.value,
      account: currentUserAddress.value
    });
    
    if (response.data.success) {
      userBalance.value = parseFloat(response.data.data.balance);
      console.log('Баланс пользователя загружен:', userBalance.value);
    } else {
      console.warn('Не удалось загрузить баланс пользователя:', response.data.error);
      userBalance.value = 0;
    }
  } catch (error) {
    console.error('Ошибка загрузки баланса пользователя:', error);
    userBalance.value = 0;
  }
}

async function loadTokenHolders() {
  try {
    // Здесь можно добавить загрузку держателей токенов из блокчейна
    // Пока оставляем пустым
    tokenHolders.value = [];
  } catch (error) {
    console.error('Ошибка загрузки держателей токенов:', error);
  }
}

function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Методы
const formatAddress = (address) => {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};

// Функция создания предложения о переводе токенов через governance
const createTransferProposal = async () => {
  if (isCreatingProposal.value) return;
  
  try {
    // Проверяем подключение к кошельку
    if (!window.ethereum) {
      alert('Пожалуйста, установите MetaMask или другой Web3 кошелек');
      return;
    }

    // Проверяем, что пользователь подключен
    if (!currentUserAddress.value) {
      alert('Пожалуйста, подключите кошелек');
      return;
    }

    // Валидация данных
    const recipient = proposalData.value.recipient.trim();
    const amount = parseFloat(proposalData.value.amount);
    const description = proposalData.value.description.trim();

    if (!recipient) {
      alert('Пожалуйста, укажите адрес получателя');
      return;
    }

    // Проверяем, что адрес получателя является корректным Ethereum адресом
    if (!ethers.isAddress(recipient)) {
      alert('Пожалуйста, укажите корректный Ethereum адрес получателя');
      return;
    }

    if (!amount || amount <= 0) {
      alert('Пожалуйста, укажите корректное количество токенов');
      return;
    }

    if (!description) {
      alert('Пожалуйста, укажите описание предложения');
      return;
    }

    // Проверяем, что получатель не является отправителем
    if (recipient.toLowerCase() === currentUserAddress.value.toLowerCase()) {
      alert('Нельзя отправить токены самому себе');
      return;
    }

    isCreatingProposal.value = true;
    proposalStatus.value = 'Создание предложения...';

    // Создаем предложение
    const result = await createTransferTokensProposal(dleAddress.value, {
      recipient: recipient,
      amount: amount,
      description: description,
      duration: proposalData.value.duration * 3600, // Конвертируем часы в секунды
      governanceChainId: proposalData.value.governanceChainId,
      targetChains: proposalData.value.targetChains
    });

    proposalStatus.value = 'Предложение создано!';
    console.log('Предложение о переводе токенов создано:', result);

    // Сброс формы
    proposalData.value = {
      recipient: '',
      amount: '',
      description: '',
      duration: 86400,
      governanceChainId: 11155111,
      targetChains: [11155111]
    };

    // Очищаем статус через 5 секунд
    setTimeout(() => {
      proposalStatus.value = '';
    }, 5000);

    alert(`Предложение о переводе токенов создано!\nID предложения: ${result.proposalId}\nХеш транзакции: ${result.txHash}`);

  } catch (error) {
    console.error('Ошибка создания предложения о переводе токенов:', error);
    
    // Очищаем статус предложения
    proposalStatus.value = '';
    
    let errorMessage = 'Ошибка создания предложения о переводе токенов';
    
    if (error.code === 4001) {
      errorMessage = 'Транзакция отменена пользователем';
    } else if (error.message && error.message.includes('insufficient funds')) {
      errorMessage = 'Недостаточно ETH для оплаты газа';
    } else if (error.message && error.message.includes('execution reverted')) {
      errorMessage = 'Ошибка выполнения транзакции. Проверьте данные и попробуйте снова';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    alert(errorMessage);
  } finally {
    isCreatingProposal.value = false;
  }
};

// Отслеживаем изменения в адресе DLE
watch(dleAddress, (newAddress) => {
  if (newAddress) {
    loadDleData();
  }
}, { immediate: true });

// Отслеживаем изменения адреса пользователя
watch(currentUserAddress, (newAddress) => {
  if (newAddress && dleAddress.value) {
    loadUserBalance();
  } else {
    userBalance.value = 0;
  }
}, { immediate: true });
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

.dle-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.dle-name {
  font-weight: 600;
  color: #333;
  font-size: 1rem;
}

.dle-address {
  font-family: monospace;
  font-size: 0.875rem;
  color: #666;
  background: #f8f9fa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}

.loading-info,
.no-dle-info {
  font-size: 0.875rem;
  color: #666;
  font-style: italic;
  margin-top: 0.5rem;
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
.holders-section {
  margin-bottom: 40px;
}

.token-info-section h2,
.transfer-section h2,
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

.user-address {
  font-family: monospace;
  font-size: 0.75rem;
  color: #666;
  margin: 5px 0 0 0;
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 3px;
  display: inline-block;
}

.no-wallet {
  font-size: 0.75rem;
  color: #dc3545;
  margin: 5px 0 0 0;
  font-style: italic;
}

/* Формы */
.transfer-form {
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

/* Статус предложения */
.proposal-status {
  margin-top: 20px;
  padding: 15px;
  background: #e8f5e8;
  border-radius: var(--radius-sm);
  border-left: 4px solid #28a745;
}

.proposal-status .status-message {
  color: #28a745;
}

/* Описание секции */
.section-description {
  color: var(--color-grey-dark);
  font-size: 0.95rem;
  margin-bottom: 20px;
  line-height: 1.5;
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