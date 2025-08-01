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
  <div class="dle-proposals-management">
    <div class="proposals-header">
      <h3>🗳️ Управление предложениями</h3>
      <button class="btn btn-primary" @click="showCreateForm = true">
        <i class="fas fa-plus"></i> Создать предложение
      </button>
    </div>

    <!-- Форма создания предложения -->
    <div v-if="showCreateForm" class="create-proposal-form">
      <div class="form-header">
        <h4>📝 Новое предложение</h4>
        <button class="close-btn" @click="showCreateForm = false">×</button>
      </div>
      
      <div class="form-content">
        <!-- Основная информация -->
        <div class="form-section">
          <h5>📋 Основная информация</h5>
          
          <div class="form-group">
            <label for="proposalDescription">Описание предложения:</label>
            <textarea 
              id="proposalDescription" 
              v-model="newProposal.description" 
              class="form-control" 
              rows="3"
              placeholder="Опишите, что нужно сделать..."
            ></textarea>
          </div>
          
          <div class="form-group">
            <label for="proposalDuration">Длительность голосования (дни):</label>
            <input 
              type="number" 
              id="proposalDuration" 
              v-model.number="newProposal.duration" 
              class="form-control"
              min="1"
              max="30"
              placeholder="7"
            >
          </div>
        </div>

        <!-- Выбор цепочки для кворума -->
        <div class="form-section">
          <h5>🔗 Выбор цепочки для кворума</h5>
          <p class="form-help">Выберите цепочку, в которой будет происходить сбор голосов</p>
          
          <div class="chains-grid">
            <div 
              v-for="chain in availableChains" 
              :key="chain.chainId"
              class="chain-option"
              :class="{ 'selected': newProposal.governanceChainId === chain.chainId }"
              @click="newProposal.governanceChainId = chain.chainId"
            >
              <div class="chain-info">
                <h6>{{ chain.name }}</h6>
                <span class="chain-id">Chain ID: {{ chain.chainId }}</span>
                <p class="chain-description">{{ chain.description }}</p>
              </div>
              <div class="chain-status">
                <i v-if="newProposal.governanceChainId === chain.chainId" class="fas fa-check"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- Тип операции -->
        <div class="form-section">
          <h5>⚙️ Тип операции</h5>
          
          <div class="operation-types">
            <div class="form-group">
              <label for="operationType">Выберите тип операции:</label>
              <select id="operationType" v-model="newProposal.operationType" class="form-control">
                <option value="">-- Выберите тип --</option>
                <option value="transfer">Передача токенов</option>
                <option value="mint">Минтинг токенов</option>
                <option value="burn">Сжигание токенов</option>
                <option value="custom">Пользовательская операция</option>
              </select>
            </div>

            <!-- Параметры для передачи токенов -->
            <div v-if="newProposal.operationType === 'transfer'" class="operation-params">
              <div class="form-group">
                <label for="transferTo">Адрес получателя:</label>
                <input 
                  type="text" 
                  id="transferTo" 
                  v-model="newProposal.operationParams.to" 
                  class="form-control"
                  placeholder="0x..."
                >
              </div>
              <div class="form-group">
                <label for="transferAmount">Количество токенов:</label>
                <input 
                  type="number" 
                  id="transferAmount" 
                  v-model.number="newProposal.operationParams.amount" 
                  class="form-control"
                  min="1"
                  placeholder="100"
                >
              </div>
            </div>

            <!-- Параметры для минтинга -->
            <div v-if="newProposal.operationType === 'mint'" class="operation-params">
              <div class="form-group">
                <label for="mintTo">Адрес получателя:</label>
                <input 
                  type="text" 
                  id="mintTo" 
                  v-model="newProposal.operationParams.to" 
                  class="form-control"
                  placeholder="0x..."
                >
              </div>
              <div class="form-group">
                <label for="mintAmount">Количество токенов:</label>
                <input 
                  type="number" 
                  id="mintAmount" 
                  v-model.number="newProposal.operationParams.amount" 
                  class="form-control"
                  min="1"
                  placeholder="1000"
                >
              </div>
            </div>

            <!-- Параметры для сжигания -->
            <div v-if="newProposal.operationType === 'burn'" class="operation-params">
              <div class="form-group">
                <label for="burnFrom">Адрес владельца:</label>
                <input 
                  type="text" 
                  id="burnFrom" 
                  v-model="newProposal.operationParams.from" 
                  class="form-control"
                  placeholder="0x..."
                >
              </div>
              <div class="form-group">
                <label for="burnAmount">Количество токенов:</label>
                <input 
                  type="number" 
                  id="burnAmount" 
                  v-model.number="newProposal.operationParams.amount" 
                  class="form-control"
                  min="1"
                  placeholder="100"
                >
              </div>
            </div>

            <!-- Пользовательская операция -->
            <div v-if="newProposal.operationType === 'custom'" class="operation-params">
              <div class="form-group">
                <label for="customOperation">Пользовательская операция (hex):</label>
                <textarea 
                  id="customOperation" 
                  v-model="newProposal.operationParams.customData" 
                  class="form-control"
                  rows="3"
                  placeholder="0x..."
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- Предварительный просмотр -->
        <div class="form-section">
          <h5>👁️ Предварительный просмотр</h5>
          <div class="preview-card">
            <div class="preview-item">
              <strong>Описание:</strong> {{ newProposal.description || 'Не указано' }}
            </div>
            <div class="preview-item">
              <strong>Длительность:</strong> {{ newProposal.duration || 7 }} дней
            </div>
            <div class="preview-item">
              <strong>Цепочка для кворума:</strong> 
              {{ getChainName(newProposal.governanceChainId) || 'Не выбрана' }}
            </div>
            <div class="preview-item">
              <strong>Тип операции:</strong> {{ getOperationTypeName(newProposal.operationType) || 'Не выбран' }}
            </div>
            <div v-if="newProposal.operationType" class="preview-item">
              <strong>Параметры:</strong> {{ getOperationParamsPreview() }}
            </div>
          </div>
        </div>

        <!-- Действия -->
        <div class="form-actions">
          <button 
            class="btn btn-success" 
            @click="createProposal" 
            :disabled="!isFormValid || isCreating"
          >
            <i class="fas fa-paper-plane"></i> 
            {{ isCreating ? 'Создание...' : 'Создать предложение' }}
          </button>
          <button class="btn btn-secondary" @click="resetForm">
            <i class="fas fa-undo"></i> Сбросить
          </button>
          <button class="btn btn-danger" @click="showCreateForm = false">
            <i class="fas fa-times"></i> Отмена
          </button>
        </div>
      </div>
    </div>

    <!-- Список предложений -->
    <div class="proposals-list">
      <div class="list-header">
        <h4>📋 Список предложений</h4>
        <div class="list-filters">
          <select v-model="statusFilter" class="form-control">
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="pending">Ожидающие</option>
            <option value="succeeded">Принятые</option>
            <option value="defeated">Отклоненные</option>
            <option value="executed">Выполненные</option>
          </select>
        </div>
      </div>

      <div v-if="filteredProposals.length === 0" class="no-proposals">
        <p>Предложений пока нет</p>
      </div>

      <div v-else class="proposals-grid">
        <div 
          v-for="proposal in filteredProposals" 
          :key="proposal.id" 
          class="proposal-card"
          :class="proposal.status"
        >
          <div class="proposal-header">
            <h5>{{ proposal.description }}</h5>
            <span class="proposal-status" :class="proposal.status">
              {{ getProposalStatusText(proposal.status) }}
            </span>
          </div>

          <div class="proposal-details">
            <div class="detail-item">
              <strong>ID:</strong> #{{ proposal.id }}
            </div>
            <div class="detail-item">
              <strong>Создатель:</strong> {{ shortenAddress(proposal.initiator) }}
            </div>
            <div class="detail-item">
              <strong>Цепочка:</strong> {{ getChainName(proposal.governanceChainId) }}
            </div>
            <div class="detail-item">
              <strong>Дедлайн:</strong> {{ formatDate(proposal.deadline) }}
            </div>
            <div class="detail-item">
              <strong>Голоса:</strong> 
              <span class="votes">
                <span class="for">За: {{ proposal.forVotes }}</span>
                <span class="against">Против: {{ proposal.againstVotes }}</span>
              </span>
            </div>
          </div>

          <div class="proposal-actions">
            <button 
              v-if="canVote(proposal)"
              class="btn btn-sm btn-success" 
              @click="voteForProposal(proposal.id, true)"
              :disabled="hasVoted(proposal.id, true)"
            >
              <i class="fas fa-thumbs-up"></i> За
            </button>
            <button 
              v-if="canVote(proposal)"
              class="btn btn-sm btn-danger" 
              @click="voteForProposal(proposal.id, false)"
              :disabled="hasVoted(proposal.id, false)"
            >
              <i class="fas fa-thumbs-down"></i> Против
            </button>
            <button 
              v-if="canExecute(proposal)"
              class="btn btn-sm btn-primary" 
              @click="executeProposal(proposal.id)"
            >
              <i class="fas fa-play"></i> Исполнить
            </button>
            <button 
              class="btn btn-sm btn-info" 
              @click="viewProposalDetails(proposal.id)"
            >
              <i class="fas fa-eye"></i> Детали
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthContext } from '@/composables/useAuth';

const props = defineProps({
  dleAddress: { type: String, required: true },
  dleContract: { type: Object, required: true }
});

const { address } = useAuthContext();

// Состояние формы
const showCreateForm = ref(false);
const isCreating = ref(false);
const statusFilter = ref('');

// Новое предложение
const newProposal = ref({
  description: '',
  duration: 7,
  governanceChainId: null,
  operationType: '',
  operationParams: {
    to: '',
    from: '',
    amount: 0,
    customData: ''
  }
});

// Доступные цепочки
const availableChains = ref([
  { chainId: 1, name: 'Ethereum', description: 'Основная сеть Ethereum' },
  { chainId: 137, name: 'Polygon', description: 'Сеть Polygon' },
  { chainId: 56, name: 'BSC', description: 'Binance Smart Chain' },
  { chainId: 42161, name: 'Arbitrum', description: 'Arbitrum One' }
]);

// Предложения
const proposals = ref([]);

// Вычисляемые свойства
const isFormValid = computed(() => {
  return (
    newProposal.value.description &&
    newProposal.value.duration > 0 &&
    newProposal.value.governanceChainId &&
    newProposal.value.operationType &&
    validateOperationParams()
  );
});

const filteredProposals = computed(() => {
  if (!statusFilter.value) return proposals.value;
  return proposals.value.filter(p => p.status === statusFilter.value);
});

// Функции
function validateOperationParams() {
  const params = newProposal.value.operationParams;
  
  switch (newProposal.value.operationType) {
    case 'transfer':
    case 'mint':
      return params.to && params.amount > 0;
    case 'burn':
      return params.from && params.amount > 0;
    case 'custom':
      return params.customData && params.customData.startsWith('0x');
    default:
      return false;
  }
}

function getChainName(chainId) {
  const chain = availableChains.value.find(c => c.chainId === chainId);
  return chain ? chain.name : 'Неизвестная сеть';
}

function getOperationTypeName(type) {
  const types = {
    'transfer': 'Передача токенов',
    'mint': 'Минтинг токенов',
    'burn': 'Сжигание токенов',
    'custom': 'Пользовательская операция'
  };
  return types[type] || 'Неизвестный тип';
}

function getOperationParamsPreview() {
  const params = newProposal.value.operationParams;
  
  switch (newProposal.value.operationType) {
    case 'transfer':
      return `Кому: ${shortenAddress(params.to)}, Количество: ${params.amount}`;
    case 'mint':
      return `Кому: ${shortenAddress(params.to)}, Количество: ${params.amount}`;
    case 'burn':
      return `От: ${shortenAddress(params.from)}, Количество: ${params.amount}`;
    case 'custom':
      return `Данные: ${params.customData.substring(0, 20)}...`;
    default:
      return 'Не указаны';
  }
}

function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleString();
}

function getProposalStatusText(status) {
  const statusMap = {
    'pending': 'Ожидает',
    'active': 'Активно',
    'succeeded': 'Принято',
    'defeated': 'Отклонено',
    'executed': 'Выполнено'
  };
  return statusMap[status] || status;
}

function canVote(proposal) {
  return proposal.status === 'active' && !hasVoted(proposal.id);
}

function canExecute(proposal) {
  return proposal.status === 'succeeded' && !proposal.executed;
}

function hasVoted(proposalId, support = null) {
  // Здесь должна быть проверка голосования пользователя
  return false;
}

// Создание предложения
async function createProposal() {
  if (!isFormValid.value) {
    alert('Пожалуйста, заполните все обязательные поля');
    return;
  }

  isCreating.value = true;
  
  try {
    // Подготовка данных для смарт-контракта
    const operation = encodeOperation();
    
    // Вызов смарт-контракта
    const tx = await props.dleContract.createProposal(
      newProposal.value.description,
      newProposal.value.duration * 24 * 60 * 60, // конвертируем в секунды
      operation,
      newProposal.value.governanceChainId
    );
    
    await tx.wait();
    
    // Обновляем список предложений
    await loadProposals();
    
    // Сбрасываем форму
    resetForm();
    showCreateForm.value = false;
    
    alert('✅ Предложение успешно создано!');
    
  } catch (error) {
          // console.error('Ошибка при создании предложения:', error);
    alert('❌ Ошибка при создании предложения: ' + error.message);
  } finally {
    isCreating.value = false;
  }
}

function encodeOperation() {
  const params = newProposal.value.operationParams;
  
  switch (newProposal.value.operationType) {
    case 'transfer':
      return encodeTransferOperation(params.to, params.amount);
    case 'mint':
      return encodeMintOperation(params.to, params.amount);
    case 'burn':
      return encodeBurnOperation(params.from, params.amount);
    case 'custom':
      return params.customData;
    default:
      throw new Error('Неизвестный тип операции');
  }
}

function encodeTransferOperation(to, amount) {
  // Кодируем операцию передачи токенов
  const abiCoder = new ethers.AbiCoder();
  const selector = '0xa9059cbb'; // transfer(address,uint256)
  const data = abiCoder.encode(['address', 'uint256'], [to, amount]);
  return selector + data.slice(2);
}

function encodeMintOperation(to, amount) {
  // Кодируем операцию минтинга токенов
  const abiCoder = new ethers.AbiCoder();
  const selector = '0x40c10f19'; // mint(address,uint256)
  const data = abiCoder.encode(['address', 'uint256'], [to, amount]);
  return selector + data.slice(2);
}

function encodeBurnOperation(from, amount) {
  // Кодируем операцию сжигания токенов
  const abiCoder = new ethers.AbiCoder();
  const selector = '0x42966c68'; // burn(uint256)
  const data = abiCoder.encode(['uint256'], [amount]);
  return selector + data.slice(2);
}

// Голосование
async function voteForProposal(proposalId, support) {
  try {
    const tx = await props.dleContract.vote(proposalId, support);
    await tx.wait();
    
    await loadProposals();
    alert('✅ Ваш голос учтен!');
    
  } catch (error) {
          // console.error('Ошибка при голосовании:', error);
    alert('❌ Ошибка при голосовании: ' + error.message);
  }
}

// Исполнение предложения
async function executeProposal(proposalId) {
  try {
    const tx = await props.dleContract.executeProposal(proposalId);
    await tx.wait();
    
    await loadProposals();
    alert('✅ Предложение успешно исполнено!');
    
  } catch (error) {
          // console.error('Ошибка при исполнении предложения:', error);
    alert('❌ Ошибка при исполнении предложения: ' + error.message);
  }
}

// Загрузка предложений
async function loadProposals() {
  try {
    // Здесь должен быть вызов API или смарт-контракта для загрузки предложений
    // Пока используем заглушку
    proposals.value = [];
  } catch (error) {
          // console.error('Ошибка при загрузке предложений:', error);
  }
}

function resetForm() {
  newProposal.value = {
    description: '',
    duration: 7,
    governanceChainId: null,
    operationType: '',
    operationParams: {
      to: '',
      from: '',
      amount: 0,
      customData: ''
    }
  };
}

function viewProposalDetails(proposalId) {
  // Открыть модальное окно с деталями предложения
      // console.log('Просмотр деталей предложения:', proposalId);
}

onMounted(() => {
  loadProposals();
});
</script>

<style scoped>
.dle-proposals-management {
  padding: 1rem;
}

.proposals-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.create-proposal-form {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
}

.form-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.form-section:last-child {
  border-bottom: none;
}

.form-section h5 {
  color: #333;
  margin-bottom: 1rem;
}

.chains-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.chain-option {
  border: 2px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.chain-option:hover {
  border-color: #007bff;
}

.chain-option.selected {
  border-color: #007bff;
  background: #f8f9ff;
}

.chain-info h6 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.chain-id {
  font-size: 0.9rem;
  color: #666;
}

.chain-description {
  font-size: 0.9rem;
  color: #888;
  margin: 0.5rem 0 0 0;
}

.chain-status {
  text-align: right;
  color: #007bff;
}

.operation-types {
  margin-top: 1rem;
}

.operation-params {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.preview-card {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 1rem;
}

.preview-item {
  margin-bottom: 0.5rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.proposals-list {
  margin-top: 2rem;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.proposals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.proposal-card {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  background: #fff;
}

.proposal-card.active {
  border-color: #28a745;
}

.proposal-card.succeeded {
  border-color: #007bff;
}

.proposal-card.defeated {
  border-color: #dc3545;
}

.proposal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.proposal-header h5 {
  margin: 0;
  color: #333;
}

.proposal-status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.proposal-status.active {
  background: #d4edda;
  color: #155724;
}

.proposal-status.succeeded {
  background: #d1ecf1;
  color: #0c5460;
}

.proposal-status.defeated {
  background: #f8d7da;
  color: #721c24;
}

.proposal-details {
  margin-bottom: 1rem;
}

.detail-item {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.votes {
  display: flex;
  gap: 1rem;
}

.votes .for {
  color: #28a745;
}

.votes .against {
  color: #dc3545;
}

.proposal-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.no-proposals {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.form-help {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 1rem;
}
</style> 