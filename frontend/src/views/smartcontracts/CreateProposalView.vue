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
    <div class="create-proposal-page">
      <!-- Информация для неавторизованных пользователей -->
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div v-if="selectedDle?.dleAddress" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ selectedDle.dleAddress }}
        </div>
        <div v-else-if="dleAddress" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ dleAddress }}
        </div>
        <div v-else-if="isLoadingDle" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ t('common.loading') }}
        </div>
        <button class="close-btn" @click="goBackToBlocks">×</button>
      </div>
      <div v-if="!props.isAuthenticated" class="auth-notice">
        <div class="alert alert-info">
          <i class="fas fa-info-circle"></i>
          <strong>{{ t('smartcontracts.createProposal.authRequiredTitle') }}</strong>
          <p class="mb-0 mt-2">{{ t('smartcontracts.createProposal.authRequiredHint') }}</p>
        </div>
      </div>
      
      <!-- Блоки операций -->
      <div class="operations-grid">
          <!-- Основные операции DLE -->
          <div class="operation-category">
            <div class="operation-blocks">
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.transferTokens.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.transferTokens.description') }}</p>
                <button class="create-btn" @click="openTransferForm" :disabled="!props.isAuthenticated">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.updateDleInfo.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.updateDleInfo.description') }}</p>
                <button class="create-btn" @click="openUpdateDLEInfoForm" :disabled="!props.isAuthenticated">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.updateQuorum.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.updateQuorum.description') }}</p>
                <button class="create-btn" @click="openUpdateQuorumForm" :disabled="!props.isAuthenticated">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.updateVotingDurations.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.updateVotingDurations.description') }}</p>
                <button class="create-btn" @click="openUpdateVotingDurationsForm" :disabled="!props.isAuthenticated">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.offchainAction.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.offchainAction.description') }}</p>
                <button class="create-btn" @click="openOffchainActionForm" :disabled="!props.isAuthenticated">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.addModule.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.addModule.description') }}</p>
                <button class="create-btn" @click="openAddModuleForm" :disabled="!props.isAuthenticated">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.removeModule.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.removeModule.description') }}</p>
                <button class="create-btn" @click="openRemoveModuleForm" :disabled="!props.isAuthenticated">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.addChain.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.addChain.description') }}</p>
                <button class="create-btn" @click="openAddChainForm" :disabled="!props.isAuthenticated">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.removeChain.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.removeChain.description') }}</p>
                <button class="create-btn" @click="openRemoveChainForm" :disabled="!props.isAuthenticated">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.setLogoUri.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.setLogoUri.description') }}</p>
                <button class="create-btn" @click="openSetLogoURIForm" :disabled="!props.isAuthenticated">
                  {{ t('common.create') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Операции модулей (динамические) -->
          <div v-if="isLoadingModuleOperations" class="loading-modules">
            {{ t('smartcontracts.createProposal.loadingModules') }}
          </div>
          
          <div 
            v-for="moduleOperation in moduleOperations" 
            :key="moduleOperation.moduleType"
            class="operation-category"
          >
            <h5>{{ getModuleIcon(moduleOperation.moduleType) }} {{ moduleOperation.moduleName }}</h5>
            <p class="module-description">{{ moduleOperation.moduleDescription }}</p>
            <div class="operation-blocks">
              <div 
                v-for="operation in moduleOperation.operations" 
                :key="operation.id"
                class="operation-block module-operation-block"
              >
                <h6>{{ operation.name }}</h6>
                <p>{{ operation.description }}</p>
                <button 
                  class="create-btn" 
                  @click="openModuleOperationForm(moduleOperation.moduleType, operation)" 
                  :disabled="!props.isAuthenticated || isLoadingModuleOperations"
                >
                  <span v-if="isLoadingModuleOperations">{{ t('common.loading') }}</span>
                  <span v-else>{{ t('common.create') }}</span>
                </button>
              </div>
            </div>
          </div>

      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, defineProps, defineEmits } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthContext } from '../../composables/useAuth';
import BaseLayout from '../../components/BaseLayout.vue';
import { getDLEInfo } from '../../services/dleV2Service.js';
import { createProposal as createProposalAPI } from '../../services/proposalsService.js';
import { getModuleOperations } from '../../services/moduleOperationsService.js';
import api from '../../api/axios';
import wsClient from '../../utils/websocket.js';
import { ethers } from 'ethers';

const showTargetChains = computed(() => {
  // Для offchain-действий не требуется ончейн исполнение (здесь типы пока ончейн)
  // Можно расширить логику при появлении offchain типа
  return true;
});

const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

const emit = defineEmits(['auth-action-completed']);

const { t } = useI18n();
const { address, isAuthenticated, checkTokenBalances } = useAuthContext();
const router = useRouter();
const route = useRoute();

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', () => {
    dleInfo.value = null;
  });
  
  window.addEventListener('refresh-application-data', () => {
    loadDleData();
  });
});

const dleAddress = computed(() => {
  return route.query.address || props.dleAddress;
});

// Функция возврата к блокам управления
const goBackToBlocks = () => {
  if (dleAddress.value) {
    router.push(`/management/dle-blocks?address=${dleAddress.value}`);
  } else {
    router.push('/management');
  }
};

// Состояние DLE
const selectedDle = ref(null);
const isLoadingDle = ref(false);

// Доступные цепочки (загружаются из конфигурации)
const availableChains = ref([]);

// Состояние модулей и их операций
const moduleOperations = ref([]);
const isLoadingModuleOperations = ref(false);
const isModulesWSConnected = ref(false);

// Функции для открытия отдельных форм операций
function openTransferForm() {
  if (dleAddress.value) {
    router.push(`/management/transfer-tokens?address=${dleAddress.value}`);
  } else {
    router.push('/management/transfer-tokens');
  }
}

function openAddModuleForm() {
  if (dleAddress.value) {
    router.push(`/management/add-module?address=${dleAddress.value}`);
  } else {
    router.push('/management/add-module');
  }
}

function openRemoveModuleForm() {
  alert(t('smartcontracts.createProposal.comingSoon.removeModule'));
}

function openAddChainForm() {
  alert(t('smartcontracts.createProposal.comingSoon.addChain'));
}

function openRemoveChainForm() {
  alert(t('smartcontracts.createProposal.comingSoon.removeChain'));
}


function openUpdateDLEInfoForm() {
  alert(t('smartcontracts.createProposal.comingSoon.updateDleInfo'));
}

function openUpdateQuorumForm() {
  alert(t('smartcontracts.createProposal.comingSoon.updateQuorum'));
}

function openUpdateVotingDurationsForm() {
  alert(t('smartcontracts.createProposal.comingSoon.updateVotingDurations'));
}

function openSetLogoURIForm() {
  alert(t('smartcontracts.createProposal.comingSoon.setLogoUri'));
}

function openOffchainActionForm() {
  alert(t('smartcontracts.createProposal.comingSoon.offchainAction'));
}

function openModuleOperationForm(moduleType, operation) {
  alert(t('smartcontracts.createProposal.comingSoon.moduleOperation', {
    name: operation.name,
    moduleType,
    description: operation.description,
    functionName: operation.functionName,
    category: operation.category
  }));
}

// Получить иконку для типа модуля
function getModuleIcon(moduleType) {
  return '';
}

// Функции
async function loadDleData() {
  if (!dleAddress.value) {
    return;
  }

  isLoadingDle.value = true;
  try {
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      selectedDle.value = response.data.data;
    } else {
      console.error('Ошибка загрузки DLE:', response.data.error);
    }
    
    if (selectedDle.value?.deployedNetworks) {
      availableChains.value = selectedDle.value.deployedNetworks.map(net => ({
        chainId: net.chainId,
        name: getChainName(net.chainId)
      }));
    } else {
      availableChains.value = [];
    }

    await loadModuleOperations();
    resubscribeToModules();

  } catch (error) {
    console.error('Ошибка загрузки данных DLE из блокчейна:', error);
  } finally {
    isLoadingDle.value = false;
  }
}

async function loadModuleOperations() {
  if (!dleAddress.value) {
    return;
  }

  isLoadingModuleOperations.value = true;
  try {
    const response = await getModuleOperations(dleAddress.value);
    
    if (response.success) {
      moduleOperations.value = response.data.moduleOperations || [];
    } else {
      console.error('[CreateProposalView] Ошибка загрузки операций модулей:', response.error);
      moduleOperations.value = [];
    }
  } catch (error) {
    console.error('[CreateProposalView] Ошибка загрузки операций модулей:', error);
    moduleOperations.value = [];
  } finally {
    isLoadingModuleOperations.value = false;
  }
}

// WebSocket функции для модулей
function connectModulesWebSocket() {
  if (isModulesWSConnected.value) {
    return;
  }

  try {
    // Подключаемся через существующий WebSocket клиент
    wsClient.connect();
    
    // Подписываемся на события deployment_update
    wsClient.on('deployment_update', (data) => {
      handleModulesWebSocketMessage(data);
    });

    wsClient.on('subscribed', () => {});

    wsClient.on('modules_updated', () => {
      loadModuleOperations();
    });

    wsClient.on('deployment_status', (data) => {
      handleModulesWebSocketMessage(data);
    });

    wsClient.on('connected', () => {
      if (dleAddress.value) {
        wsClient.ws.send(JSON.stringify({
          type: 'subscribe',
          dleAddress: dleAddress.value
        }));
      }
    });

    isModulesWSConnected.value = true;
  } catch (error) {
    console.error('[CreateProposalView] Ошибка подключения WebSocket модулей:', error);
    isModulesWSConnected.value = false;
    
    // Переподключаемся через 5 секунд
    setTimeout(() => {
      connectModulesWebSocket();
    }, 5000);
  }
}

function handleModulesWebSocketMessage(data) {
  switch (data.type) {
    case 'modules_updated':
      loadModuleOperations();
      break;
      
    case 'module_verified':
      loadModuleOperations();
      break;
      
    case 'module_status_changed':
      loadModuleOperations();
      break;
  }
}

function disconnectModulesWebSocket() {
  if (isModulesWSConnected.value) {
    wsClient.off('deployment_update');
    wsClient.off('subscribed');
    wsClient.off('modules_updated');
    wsClient.off('deployment_status');
    wsClient.off('connected');
    
    isModulesWSConnected.value = false;
  }
}

function resubscribeToModules() {
  if (isModulesWSConnected.value && wsClient.ws && wsClient.ws.readyState === WebSocket.OPEN && dleAddress.value) {
    wsClient.ws.send(JSON.stringify({
      type: 'subscribe',
      dleAddress: dleAddress.value
    }));
  }
}

onMounted(async () => {
  if (isAuthenticated.value && address.value) {
    await checkTokenBalances(address.value);
  }
  
  if (dleAddress.value) {
    loadDleData();
  }
  
  connectModulesWebSocket();
});

// Отключаем WebSocket при размонтировании компонента
onUnmounted(() => {
  disconnectModulesWebSocket();
});

// Функция для получения названия сети по chainId
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
  return chainNames[chainId] || t('common.chainFallback', { chainId });
}
</script>

<style scoped>
.create-proposal-page {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  margin-bottom: 20px;
}

/* Заголовок */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 1px solid #f0f0f0;
}

.header-content {
  flex-grow: 1;
}

.page-header h1 {
  color: var(--color-primary);
  font-size: 2rem;
  margin: 0 0 5px 0;
}

.page-header p {
  color: var(--color-grey-dark);
  font-size: 1rem;
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


.auth-notice {
  margin-bottom: 2rem;
}

.alert {
  padding: 1rem 1.5rem;
  border-radius: 8px;
  border: 1px solid transparent;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.alert-info {
  background-color: #d1ecf1;
  border-color: #bee5eb;
  color: #0c5460;
}

.alert i {
  margin-top: 0.25rem;
  flex-shrink: 0;
}

.operations-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.operation-category {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.operation-category h5 {
  color: var(--color-primary);
  margin: 0 0 1.5rem 0;
  font-size: 1.5rem;
  font-weight: 700;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #f0f0f0;
  text-align: center;
}

.operation-blocks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.operation-block {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 200px;
}

.operation-block:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  border-color: var(--color-primary);
}


.operation-block h6 {
  margin: 0 0 1rem 0;
  color: var(--color-primary);
  font-size: 1.5rem;
  font-weight: 600;
  flex-shrink: 0;
}

.operation-block p {
  margin: 0 0 1.5rem 0;
  color: #666;
  font-size: 1rem;
  line-height: 1.5;
  flex-grow: 1;
}

.create-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.2s;
  min-width: 120px;
  width: 100%;
  flex-shrink: 0;
  margin-top: auto;
}

.create-btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}
.create-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Стили для модулей */
.module-description {
  color: #666;
  font-size: 0.9rem;
  margin: 0.5rem 0 1rem 0;
  font-style: italic;
}

.module-operation-block {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 200px;
}



/* Индикатор загрузки модулей */
.loading-modules {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #666;
  font-style: italic;
}

.loading-modules::before {
  content: '';
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Адаптивность */
@media (max-width: 768px) {
  .operation-blocks {
    grid-template-columns: 1fr;
  }
  
  .operation-block {
    padding: 1rem;
  }
  
  .operation-category h5 {
    font-size: 1.1rem;
  }
}
</style>
