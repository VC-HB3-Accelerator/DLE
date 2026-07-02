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
  <div class="deployment-wizard">
    <!-- Заголовок -->
    <div class="wizard-header">
      <h2 class="wizard-title">{{ t('deployment.wizardTitle') }}</h2>
      <p class="wizard-subtitle">
        {{ t('deployment.wizardSubtitle') }}
      </p>
    </div>

    <!-- Прогресс-бар -->
    <div class="progress-section">
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: `${progressPercentage}%` }"
        ></div>
      </div>
      <div class="progress-text">
        {{ currentStage }} ({{ progressPercentage }}%)
      </div>
    </div>

    <!-- Статус деплоя -->
    <div class="status-section">
      <div class="status-card" :class="statusClass">
        <div class="status-icon">
          <i :class="statusIcon"></i>
        </div>
        <div class="status-content">
          <h3 class="status-title">{{ statusTitle }}</h3>
          <p class="status-message">{{ statusMessage }}</p>
        </div>
      </div>
    </div>

    <!-- Логи операций -->
    <div class="logs-section">
      <div class="logs-header">
        <h3>{{ t('deployment.operationLogs') }}</h3>
        <button 
          class="clear-logs-btn" 
          @click="clearLogs"
          :disabled="isDeploying"
        >
          {{ t('deployment.clearLogs') }}
        </button>
      </div>
      <div class="logs-container" ref="logsContainer">
        <div 
          v-for="(log, index) in logs" 
          :key="index"
          :class="['log-entry', `log-${log.type}`]"
        >
          <span class="log-time">{{ log.timestamp }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
        <div v-if="logs.length === 0" class="no-logs">
          {{ t('deployment.noLogs') }}
        </div>
      </div>
    </div>

    <!-- Сетевые статусы -->
    <div v-if="Object.keys(networksStatus).length > 0" class="networks-section">
      <h3>{{ t('deployment.networksStatusTitle') }}</h3>
      <div class="networks-grid">
        <div 
          v-for="(network, chainId) in networksStatus" 
          :key="chainId"
          :class="['network-item', `network-${network.status}`]"
        >
          <div class="network-name">{{ getNetworkName(chainId) }}</div>
          <div class="network-status">{{ network.status }}</div>
          <div v-if="network.address" class="network-address">{{ network.address.substring(0, 10) }}...</div>
          <div v-if="network.message" class="network-message">{{ network.message }}</div>
        </div>
      </div>
    </div>

    <!-- Кнопки управления -->
    <div class="controls-section">
      <button 
        class="stop-btn"
        @click="stopDeploymentTracking"
        v-if="isDeploying"
      >
        <i class="fas fa-stop"></i>
        {{ t('deployment.stopTracking') }}
      </button>
      
      <button 
        class="reset-btn"
        @click="resetDeploymentState"
        v-if="deploymentStatus === 'completed' || deploymentStatus === 'failed'"
      >
        <i class="fas fa-redo"></i>
        {{ t('deployment.resetState') }}
      </button>
    </div>

    <!-- Ошибка -->
    <div v-if="error" class="error-section">
      <div class="error-card">
        <i class="fas fa-exclamation-triangle"></i>
        <div>
          <h4>{{ t('deployment.errorTitle') }}</h4>
          <p>{{ error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDeploymentWebSocket } from '@/composables/useDeploymentWebSocket';
import api from '@/api/axios';

const { t } = useI18n();

// Props
const props = defineProps({
    dleAddress: {
      type: String,
      required: false
    },
    privateKey: {
      type: String,
      required: true
    },
    selectedNetworks: {
      type: Array,
      required: true
    },
    dleData: {
      type: Object,
      required: true
    },
    logoURI: {
      type: String,
      required: false,
      default: '/uploads/logos/default-token.svg'
    },
    etherscanApiKey: {
      type: String,
      required: false,
      default: ''
    },
    autoVerifyAfterDeploy: {
      type: Boolean,
      required: false,
      default: false
    }
});

// Events
const emit = defineEmits(['deployment-completed']);

// WebSocket композабл для деплоя
const {
  deploymentStatus,
  currentStage,
  progress,
  isDeploying,
  logs,
  deploymentResult,
  networksStatus,
  error,
  startDeploymentTracking,
  stopDeploymentTracking,
  resetDeploymentState,
  addLog,
  clearLogs
} = useDeploymentWebSocket();

// Ссылка на контейнер логов
const logsContainer = ref(null);

// Вычисляемые свойства
const progressPercentage = computed(() => {
  return Math.round((progress.value || 0));
});

const statusClass = computed(() => {
  switch (deploymentStatus.value) {
    case 'completed': return 'status-success';
    case 'failed': return 'status-error';
    case 'in_progress': return 'status-running';
    default: return 'status-pending';
  }
});

const statusIcon = computed(() => {
  switch (deploymentStatus.value) {
    case 'completed': return 'fas fa-check-circle';
    case 'failed': return 'fas fa-times-circle';
        case 'in_progress': return 'fas fa-spinner fa-spin';
    default: return 'fas fa-clock';
  }
});

const statusTitle = computed(() => {
  switch (deploymentStatus.value) {
    case 'not_started': return t('deployment.statusReady');
    case 'in_progress': return t('deployment.statusInProgress');
    case 'completed': return t('deployment.statusCompleted');
    case 'failed': return t('deployment.statusFailed');
    default: return t('deployment.statusUnknown');
  }
});

const statusMessage = computed(() => {
  switch (deploymentStatus.value) {
    case 'not_started': return t('deployment.statusMsgReady');
    case 'in_progress': return t('deployment.statusMsgInProgress', {
      stage: currentStage.value || t('deployment.initialization')
    });
    case 'completed': return t('deployment.statusMsgCompleted');
    case 'failed': return t('deployment.statusMsgFailed');
    default: return '';
  }
});

// Функции
const getNetworkName = (chainId) => {
  const networkNames = {
    '1': 'Ethereum',
    '11155111': 'Sepolia',
    '421614': 'Arbitrum Sepolia',
    '84532': 'Base Sepolia', 
    '17000': 'Holesky'
  };
  return networkNames[chainId] || t('deployment.networkFallback', { chainId });
};

const scrollToBottom = () => {
  nextTick(() => {
    if (logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
    }
  });
};

// Главная функция запуска деплоя
const startDeployment = async () => {
  try {
    addLog(t('deployment.logStartAsync'), 'info');
    
    // Генерируем deploymentId заранее, чтобы WebSocket сообщения не игнорировались
    const tempDeploymentId = `deploy_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    addLog(t('deployment.logTempId', { id: tempDeploymentId }), 'info');
    
    // Начинаем отслеживание сразу с временным ID
    startDeploymentTracking(tempDeploymentId);
    
    // Подготовка данных для деплоя
          const deployData = {
      deploymentId: tempDeploymentId, // Передаем временный ID в backend
      name: props.dleData.name,
      symbol: props.dleData.tokenSymbol,
      location: props.dleData.addressData?.fullAddress || t('common.notSpecified'),
      coordinates: props.dleData.coordinates || '0,0',
      jurisdiction: parseInt(props.dleData.jurisdiction) || 0,
      oktmo: props.dleData.selectedOktmo || '',
      okvedCodes: props.dleData.selectedOkved || [],
      kpp: props.dleData.kppCode || '',
      quorumPercentage: props.dleData.governanceQuorum !== undefined ? props.dleData.governanceQuorum : 51,
      initialPartners: props.dleData.partners.map(p => p.address).filter(addr => addr),
      initialAmounts: props.dleData.partners.map(p => p.amount).filter(amount => amount > 0),
      supportedChainIds: props.selectedNetworks.filter(id => id !== null && id !== undefined),
      currentChainId: props.selectedNetworks[0] || 1,
      logoURI: props.logoURI || '/uploads/logos/default-token.svg',
      privateKey: props.privateKey,
      etherscanApiKey: props.etherscanApiKey || '',
            autoVerifyAfterDeploy: props.autoVerifyAfterDeploy !== undefined ? props.autoVerifyAfterDeploy : false
          };
          
    addLog(t('deployment.logSendingRequest'), 'info');
    
    // Отправляем запрос на асинхронный деплой (без таймаута!)
          const response = await api.post('/dle-v2', deployData);
          
    if (response.data.success && response.data.deploymentId) {
      addLog(t('deployment.logDeployStarted', { id: response.data.deploymentId }), 'success');
      
      // Обновляем deploymentId на реальный от сервера
      if (response.data.deploymentId !== tempDeploymentId) {
        addLog(t('deployment.logUpdatingId', { oldId: tempDeploymentId, newId: response.data.deploymentId }), 'info');
        startDeploymentTracking(response.data.deploymentId);
      }
      
    } else {
      throw new Error(t('deployment.logStartFailed', {
        message: response.data.message || t('deployment.unknownError')
      }));
    }
    
  } catch (err) {
    addLog(t('deployment.logStartError', { message: err.message }), 'error');
  }
};

// Автозапуск деплоя при появлении компонента
onMounted(() => {
  addLog(t('deployment.logComponentMounted'), 'info');
  
  if (deploymentStatus.value === 'not_started') {
    addLog(t('deployment.logAutoStart'), 'info');
    startDeployment();
  }
});

// Следим за новыми логами и скроллим вниз
watch(logs, () => {
  scrollToBottom();
}, { deep: true });

// Следим за завершением деплоя
watch(deploymentStatus, (newStatus) => {
  if (newStatus === 'completed' && deploymentResult.value) {
    addLog(t('deployment.logDeployCompletedRedirect'), 'success');
    setTimeout(() => {
      emit('deployment-completed', deploymentResult.value);
    }, 2000);
  }
});
</script>

<style scoped>
.deployment-wizard {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.wizard-header {
  text-align: center;
  margin-bottom: 30px;
}

.wizard-title {
  color: #2c3e50;
  margin-bottom: 10px;
  font-size: 2em;
}

.wizard-subtitle {
  color: #7f8c8d;
  font-size: 1.1em;
}

.progress-section {
  margin-bottom: 30px;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background-color: #ecf0f1;
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #2ecc71);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  margin-top: 10px;
  font-weight: 500;
}

.status-section {
  margin-bottom: 30px;
}

.status-card {
  display: flex;
  align-items: center;
  padding: 20px;
  border-radius: 10px;
  border: 2px solid #bdc3c7;
}

.status-card.status-pending {
  border-color: #f39c12;
  background-color: #fef9e7;
}

.status-card.status-running {
  border-color: #3498db;
  background-color: #ebf3fd;
}

.status-card.status-success {
  border-color: #2ecc71;
  background-color: #eafaf1;
}

.status-card.status-error {
  border-color: #e74c3c;
  background-color: #fdf2f2;
}

.status-icon {
  font-size: 2em;
  margin-right: 20px;
}

.status-content h3 {
  margin: 0 0 10px 0;
}

.status-content p {
  margin: 0;
  color: #7f8c8d;
}

.logs-section {
  margin-bottom: 30px;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.clear-logs-btn {
  background: #95a5a6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 5px;
  cursor: pointer;
}

.clear-logs-btn:hover:not(:disabled) {
  background: #7f8c8d;
}

.logs-container {
  height: 300px;
  overflow-y: auto;
  border: 1px solid #bdc3c7;
  border-radius: 5px;
  padding: 10px;
  background: #f8f9fa;
}

.log-entry {
  margin-bottom: 8px;
  display: flex;
  gap: 10px;
}

.log-time {
  color: #95a5a6;
  font-size: 0.9em;
  min-width: 80px;
}

.log-message {
  flex: 1;
}

.log-info { color: #3498db; }
.log-success { color: #2ecc71; }
.log-error { color: #e74c3c; }
.log-warning { color: #f39c12; }

.no-logs {
  text-align: center;
  color: #95a5a6;
  font-style: italic;
  padding: 20px;
}

.networks-section {
  margin-bottom: 30px;
}

.networks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.network-item {
  padding: 15px;
  border-radius: 8px;
  border: 2px solid #bdc3c7;
}

.network-item.network-pending {
  border-color: #f39c12;
  background-color: #fef9e7;
}

.network-item.network-in_progress {
  border-color: #3498db;
  background-color: #ebf3fd;
}

.network-item.network-completed {
  border-color: #2ecc71;
  background-color: #eafaf1;
}

.network-item.network-failed {
  border-color: #e74c3c;
  background-color: #fdf2f2;
}

.network-name {
  font-weight: bold;
  margin-bottom: 5px;
}

.network-status {
  font-size: 0.9em;
  color: #7f8c8d;
}

.network-address {
  font-family: monospace;
  font-size: 0.8em;
  margin-top: 5px;
}

.network-message {
  font-size: 0.8em;
  color: #7f8c8d;
  margin-top: 5px;
}

.controls-section {
  text-align: center;
  margin-bottom: 30px;
}

.start-btn, .stop-btn, .reset-btn {
  padding: 15px 30px;
  font-size: 1.1em;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s;
  margin: 0 10px;
}

.start-btn {
  background: linear-gradient(135deg, #2ecc71, #27ae60);
  color: white;
}

.start-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #27ae60, #219a52);
}

.start-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.stop-btn {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: white;
}

.stop-btn:hover {
  background: linear-gradient(135deg, #c0392b, #a93226);
}

.reset-btn {
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
}

.reset-btn:hover {
  background: linear-gradient(135deg, #2980b9, #21618c);
}

.error-section {
  margin-top: 20px;
}

.error-card {
  display: flex;
  align-items: center;
  padding: 20px;
  background-color: #fdf2f2;
  border: 2px solid #e74c3c;
  border-radius: 8px;
}

.error-card i {
  color: #e74c3c;
  font-size: 1.5em;
  margin-right: 15px;
}

.error-card h4 {
  margin: 0 0 5px 0;
  color: #e74c3c;
}

.error-card p {
  margin: 0;
  color: #7f8c8d;
}
</style>
