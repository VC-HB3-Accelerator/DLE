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
    <div class="create-proposal-page page-with-close">
      <PageCloseButton :on-navigate="goBackToBlocks" />
      <div class="page-address-bar">
        <div v-if="selectedDle?.dleAddress" class="page-address-bar__value">
          {{ selectedDle.dleAddress }}
        </div>
        <div v-else-if="dleAddress" class="page-address-bar__value">
          {{ dleAddress }}
        </div>
        <div v-else-if="isLoadingDle" class="page-address-bar__value">
          {{ t('common.loading') }}
        </div>
      </div>
      <div v-if="dleAddress" class="voting-chain-hub">
        <VotingChainSelect
          v-model="votingChain"
          :chains="votingChains"
          :is-loading="isLoadingVotingChains"
        />
        <p class="voting-chain-hub__note">{{ t('smartcontracts.createProposal.votingChainHubHint') }}</p>
      </div>
      <div v-if="!canGovern" class="auth-notice">
        <div class="alert alert-info">
          <UiGlyph name="info" />
          <div class="alert-body">
            <strong>{{ t('smartcontracts.createProposal.tokenHolderRequiredTitle') }}</strong>
            <p>{{ t('smartcontracts.createProposal.tokenHolderRequiredHint') }}</p>
          </div>
        </div>
      </div>

      <div v-if="showDelegationPrompt" class="delegation-notice">
        <div class="alert alert-warning">
          <strong>{{ t('smartcontracts.proposals.delegationNoticeTitle') }}</strong>
          <p class="delegation-notice-text">{{ t('smartcontracts.proposals.delegationNoticeMessage') }}</p>
          <button
            type="button"
            class="create-btn delegation-btn"
            :disabled="isDelegating || !hasVotingChain"
            @click="handleDelegate"
          >
            {{ isDelegating ? t('smartcontracts.proposals.delegating') : t('smartcontracts.proposals.delegateButton') }}
          </button>
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
                <button class="create-btn" @click="openTransferForm" :disabled="!canGovern || !hasVotingChain">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.updateDleInfo.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.updateDleInfo.description') }}</p>
                <button class="create-btn" @click="openUpdateDLEInfoForm" :disabled="!canGovern || !hasVotingChain">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.updateQuorum.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.updateQuorum.description') }}</p>
                <button class="create-btn" @click="openUpdateQuorumForm" :disabled="!canGovern || !hasVotingChain">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.updateVotingDurations.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.updateVotingDurations.description') }}</p>
                <button class="create-btn" @click="openUpdateVotingDurationsForm" :disabled="!canGovern || !hasVotingChain">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.offchainAction.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.offchainAction.description') }}</p>
                <button class="create-btn" @click="openOffchainActionForm" :disabled="!canGovern || !hasVotingChain">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.addModule.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.addModule.description') }}</p>
                <button class="create-btn" @click="openAddModuleForm" :disabled="!canGovern || !hasVotingChain">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.removeModule.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.removeModule.description') }}</p>
                <button class="create-btn" @click="openRemoveModuleForm" :disabled="!canGovern || !hasVotingChain">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.setLogoUri.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.setLogoUri.description') }}</p>
                <button class="create-btn" @click="openSetLogoURIForm" :disabled="!canGovern || !hasVotingChain">
                  {{ t('common.create') }}
                </button>
              </div>
              <div class="operation-block">
                <h6>{{ t('smartcontracts.createProposal.operations.setActive.title') }}</h6>
                <p>{{ t('smartcontracts.createProposal.operations.setActive.description') }}</p>
                <button class="create-btn" @click="openSetActiveForm" :disabled="!canGovern || !hasVotingChain">
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
            <h5>{{ getModuleIcon(moduleOperation.moduleType) }} {{ moduleHeading(moduleOperation) }}</h5>
            <p class="module-description">{{ moduleBlurb(moduleOperation) }}</p>
            <div class="operation-blocks">
              <div 
                v-for="operation in moduleOperation.operations" 
                :key="operation.id"
                class="operation-block module-operation-block"
              >
                <h6>{{ operationTitle(moduleOperation.moduleType, operation) }}</h6>
                <p>{{ operationBlurb(moduleOperation.moduleType, operation) }}</p>
                <button 
                  class="create-btn" 
                  @click="openModuleOperationForm(moduleOperation.moduleType, operation)" 
                  :disabled="!canGovern || !hasVotingChain || isLoadingModuleOperations"
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
import { ref, computed, onMounted, onUnmounted, watch, defineProps, defineEmits } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthContext } from '../../composables/useAuth';
import { usePermissions } from '../../composables/usePermissions';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import UiGlyph from '../../components/UiGlyph.vue';
import { getDLEInfo } from '../../services/dleV2Service.js';
import { createProposal as createProposalAPI } from '../../services/proposalsService.js';
import { getModuleOperations } from '../../services/moduleOperationsService.js';
import { translateIfExists, localeSafeFallback } from '../../utils/helpers.js';
import { isModuleBridgeOp, isTreasuryFundsBridgeOp } from '../../utils/dle-contract.js';
import VotingChainSelect from '@/components/VotingChainSelect.vue';
import { useVotingChains } from '@/composables/useVotingChains.js';
import api from '../../api/axios';
import wsClient from '../../utils/websocket.js';
import { ethers } from 'ethers';
import { getDelegationStatus, delegateVotingPowerToSelf } from '../../utils/dle-contract.js';

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

const { t, locale, messages } = useI18n();

function msgTree() {
  return messages.value?.[locale.value] || messages.value?.en;
}

function moduleI18nKey(moduleType, suffix) {
  return `smartcontracts.createProposal.modules.${moduleType}.${suffix}`;
}

function moduleHeading(mod) {
  return translateIfExists(
    t,
    moduleI18nKey(mod.moduleType, 'title'),
    undefined,
    localeSafeFallback(locale.value, mod.moduleName),
    msgTree()
  );
}

function moduleBlurb(mod) {
  return translateIfExists(
    t,
    moduleI18nKey(mod.moduleType, 'description'),
    undefined,
    localeSafeFallback(locale.value, mod.moduleDescription),
    msgTree()
  );
}

function operationTitle(moduleType, operation) {
  return translateIfExists(
    t,
    moduleI18nKey(moduleType, `ops.${operation.id}.title`),
    undefined,
    localeSafeFallback(locale.value, operation.name),
    msgTree()
  );
}

function operationBlurb(moduleType, operation) {
  return translateIfExists(
    t,
    moduleI18nKey(moduleType, `ops.${operation.id}.description`),
    undefined,
    localeSafeFallback(locale.value, operation.description),
    msgTree()
  );
}
const { address, isAuthenticated, checkTokenBalances, checkAuth } = useAuthContext();
const { canGovern } = usePermissions();
const router = useRouter();
const route = useRoute();

const needsDelegation = ref(false);
const isDelegating = ref(false);
const connectedWallet = ref(null);

const showDelegationPrompt = computed(() => Boolean(connectedWallet.value && needsDelegation.value));

const dleAddress = computed(() => {
  return route.query.address || props.dleAddress;
});

const {
  chains: votingChains,
  votingChain,
  isLoading: isLoadingVotingChains,
  hasVotingChain,
  hubQuery,
} = useVotingChains(dleAddress);

const refreshDelegationStatus = async () => {
  if (!dleAddress.value) {
    needsDelegation.value = false;
    connectedWallet.value = null;
    return;
  }
  try {
    let wallet = address.value;
    if (!wallet && window.ethereum) {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      wallet = accounts?.[0] || null;
    }
    connectedWallet.value = wallet;
    if (!wallet) {
      needsDelegation.value = false;
      return;
    }
    const status = await getDelegationStatus(dleAddress.value, wallet);
    needsDelegation.value = status.needsDelegation;
  } catch (err) {
    console.warn('[CreateProposal] delegation check failed:', err?.message || err);
    needsDelegation.value = false;
  }
};

const handleDelegate = async () => {
  if (!dleAddress.value) return;
  if (!hasVotingChain.value) {
    window.alert(t('smartcontracts.createProposal.votingChainRequired'));
    return;
  }
  isDelegating.value = true;
  try {
    const chainId = Number(votingChain.value);
    const result = await delegateVotingPowerToSelf(dleAddress.value, chainId);
    await refreshDelegationStatus();
    if (result.alreadyDelegated) {
      window.alert(t('smartcontracts.proposals.delegationAlreadyDone'));
    } else {
      window.alert(t('smartcontracts.proposals.delegationSuccess', { hash: result.txHash }));
    }
  } catch (err) {
    console.error('[CreateProposal] delegate failed:', err);
    window.alert(t('smartcontracts.proposals.delegationFailed', { message: err?.message || String(err) }));
  } finally {
    isDelegating.value = false;
  }
};

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  checkAuth().catch(() => {}).then(() => refreshDelegationStatus());

  window.addEventListener('clear-application-data', () => {
    dleInfo.value = null;
  });
  
  window.addEventListener('refresh-application-data', () => {
    loadDleData();
  });
});

watch([address, dleAddress, isAuthenticated], () => {
  refreshDelegationStatus();
});

if (typeof window !== 'undefined' && window.ethereum?.on) {
  window.ethereum.on('accountsChanged', refreshDelegationStatus);
  window.ethereum.on('chainChanged', refreshDelegationStatus);
}

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

function openProposalForm(path, extra = {}) {
  router.push({ path, query: hubQuery(extra) });
}

function openTransferForm() {
  openProposalForm('/management/transfer-tokens');
}

function openAddModuleForm() {
  openProposalForm('/management/add-module');
}

function openRemoveModuleForm() {
  openProposalForm('/management/remove-module');
}

function openUpdateDLEInfoForm() {
  openDleCoreOp('updateDleInfo');
}

function openUpdateQuorumForm() {
  openDleCoreOp('updateQuorum');
}

function openUpdateVotingDurationsForm() {
  openDleCoreOp('updateVotingDurations');
}

function openSetLogoURIForm() {
  openDleCoreOp('setLogoUri');
}

function openSetActiveForm() {
  openDleCoreOp('setActive');
}

function openOffchainActionForm() {
  openDleCoreOp('offchainAction');
}

function openDleCoreOp(op) {
  if (!dleAddress.value) {
    alert(t('smartcontracts.createProposal.comingSoon.moduleOperation', {
      name: op,
      moduleType: 'dle',
      description: '',
      functionName: op,
      category: 'core',
    }));
    return;
  }
  router.push({
    path: '/management/dle-core-op',
    query: hubQuery({ op }),
  });
}

function openModuleOperationForm(moduleType, operation) {
  const formModuleType = operation.formModuleType || moduleType;
  const functionName = operation.functionName;
  if (isTreasuryFundsBridgeOp(formModuleType, functionName) && dleAddress.value) {
    router.push({
      path: '/management/treasury-bridge-op',
      query: hubQuery({
        moduleType: formModuleType,
        op: functionName,
        ...(operation.prefill && typeof operation.prefill === 'object' ? operation.prefill : {}),
      }),
    });
    return;
  }
  if (isModuleBridgeOp(formModuleType, functionName) && dleAddress.value) {
    router.push({
      path: '/management/module-bridge-op',
      query: hubQuery({
        moduleType: formModuleType,
        op: functionName,
      }),
    });
    return;
  }
  alert(t('smartcontracts.createProposal.comingSoon.moduleOperation', {
    name: operationTitle(moduleType, operation),
    moduleType,
    description: operationBlurb(moduleType, operation),
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
      const raw = response.data.moduleOperations || [];
      // Только ops с живой формой/encode (без alert comingSoon).
      moduleOperations.value = raw
        .map((mod) => ({
          ...mod,
          operations: (mod.operations || []).filter((op) => {
            const mt = op.formModuleType || mod.moduleType;
            const fn = op.functionName;
            return isTreasuryFundsBridgeOp(mt, fn) || isModuleBridgeOp(mt, fn);
          }),
        }))
        .filter((mod) => (mod.operations || []).length > 0);
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
  padding: var(--spacing-lg);
  background: transparent;
  border-radius: var(--radius-lg);
  box-shadow: none;
  margin-top: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.voting-chain-hub {
  max-width: 520px;
  margin: 0 0 1.5rem;
}

.voting-chain-hub__note {
  margin: -8px 0 0;
  font-size: 0.85rem;
  color: var(--color-grey-dark, #555);
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

.alert :deep(.ui-glyph) {
  margin-top: 0.15rem;
  flex-shrink: 0;
}

.alert-body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.alert-body p {
  margin: 0;
}

.operations-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  min-width: 0;
  max-width: 100%;
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

.operation-block {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
  transition: box-shadow 0.3s ease, transform 0.3s ease, border-color 0.3s ease;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 200px;
  height: auto;
  overflow: visible;
}

@media (hover: hover) {
  .operation-block:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
    border-color: var(--color-primary);
  }
}

.operation-block h6 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.5rem;
  font-weight: 600;
  flex-shrink: 0;
}

.operation-block p {
  margin: 0;
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
  transition: background 0.2s, transform 0.2s;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  flex-shrink: 0;
  margin-top: auto;
  align-self: stretch;
}

@media (hover: hover) {
  .create-btn:hover:not(:disabled) {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
  }
}

.create-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

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
</style>
