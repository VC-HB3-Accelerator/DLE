/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
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
    console.log('📝 [DeploymentWebSocket] Добавляем лог:', { timestamp, message, type });
    logs.value.push({
      timestamp,
      message,
      type
    });
    console.log('📝 [DeploymentWebSocket] Всего логов:', logs.value.length);
  };
  
  // Очистить логи
  const clearLogs = () => {
    logs.value = [];
  };
  
  // Обработчик WebSocket сообщений
  const handleDeploymentUpdate = (data) => {
    console.log('🔄 [DeploymentWebSocket] Получено обновление:', data);
    
    // Проверяем, что data существует и имеет type
    if (!data || !data.type) {
      console.warn('🔄 [DeploymentWebSocket] Получены некорректные данные:', data);
      return;
    }
    
    console.log('🔄 [DeploymentWebSocket] Текущий deploymentId:', deploymentId.value);
    console.log('🔄 [DeploymentWebSocket] deploymentId из данных:', data.deploymentId);
    console.log('🔄 [DeploymentWebSocket] Тип сообщения:', data.type);
    console.log('🔄 [DeploymentWebSocket] Есть ли log:', !!data.log);
    
    // Обрабатываем deployment_update сообщения
    if (data.type === 'deployment_update' && data.data) {
      const updateData = data.data;
      console.log('🔄 [DeploymentWebSocket] Обрабатываем deployment_update:', updateData);
      console.log('🔄 [DeploymentWebSocket] updateData.deploymentId:', updateData.deploymentId);
      console.log('🔄 [DeploymentWebSocket] Текущий deploymentId:', deploymentId.value);
      
      // Проверяем, что это наш деплой
      if (updateData.deploymentId && updateData.deploymentId !== deploymentId.value) {
        console.log('🔄 [DeploymentWebSocket] Игнорируем - не наш deploymentId');
        return;
      }
      
      // Добавляем output как лог
      if (updateData.output) {
        console.log('🔄 [DeploymentWebSocket] Добавляем output как лог:', updateData.output);
        addLog(updateData.output, 'info');
      }
      
      // Обновляем статус и прогресс
      if (updateData.status) deploymentStatus.value = updateData.status;
      if (updateData.progress !== undefined) progress.value = updateData.progress;
      if (updateData.message) currentStage.value = updateData.message;
      if (updateData.result) deploymentResult.value = updateData.result;
      
      return;
    }
    
    // Всегда обрабатываем логи, даже если deploymentId не совпадает
    if (data.type === 'deployment_log' && data.log) {
      console.log('🔄 [DeploymentWebSocket] Добавляем лог:', data.log.message);
      addLog(data.log.message, data.log.type || 'info');
      return;
    }
    
    if (data.deploymentId !== deploymentId.value) {
      console.log('🔄 [DeploymentWebSocket] Игнорируем обновление - не наш deploymentId');
      return;
    }
    
    switch (data.type) {
      case 'deployment_log':
        // Уже обработано выше, пропускаем
        break;
        
      case 'deployment_update':
        // Обработка deployment_update сообщений
        if (data.data) {
          const updateData = data.data;
          if (updateData.stage) currentStage.value = updateData.stage;
          if (updateData.progress !== undefined) progress.value = updateData.progress;
          if (updateData.status) deploymentStatus.value = updateData.status;
          if (updateData.result) deploymentResult.value = updateData.result;
          if (updateData.error) error.value = updateData.error;
          if (updateData.output) {
            addLog(updateData.output, 'info');
          }
          if (updateData.message) {
            addLog(updateData.message, 'info');
          }
          if (updateData.status === 'completed') {
            isDeploying.value = false;
            addLog('🎉 Деплой успешно завершен!', 'success');
          } else if (updateData.status === 'failed') {
            isDeploying.value = false;
            addLog('💥 Деплой завершился с ошибкой!', 'error');
          }
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

  // Подключаемся к WebSocket сразу при инициализации
  console.log('🔌 [DeploymentWebSocket] Инициализация WebSocket...');
  console.log('🔌 [DeploymentWebSocket] wsClient:', !!wsClient);
  console.log('🔌 [DeploymentWebSocket] wsClient.subscribe:', typeof wsClient?.subscribe);
  
  wsClient.connect();
  if (wsClient && typeof wsClient.subscribe === 'function') {
    wsClient.subscribe('deployment_update', handleDeploymentUpdate);
    console.log('🔌 [DeploymentWebSocket] Подключились к WebSocket при инициализации');
  } else {
    console.warn('🔌 [DeploymentWebSocket] WebSocket не доступен!');
  }
  
  // Начать отслеживание деплоя
  const startDeploymentTracking = (id) => {
    console.log('🎯 [DeploymentWebSocket] Начинаем отслеживание деплоя:', id);
    console.log('🎯 [DeploymentWebSocket] WebSocket подключен:', !!wsClient);
    console.log('🎯 [DeploymentWebSocket] Обработчики deployment_update:', wsClient?.handlers?.deployment_update?.length || 0);
    
    deploymentId.value = id;
    deploymentStatus.value = 'in_progress';
    isDeploying.value = true;
    clearLogs();
    
    // WebSocket уже подключен при инициализации
    // Подписываемся на DLE адрес для получения логов деплоя
    if (wsClient && typeof wsClient.subscribeToDeployment === 'function') {
      // Используем временный DLE адрес для подписки на логи
      const tempDleAddress = '0x0000000000000000000000000000000000000000';
      wsClient.subscribeToDeployment(tempDleAddress);
      console.log('🎯 [DeploymentWebSocket] Подписались на DLE адрес:', tempDleAddress);
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
