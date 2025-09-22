/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

import { ref, reactive, onUnmounted } from 'vue';
import wsClient from '../utils/websocket';

export function useDeploymentWebSocket() {
  // Состояние деплоя
  const deploymentStatus = ref('not_started'); // not_started, in_progress, completed, failed
  const currentStage = ref('');
  const currentNetwork = ref('');
  const progress = ref(0);
  const isDeploying = ref(false);
  const deploymentId = ref(null);
  const logs = ref([]);
  const error = ref(null);
  
  // Детальная информация по сетям
  const networksStatus = reactive({});
  
  // Результат деплоя
  const deploymentResult = ref(null);
  
  // Добавить лог
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    logs.value.push({
      timestamp,
      message,
      type
    });
  };
  
  // Очистить логи
  const clearLogs = () => {
    logs.value = [];
  };
  
  // Обработчик WebSocket сообщений
  const handleDeploymentUpdate = (data) => {
    if (data.deploymentId !== deploymentId.value) return;
    
    console.log('🔄 [DeploymentWebSocket] Получено обновление:', data);
    
    switch (data.type) {
      case 'deployment_started':
        deploymentStatus.value = 'in_progress';
        isDeploying.value = true;
        currentStage.value = data.stage || '';
        addLog(`🚀 ${data.message}`, 'info');
        break;
        
      case 'deployment_progress':
        currentStage.value = data.stage || '';
        currentNetwork.value = data.network || '';
        progress.value = data.progress || 0;
        if (data.message) {
          addLog(`📊 ${data.message}`, 'info');
        }
        break;
        
      case 'deployment_stage_completed':
        if (data.message) {
          addLog(`✅ ${data.message}`, 'success');
        }
        break;
        
      case 'deployment_network_update':
        if (data.network) {
          networksStatus[data.network] = {
            status: data.status,
            address: data.address,
            message: data.message
          };
        }
        if (data.message) {
          addLog(`🌐 [${data.network}] ${data.message}`, 'info');
        }
        break;
        
      case 'deployment_error':
        error.value = data.error;
        if (data.message) {
          addLog(`❌ ${data.message}`, 'error');
        }
        break;
        
      case 'deployment_completed':
        deploymentStatus.value = 'completed';
        isDeploying.value = false;
        deploymentResult.value = data.result;
        progress.value = 100;
        addLog(`🎉 ${data.message}`, 'success');
        break;
        
      case 'deployment_failed':
        deploymentStatus.value = 'failed';
        isDeploying.value = false;
        error.value = data.error;
        addLog(`💥 ${data.message}`, 'error');
        break;
        
      case 'deployment_log':
        if (data.log) {
          addLog(data.log.message, data.log.type || 'info');
        }
        break;
        
      case undefined:
        // Обработка событий без типа (прямые обновления)
        if (data.stage) currentStage.value = data.stage;
        if (data.progress !== undefined) progress.value = data.progress;
        if (data.status) deploymentStatus.value = data.status;
        if (data.result) deploymentResult.value = data.result;
        if (data.error) error.value = data.error;
        if (data.status === 'completed') {
          isDeploying.value = false;
          addLog('🎉 Деплой успешно завершен!', 'success');
        } else if (data.status === 'failed') {
          isDeploying.value = false;
          addLog('💥 Деплой завершился с ошибкой!', 'error');
        }
        break;
        
      default:
        console.warn('🤷‍♂️ [DeploymentWebSocket] Неизвестный тип события:', data.type);
    }
  };
  
  // Начать отслеживание деплоя
  const startDeploymentTracking = (id) => {
    console.log('🎯 [DeploymentWebSocket] Начинаем отслеживание деплоя:', id);
    
    deploymentId.value = id;
    deploymentStatus.value = 'in_progress';
    isDeploying.value = true;
    clearLogs();
    
    // Подключаемся к WebSocket обновлениям
    wsClient.connect();
    if (wsClient && typeof wsClient.subscribe === 'function') {
      wsClient.subscribe('deployment_update', handleDeploymentUpdate);
    } else {
      console.warn('[DeploymentWebSocket] wsClient.subscribe недоступен');
    }
    
    addLog('🔌 Подключено к WebSocket для получения обновлений деплоя', 'info');
  };
  
  // Остановить отслеживание
  const stopDeploymentTracking = () => {
    console.log('🛑 [DeploymentWebSocket] Останавливаем отслеживание');
    
    if (wsClient && typeof wsClient.unsubscribe === 'function') {
      wsClient.unsubscribe('deployment_update', handleDeploymentUpdate);
    } else {
      console.warn('[DeploymentWebSocket] wsClient.unsubscribe недоступен');
    }
    isDeploying.value = false;
  };
  
  // Очистить состояние
  const resetDeploymentState = () => {
    deploymentStatus.value = 'not_started';
    currentStage.value = '';
    currentNetwork.value = '';
    progress.value = 0;
    isDeploying.value = false;
    deploymentId.value = null;
    error.value = null;
    deploymentResult.value = null;
    clearLogs();
    Object.keys(networksStatus).forEach(key => delete networksStatus[key]);
  };
  
  // Автоматическая отписка при размонтировании компонента
  onUnmounted(() => {
    stopDeploymentTracking();
  });
  
  return {
    // Состояние
    deploymentStatus,
    currentStage,
    currentNetwork,
    progress,
    isDeploying,
    deploymentId,
    logs,
    error,
    networksStatus,
    deploymentResult,
    
    // Методы
    startDeploymentTracking,
    stopDeploymentTracking,
    resetDeploymentState,
    addLog,
    clearLogs
  };
}
