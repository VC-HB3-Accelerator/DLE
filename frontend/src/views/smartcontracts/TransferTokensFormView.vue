<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.

  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.

  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <BaseLayout
    :is-authenticated="props.isAuthenticated"
    :identities="props.identities"
    :token-balances="props.tokenBalances"
    :is-loading-tokens="props.isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="transfer-tokens-page">
      <!-- Информация для неавторизованных пользователей -->
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div v-if="selectedDle?.dleAddress" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ selectedDle.dleAddress }}
        </div>
        <div v-else-if="dleAddress" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ dleAddress }}
        </div>
        <div v-else-if="isLoadingDle" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          Загрузка...
        </div>
        <button class="close-btn" @click="goBackToProposals">×</button>
      </div>
      <div v-if="!props.isAuthenticated" class="auth-notice">
        <div class="alert alert-info">
          <i class="fas fa-info-circle"></i>
          <strong>Для создания предложений необходимо авторизоваться в приложении</strong>
          <p class="mb-0 mt-2">Подключите кошелек в сайдбаре для создания новых предложений</p>
        </div>
      </div>

      <!-- Форма передачи токенов -->
      <div v-if="props.isAuthenticated" class="transfer-tokens-form">
        <form @submit.prevent="submitForm" class="form-container">
          <!-- Адрес отправителя -->
          <div class="form-group">
            <label for="sender" class="form-label">
              <i class="fas fa-paper-plane"></i>
              Адрес отправителя *
            </label>
            <input
              type="text"
              id="sender"
              v-model="formData.sender"
              class="form-input"
              readonly
              required
            />
            <small class="form-help">
              Ваш подключенный кошелек - токены будут отправлены с этого адреса
            </small>
          </div>

          <!-- Адрес получателя -->
          <div class="form-group">
            <label for="recipient" class="form-label">
              <i class="fas fa-user"></i>
              Адрес получателя *
            </label>
            <input
              type="text"
              id="recipient"
              v-model="formData.recipient"
              class="form-input"
              placeholder="0x..."
              required
            />
            <small class="form-help">
              Ethereum-адрес получателя токенов DLE
            </small>
          </div>

          <!-- Количество токенов -->
          <div class="form-group">
            <label for="amount" class="form-label">
              <i class="fas fa-coins"></i>
              Количество токенов *
            </label>
            <input
              type="number"
              id="amount"
              v-model.number="formData.amount"
              class="form-input"
              placeholder="1000000"
              min="1"
              step="1"
              required
            />
            <small class="form-help">
              Количество токенов для перевода (без decimals)
            </small>
            <div v-if="dleInfo?.totalSupply" class="balance-info">
              <i class="fas fa-info-circle"></i>
              Доступный баланс DLE: {{ formatTokenAmount(dleInfo.totalSupply) }} {{ dleInfo.symbol }}
            </div>
          </div>

          <!-- Описание предложения -->
          <div class="form-group">
            <label for="description" class="form-label">
              <i class="fas fa-file-alt"></i>
              Описание предложения *
            </label>
            <textarea
              id="description"
              v-model="formData.description"
              class="form-textarea"
              placeholder="Опишите цель перевода токенов..."
              rows="3"
              required
            ></textarea>
            <small class="form-help">
              Подробное описание предложения для голосования
            </small>
          </div>

          <!-- Время голосования -->
          <div class="form-group">
            <label for="votingDuration" class="form-label">
              <i class="fas fa-clock"></i>
              Время голосования *
            </label>
            <select
              id="votingDuration"
              v-model="formData.votingDuration"
              class="form-select"
              required
            >
              <option value="">Выберите время голосования</option>
              <option value="3600">1 час</option>
              <option value="86400">1 день</option>
              <option value="259200">3 дня</option>
              <option value="604800">7 дней</option>
              <option value="1209600">14 дней</option>
            </select>
            <small class="form-help">
              Время, в течение которого будет проходить голосование
            </small>
          </div>

          <!-- Информация о мульти-чейн развертывании -->
          <div v-if="dleInfo?.deployedNetworks && dleInfo.deployedNetworks.length > 1" class="multichain-info">
            <i class="fas fa-info-circle"></i>
            <strong>Мульти-чейн деплой:</strong> Предложение будет создано для {{ dleInfo.deployedNetworks.length }} сетей: {{
              dleInfo.deployedNetworks.map(net => getChainName(net.chainId)).join(', ')
            }}. Голосование и исполнение произойдет в каждой сети отдельно.
          </div>

          <!-- Кнопки -->
          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="goBackToProposals">
              <i class="fas fa-arrow-left"></i>
              Назад
            </button>
            <button type="submit" class="btn-primary" :disabled="isSubmitting">
              <i class="fas fa-paper-plane" :class="{ 'fa-spin': isSubmitting }"></i>
              {{ isSubmitting ? 'Создание...' : 'Создать предложение' }}
            </button>
          </div>
        </form>

        <!-- Результат создания предложений -->
        <div v-if="proposalResult" class="proposal-result">
          <div class="alert" :class="proposalResult.success ? 'alert-success' : 'alert-danger'">
            <i :class="proposalResult.success ? 'fas fa-check-circle' : 'fas fa-exclamation-triangle'"></i>
            <strong>{{ proposalResult.success ? 'Успех!' : 'Ошибка!' }}</strong>
            <p class="mb-0 mt-2">{{ proposalResult.message }}</p>
          </div>

          <!-- Детализация по цепочкам -->
          <div v-if="proposalResult.results" class="chain-results">
            <h5>Результаты по цепочкам:</h5>
            <div class="chain-result-list">
              <div
                v-for="result in proposalResult.results"
                :key="result.chainId"
                class="chain-result-item"
                :class="{ success: result.success, error: !result.success }"
              >
                <div class="chain-header">
                  <span class="chain-name">{{ getChainName(result.chainId) }}</span>
                  <span class="chain-status">
                    <i :class="result.success ? 'fas fa-check' : 'fas fa-times'"></i>
                    {{ result.success ? 'Успешно' : 'Ошибка' }}
                  </span>
                </div>
                <div v-if="result.success && result.proposalId" class="proposal-info">
                  <small>ID предложения: {{ result.proposalId }}</small>
                  <br>
                  <small>Адрес контракта: {{ shortenAddress(result.contractAddress) }}</small>
                </div>
                <div v-if="!result.success" class="error-info">
                  <small>{{ result.error }}</small>
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
import { defineProps, defineEmits, ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import api from '@/api/axios';
import { ethers } from 'ethers';
import { createProposal } from '@/utils/dle-contract';
import { useAuthContext } from '../../composables/useAuth';

// Определяем props
const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false }
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();

// Получаем контекст аутентификации
const { address: currentUserAddress } = useAuthContext();

// Реактивные данные
const dleAddress = ref(route.query.address || '');
const selectedDle = ref(null);
const isLoadingDle = ref(false);
const dleInfo = ref(null);
const supportedChains = ref([]);
const isSubmitting = ref(false);
const proposalResult = ref(null);

// Форма
const formData = ref({
  sender: '',
  recipient: '',
  amount: null,
  description: '',
  votingDuration: '',
  governanceChain: ''
});

// Загрузка информации о DLE
async function loadDleInfo() {
  if (!dleAddress.value) return;

  try {
    isLoadingDle.value = true;

    // Получаем информацию о DLE из блокчейна
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: dleAddress.value
    });

    if (response.data.success) {
      dleInfo.value = response.data.data;
      console.log('DLE Info loaded:', dleInfo.value);

      // Получаем поддерживаемые цепочки из данных DLE
      if (dleInfo.value.deployedNetworks && dleInfo.value.deployedNetworks.length > 0) {
        supportedChains.value = dleInfo.value.deployedNetworks.map(net => ({
          chainId: net.chainId,
          name: getChainName(net.chainId)
        }));
      } else {
        console.warn('No deployed networks found for DLE');
        supportedChains.value = [];
      }
    }

  } catch (error) {
    console.error('Error loading DLE info:', error);
  } finally {
    isLoadingDle.value = false;
  }
}

// Валидация адреса Ethereum
function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Форматирование количества токенов
function formatTokenAmount(amount) {
  if (!amount) return '0';
  const num = parseFloat(amount);
  if (num === 0) return '0';

  if (num < 1) {
    return num.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 18
    });
  }

  return num.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}

// Сокращение адреса
function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Получение имени цепочки
function getChainName(chainId) {
  const chainNames = {
    1: 'Ethereum',
    11155111: 'Sepolia',
    17000: 'Holesky',
    421614: 'Arbitrum Sepolia',
    84532: 'Base Sepolia',
    137: 'Polygon',
    56: 'BSC',
    42161: 'Arbitrum'
  };
  return chainNames[chainId] || `Chain ${chainId}`;
}

// Создание encoded call data для _transferTokens
function encodeTransferTokensCall(sender, recipient, amount) {
  // Правильный селектор для _transferTokens(address,address,uint256)
  // keccak256("_transferTokens(address,address,uint256)")[:4]
  const functionSignature = '_transferTokens(address,address,uint256)';
  const selectorBytes = ethers.keccak256(ethers.toUtf8Bytes(functionSignature));
  const selector = '0x' + selectorBytes.slice(2, 10);

  // Кодирование параметров
  const iface = new ethers.Interface([`function ${functionSignature}`]);
  const encodedCall = iface.encodeFunctionData('_transferTokens', [sender, recipient, amount]);

  return encodedCall;
}

// Отправка формы
async function submitForm() {
  try {
    isSubmitting.value = true;
    proposalResult.value = null;

    // Валидация
    if (!isValidAddress(formData.value.sender)) {
      throw new Error('Некорректный адрес отправителя');
    }

    // Проверяем, что адрес отправителя совпадает с адресом пользователя
    if (formData.value.sender !== currentUserAddress.value) {
      throw new Error('Адрес отправителя должен совпадать с вашим подключенным кошельком');
    }

    if (!isValidAddress(formData.value.recipient)) {
      throw new Error('Некорректный адрес получателя');
    }

    if (!formData.value.amount || formData.value.amount <= 0) {
      throw new Error('Некорректное количество токенов');
    }

    if (!formData.value.description.trim()) {
      throw new Error('Описание предложения обязательно');
    }

    if (!formData.value.votingDuration) {
      throw new Error('Выберите время голосования');
    }

    // Создание encoded call data для передачи токенов
    const transferCallData = encodeTransferTokensCall(
      formData.value.sender,
      formData.value.recipient,
      formData.value.amount
    );

    // Получаем все поддерживаемые цепочки из DLE информации
    const allChains = dleInfo.value?.deployedNetworks
      ? dleInfo.value.deployedNetworks.map(net => net.chainId)
      : [];

    console.log('Creating proposals in chains:', allChains);

    // Создаем предложения параллельно во всех цепочках
    const proposalPromises = allChains.map(async (chainId) => {
      try {
        const proposalData = {
          description: formData.value.description,
          duration: parseInt(formData.value.votingDuration),
          operation: transferCallData,
          targetChains: [chainId], // Операция выполняется в той же цепочке
          timelockDelay: 0
        };

        console.log(`Creating proposal in chain ${chainId}:`, proposalData);

        // Получаем адрес контракта для этой цепочки
        const networkInfo = dleInfo.value?.deployedNetworks?.find(net => net.chainId === chainId);
        const contractAddress = networkInfo?.address || dleAddress.value;

        const result = await createProposal(contractAddress, proposalData);

        return {
          chainId,
          success: result.success,
          proposalId: result.proposalId,
          error: result.error,
          contractAddress
        };
      } catch (error) {
        console.error(`Error creating proposal in chain ${chainId}:`, error);
        return {
          chainId,
          success: false,
          error: error.message,
          contractAddress: dleAddress.value
        };
      }
    });

    const results = await Promise.all(proposalPromises);

    // Проверяем результаты
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length > 0) {
      proposalResult.value = {
        success: true,
        message: `Предложения созданы в ${successful.length} из ${allChains.length} цепочек!`,
        results: results,
        successfulChains: successful,
        failedChains: failed
      };

      // Очистка формы только при полном успехе
      if (failed.length === 0) {
        formData.value = {
          sender: '',
          recipient: '',
          amount: null,
          description: '',
          votingDuration: '',
          governanceChain: ''
        };
      }
    } else {
      throw new Error('Не удалось создать предложения ни в одной цепочке');
    }

  } catch (error) {
    console.error('Error creating transfer proposals:', error);
    proposalResult.value = {
      success: false,
      message: error.message || 'Произошла ошибка при создании предложений'
    };
  } finally {
    isSubmitting.value = false;
  }
}

// Навигация
function goBackToProposals() {
  if (dleAddress.value) {
    router.push(`/management/create-proposal?address=${dleAddress.value}`);
  } else {
    router.push('/management/create-proposal');
  }
}

// Инициализация
// Watcher для автоматического обновления адреса отправителя
watch(currentUserAddress, (newAddress) => {
  formData.value.sender = newAddress;
});

onMounted(() => {
  console.log('[TransferTokensFormView] currentUserAddress:', currentUserAddress.value);
  // Автоматически устанавливаем адрес отправителя
  formData.value.sender = currentUserAddress.value;
  console.log('[TransferTokensFormView] formData.sender set to:', formData.value.sender);
  loadDleInfo();
});
</script>

<style scoped>
.transfer-tokens-page {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  margin-bottom: 20px;
}

.transfer-tokens-form {
  margin-top: 2rem;
}

.form-container {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.form-label i {
  margin-right: 0.5rem;
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-help {
  display: block;
  color: #6c757d;
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.balance-info {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #495057;
}

.balance-info i {
  margin-right: 0.5rem;
  color: #17a2b8;
}

.multichain-info {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 6px;
  font-size: 0.85rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.multichain-info i {
  margin-right: 0.5rem;
  color: #fff;
}

.multichain-info strong {
  color: #fff;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #e9ecef;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
  transform: translateY(-1px);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.proposal-result {
  margin-top: 2rem;
}

.alert {
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid transparent;
}

.alert-success {
  background: #d4edda;
  border-color: #c3e6cb;
  color: #155724;
}

.alert-danger {
  background: #f8d7da;
  border-color: #f5c6cb;
  color: #721c24;
}

.alert i {
  margin-right: 0.5rem;
}

.chain-results {
  margin-top: 1.5rem;
}

.chain-results h5 {
  margin-bottom: 1rem;
  color: var(--color-primary);
  font-size: 1rem;
}

.chain-result-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chain-result-item {
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  background: white;
}

.chain-result-item.success {
  border-color: #d4edda;
  background: #f8fff9;
}

.chain-result-item.error {
  border-color: #f5c6cb;
  background: #fff8f8;
}

.chain-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.chain-name {
  font-weight: 600;
  color: var(--color-primary);
}

.chain-status {
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.chain-status i {
  font-size: 0.75rem;
}

.proposal-info {
  color: #6c757d;
  font-size: 0.8rem;
}

.error-info {
  color: #dc3545;
  font-size: 0.8rem;
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
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.auth-notice {
  margin-top: 2rem;
}

/* Адаптивность */
@media (max-width: 768px) {
  .transfer-tokens-page {
    padding: 15px;
  }

  .form-container {
    padding: 1.5rem;
  }

  .form-actions {
    flex-direction: column;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
    justify-content: center;
  }
}
</style>
