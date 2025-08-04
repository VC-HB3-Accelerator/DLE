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
    <div class="dle-multisig-management">
    <div class="multisig-header">
      <h3>🔐 Управление мультиподписью</h3>
      <button class="btn btn-primary" @click="showCreateForm = true">
        <i class="fas fa-plus"></i> Создать операцию
      </button>
    </div>

    <!-- Форма создания мультиподписи -->
    <div v-if="showCreateForm" class="create-multisig-form">
      <div class="form-header">
        <h4>🔐 Новая мультиподпись</h4>
        <button class="close-btn" @click="showCreateForm = false">×</button>
      </div>
      
      <div class="form-content">
        <!-- Описание операции -->
        <div class="form-section">
          <h5>📝 Описание операции</h5>
          
          <div class="form-group">
            <label for="operationDescription">Описание операции:</label>
            <textarea 
              id="operationDescription" 
              v-model="newOperation.description" 
              class="form-control" 
              rows="3"
              placeholder="Опишите, что нужно сделать..."
            ></textarea>
          </div>
          
          <div class="form-group">
            <label for="operationDuration">Длительность сбора подписей (дни):</label>
            <input 
              type="number" 
              id="operationDuration" 
              v-model.number="newOperation.duration" 
              class="form-control"
              min="1"
              max="30"
              placeholder="7"
            >
          </div>
        </div>

        <!-- Тип операции -->
        <div class="form-section">
          <h5>⚙️ Тип операции</h5>
          
          <div class="operation-types">
            <div class="form-group">
              <label for="multisigOperationType">Выберите тип операции:</label>
              <select id="multisigOperationType" v-model="newOperation.operationType" class="form-control">
                <option value="">-- Выберите тип --</option>
                <option value="transfer">Передача токенов</option>
                <option value="mint">Минтинг токенов</option>
                <option value="burn">Сжигание токенов</option>
                <option value="addModule">Добавить модуль</option>
                <option value="removeModule">Удалить модуль</option>
                <option value="custom">Пользовательская операция</option>
              </select>
            </div>

            <!-- Параметры для передачи токенов -->
            <div v-if="newOperation.operationType === 'transfer'" class="operation-params">
              <div class="form-group">
                <label for="multisigTransferTo">Адрес получателя:</label>
                <input 
                  type="text" 
                  id="multisigTransferTo" 
                  v-model="newOperation.operationParams.to" 
                  class="form-control"
                  placeholder="0x..."
                >
              </div>
              <div class="form-group">
                <label for="multisigTransferAmount">Количество токенов:</label>
                <input 
                  type="number" 
                  id="multisigTransferAmount" 
                  v-model.number="newOperation.operationParams.amount" 
                  class="form-control"
                  min="1"
                  placeholder="100"
                >
              </div>
            </div>

            <!-- Параметры для модулей -->
            <div v-if="newOperation.operationType === 'addModule' || newOperation.operationType === 'removeModule'" class="operation-params">
              <div class="form-group">
                <label for="moduleId">ID модуля:</label>
                <input 
                  type="text" 
                  id="moduleId" 
                  v-model="newOperation.operationParams.moduleId" 
                  class="form-control"
                  placeholder="TreasuryModule"
                >
              </div>
              <div v-if="newOperation.operationType === 'addModule'" class="form-group">
                <label for="moduleAddress">Адрес модуля:</label>
                <input 
                  type="text" 
                  id="moduleAddress" 
                  v-model="newOperation.operationParams.moduleAddress" 
                  class="form-control"
                  placeholder="0x..."
                >
              </div>
            </div>

            <!-- Пользовательская операция -->
            <div v-if="newOperation.operationType === 'custom'" class="operation-params">
              <div class="form-group">
                <label for="customMultisigOperation">Пользовательская операция (hex):</label>
                <textarea 
                  id="customMultisigOperation" 
                  v-model="newOperation.operationParams.customData" 
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
              <strong>Описание:</strong> {{ newOperation.description || 'Не указано' }}
            </div>
            <div class="preview-item">
              <strong>Длительность:</strong> {{ newOperation.duration || 7 }} дней
            </div>
            <div class="preview-item">
              <strong>Тип операции:</strong> {{ getOperationTypeName(newOperation.operationType) || 'Не выбран' }}
            </div>
            <div v-if="newOperation.operationType" class="preview-item">
              <strong>Параметры:</strong> {{ getOperationParamsPreview() }}
            </div>
            <div class="preview-item">
              <strong>Хеш операции:</strong> {{ getOperationHash() }}
            </div>
          </div>
        </div>

        <!-- Действия -->
        <div class="form-actions">
          <button 
            class="btn btn-success" 
            @click="createMultisigOperation" 
            :disabled="!isFormValid || isCreating"
          >
            <i class="fas fa-paper-plane"></i> 
            {{ isCreating ? 'Создание...' : 'Создать операцию' }}
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

    <!-- Список операций мультиподписи -->
    <div class="multisig-list">
      <div class="list-header">
        <h4>📋 Список операций мультиподписи</h4>
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

      <div v-if="filteredOperations.length === 0" class="no-operations">
        <p>Операций мультиподписи пока нет</p>
      </div>

      <div v-else class="operations-grid">
        <div 
          v-for="operation in filteredOperations" 
          :key="operation.id" 
          class="operation-card"
          :class="operation.status"
        >
          <div class="operation-header">
            <h5>{{ operation.description }}</h5>
            <span class="operation-status" :class="operation.status">
              {{ getOperationStatusText(operation.status) }}
            </span>
          </div>

          <div class="operation-details">
            <div class="detail-item">
              <strong>ID:</strong> #{{ operation.id }}
            </div>
            <div class="detail-item">
              <strong>Создатель:</strong> {{ shortenAddress(operation.initiator) }}
            </div>
            <div class="detail-item">
              <strong>Хеш:</strong> {{ shortenAddress(operation.operationHash) }}
            </div>
            <div class="detail-item">
              <strong>Дедлайн:</strong> {{ formatDate(operation.deadline) }}
            </div>
            <div class="detail-item">
              <strong>Подписи:</strong> 
              <span class="signatures">
                <span class="for">За: {{ operation.forSignatures }}</span>
                <span class="against">Против: {{ operation.againstSignatures }}</span>
              </span>
            </div>
          </div>

          <div class="operation-actions">
            <button 
              v-if="canSign(operation)"
              class="btn btn-sm btn-success" 
              @click="signOperation(operation.id, true)"
              :disabled="hasSigned(operation.id, true)"
            >
              <i class="fas fa-thumbs-up"></i> Подписать за
            </button>
            <button 
              v-if="canSign(operation)"
              class="btn btn-sm btn-danger" 
              @click="signOperation(operation.id, false)"
              :disabled="hasSigned(operation.id, false)"
            >
              <i class="fas fa-thumbs-down"></i> Подписать против
            </button>
            <button 
              v-if="canExecute(operation)"
              class="btn btn-sm btn-primary" 
              @click="executeOperation(operation.id)"
            >
              <i class="fas fa-play"></i> Исполнить
            </button>
            <button 
              class="btn btn-sm btn-info" 
              @click="viewOperationDetails(operation.id)"
            >
              <i class="fas fa-eye"></i> Детали
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted, defineProps, defineEmits } from 'vue';
import { useAuthContext } from '@/composables/useAuth';
import BaseLayout from '../../components/BaseLayout.vue';

const props = defineProps({
  dleAddress: { type: String, required: false, default: null },
  dleContract: { type: Object, required: false, default: null },
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

const emit = defineEmits(['auth-action-completed']);

const { address } = useAuthContext();

// Состояние формы
const showCreateForm = ref(false);
const isCreating = ref(false);
const statusFilter = ref('');

// Новая операция
const newOperation = ref({
  description: '',
  duration: 7,
  operationType: '',
  operationParams: {
    to: '',
    from: '',
    amount: 0,
    moduleId: '',
    moduleAddress: '',
    customData: ''
  }
});

// Операции мультиподписи
const operations = ref([]);

// Вычисляемые свойства
const isFormValid = computed(() => {
  return (
    newOperation.value.description &&
    newOperation.value.duration > 0 &&
    newOperation.value.operationType &&
    validateOperationParams()
  );
});

const filteredOperations = computed(() => {
  if (!statusFilter.value) return operations.value;
  return operations.value.filter(o => o.status === statusFilter.value);
});

// Функции
function validateOperationParams() {
  const params = newOperation.value.operationParams;
  
  switch (newOperation.value.operationType) {
    case 'transfer':
    case 'mint':
      return params.to && params.amount > 0;
    case 'burn':
      return params.from && params.amount > 0;
    case 'addModule':
      return params.moduleId && params.moduleAddress;
    case 'removeModule':
      return params.moduleId;
    case 'custom':
      return params.customData && params.customData.startsWith('0x');
    default:
      return false;
  }
}

function getOperationTypeName(type) {
  const types = {
    'transfer': 'Передача токенов',
    'mint': 'Минтинг токенов',
    'burn': 'Сжигание токенов',
    'addModule': 'Добавить модуль',
    'removeModule': 'Удалить модуль',
    'custom': 'Пользовательская операция'
  };
  return types[type] || 'Неизвестный тип';
}

function getOperationParamsPreview() {
  const params = newOperation.value.operationParams;
  
  switch (newOperation.value.operationType) {
    case 'transfer':
      return `Кому: ${shortenAddress(params.to)}, Количество: ${params.amount}`;
    case 'mint':
      return `Кому: ${shortenAddress(params.to)}, Количество: ${params.amount}`;
    case 'burn':
      return `От: ${shortenAddress(params.from)}, Количество: ${params.amount}`;
    case 'addModule':
      return `ID: ${params.moduleId}, Адрес: ${shortenAddress(params.moduleAddress)}`;
    case 'removeModule':
      return `ID: ${params.moduleId}`;
    case 'custom':
      return `Данные: ${params.customData.substring(0, 20)}...`;
    default:
      return 'Не указаны';
  }
}

function getOperationHash() {
  // Генерируем хеш операции на основе параметров
  const params = newOperation.value.operationParams;
  const operationData = JSON.stringify({
    type: newOperation.value.operationType,
    params: params
  });
  
  // Простой хеш для демонстрации
  return '0x' + btoa(operationData).substring(0, 64);
}

function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleString();
}

function getOperationStatusText(status) {
  const statusMap = {
    'pending': 'Ожидает',
    'active': 'Активно',
    'succeeded': 'Принято',
    'defeated': 'Отклонено',
    'executed': 'Выполнено'
  };
  return statusMap[status] || status;
}

function canSign(operation) {
  return operation.status === 'active' && !hasSigned(operation.id);
}

function canExecute(operation) {
  return operation.status === 'succeeded' && !operation.executed;
}

function hasSigned(operationId, support = null) {
  // Здесь должна быть проверка подписи пользователя
  return false;
}

// Создание операции мультиподписи
async function createMultisigOperation() {
  if (!isFormValid.value) {
    alert('Пожалуйста, заполните все обязательные поля');
    return;
  }

  isCreating.value = true;
  
  try {
    // Генерируем хеш операции
    const operationHash = getOperationHash();
    
    // Вызов смарт-контракта
    const tx = await props.dleContract.createMultiSigOperation(
      operationHash,
      newOperation.value.duration * 24 * 60 * 60 // конвертируем в секунды
    );
    
    await tx.wait();
    
    // Обновляем список операций
    await loadOperations();
    
    // Сбрасываем форму
    resetForm();
    showCreateForm.value = false;
    
    alert('✅ Операция мультиподписи успешно создана!');
    
  } catch (error) {
          // console.error('Ошибка при создании операции мультиподписи:', error);
    alert('❌ Ошибка при создании операции: ' + error.message);
  } finally {
    isCreating.value = false;
  }
}

// Подписание операции
async function signOperation(operationId, support) {
  try {
    const tx = await props.dleContract.signMultiSigOperation(operationId, support);
    await tx.wait();
    
    await loadOperations();
    alert('✅ Ваша подпись учтена!');
    
  } catch (error) {
          // console.error('Ошибка при подписании операции:', error);
    alert('❌ Ошибка при подписании: ' + error.message);
  }
}

// Исполнение операции
async function executeOperation(operationId) {
  try {
    const tx = await props.dleContract.executeMultiSigOperation(operationId);
    await tx.wait();
    
    await loadOperations();
    alert('✅ Операция успешно исполнена!');
    
  } catch (error) {
          // console.error('Ошибка при исполнении операции:', error);
    alert('❌ Ошибка при исполнении операции: ' + error.message);
  }
}

// Загрузка операций
async function loadOperations() {
  try {
    // Здесь должен быть вызов API или смарт-контракта для загрузки операций
    // Пока используем заглушку
    operations.value = [];
  } catch (error) {
          // console.error('Ошибка при загрузке операций:', error);
  }
}

function resetForm() {
  newOperation.value = {
    description: '',
    duration: 7,
    operationType: '',
    operationParams: {
      to: '',
      from: '',
      amount: 0,
      moduleId: '',
      moduleAddress: '',
      customData: ''
    }
  };
}

function viewOperationDetails(operationId) {
  // Открыть модальное окно с деталями операции
      // console.log('Просмотр деталей операции:', operationId);
}

onMounted(() => {
  loadOperations();
});
</script>

<style scoped>
.dle-multisig-management {
  padding: 1rem;
}

.multisig-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.create-multisig-form {
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

.multisig-list {
  margin-top: 2rem;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.operations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.operation-card {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  background: #fff;
}

.operation-card.active {
  border-color: #28a745;
}

.operation-card.succeeded {
  border-color: #007bff;
}

.operation-card.defeated {
  border-color: #dc3545;
}

.operation-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.operation-header h5 {
  margin: 0;
  color: #333;
}

.operation-status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.operation-status.active {
  background: #d4edda;
  color: #155724;
}

.operation-status.succeeded {
  background: #d1ecf1;
  color: #0c5460;
}

.operation-status.defeated {
  background: #f8d7da;
  color: #721c24;
}

.operation-details {
  margin-bottom: 1rem;
}

.detail-item {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.signatures {
  display: flex;
  gap: 1rem;
}

.signatures .for {
  color: #28a745;
}

.signatures .against {
  color: #dc3545;
}

.operation-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.no-operations {
  text-align: center;
  padding: 2rem;
  color: #666;
}
</style> 