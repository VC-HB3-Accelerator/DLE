/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import wsClient from '../utils/websocket';

export function useTokenBalancesWebSocket() {
  // Состояние балансов
  const tokenBalances = ref([]);
  const isLoadingTokens = ref(false);
  const lastUpdateTime = ref(null);
  
  // Запрос балансов через WebSocket
  const requestTokenBalances = (address, userId) => {
    if (!address) {
      console.log('[useTokenBalancesWebSocket] Нет адреса для запроса');
      return;
    }
    
    console.log('[useTokenBalancesWebSocket] Запрашиваем балансы для:', address, 'userId:', userId);
    isLoadingTokens.value = true;
    
    const message = {
      type: 'request_token_balances',
      address: address,
      userId: userId
    };
    
    console.log('[useTokenBalancesWebSocket] Отправляем WebSocket сообщение:', message);
    wsClient.ws.send(JSON.stringify(message));
  };
  
  // Обработчик ответа с балансами
  const handleTokenBalancesResponse = (data) => {
    console.log('[useTokenBalancesWebSocket] Получены балансы:', data);
    console.log('[useTokenBalancesWebSocket] data.balances:', data.balances);
    tokenBalances.value = data.balances || [];
    isLoadingTokens.value = false;
    lastUpdateTime.value = new Date();
    console.log('[useTokenBalancesWebSocket] Обновлен tokenBalances.value:', tokenBalances.value);
  };
  
  // Обработчик ошибки
  const handleTokenBalancesError = (data) => {
    console.error('[useTokenBalancesWebSocket] Ошибка получения балансов:', data);
    isLoadingTokens.value = false;
    
    // Создаем объект с информацией об ошибке для отображения пользователю
    const errorInfo = {
      network: 'unknown',
      tokenAddress: 'error',
      tokenName: 'Ошибка получения балансов',
      symbol: 'ERROR',
      balance: '0',
      minBalance: '0',
      readonlyThreshold: 1,
      editorThreshold: 1,
      error: data.error || 'Неизвестная ошибка',
      errorDetails: data.errorDetails || data.error
    };
    
    tokenBalances.value = [errorInfo];
  };
  
  // Обработчик обновления балансов
  const handleTokenBalancesUpdated = (data) => {
    console.log('[useTokenBalancesWebSocket] Обновление балансов:', data);
    tokenBalances.value = data.balances || [];
    lastUpdateTime.value = new Date();
  };
  
  // Обработчик изменения конкретного баланса
  const handleTokenBalanceChanged = (data) => {
    console.log('[useTokenBalancesWebSocket] Изменение баланса токена:', data);
    
    // Обновляем конкретный токен в списке
    const tokenIndex = tokenBalances.value.findIndex(
      token => token.tokenAddress === data.tokenAddress && token.network === data.network
    );
    
    if (tokenIndex !== -1) {
      tokenBalances.value[tokenIndex].balance = data.balance;
      lastUpdateTime.value = new Date();
    }
  };
  
  // Вычисляемое свойство для форматированного времени обновления
  const formattedLastUpdate = computed(() => {
    if (!lastUpdateTime.value) return 'Не обновлялось';
    return lastUpdateTime.value.toLocaleTimeString();
  });
  
  // Автоматическое обновление каждые 5 минут
  let autoUpdateInterval = null;
  
  const startAutoUpdate = (address, userId) => {
    stopAutoUpdate();
    
    // Первоначальный запрос
    if (address) {
      requestTokenBalances(address, userId);
    }
    
    // Автообновление каждые 5 минут
    autoUpdateInterval = setInterval(() => {
      if (address) {
        console.log('[useTokenBalancesWebSocket] Автообновление балансов');
        requestTokenBalances(address, userId);
      }
    }, 5 * 60 * 1000); // 5 минут
  };
  
  const stopAutoUpdate = () => {
    if (autoUpdateInterval) {
      clearInterval(autoUpdateInterval);
      autoUpdateInterval = null;
    }
  };
  
  // Подписка на WebSocket события
  onMounted(() => {
    // Подписываемся на события WebSocket
    wsClient.on('token_balances_response', handleTokenBalancesResponse);
    wsClient.on('token_balances_error', handleTokenBalancesError);
    wsClient.on('token_balances_updated', handleTokenBalancesUpdated);
    wsClient.on('token_balance_changed', handleTokenBalanceChanged);
  });
  
  onUnmounted(() => {
    // Отписываемся от событий
    wsClient.off('token_balances_response');
    wsClient.off('token_balances_error');
    wsClient.off('token_balances_updated');
    wsClient.off('token_balance_changed');
    
    // Останавливаем автообновление
    stopAutoUpdate();
  });
  
  return {
    // Состояние
    tokenBalances: computed(() => tokenBalances.value),
    isLoadingTokens: computed(() => isLoadingTokens.value),
    lastUpdateTime: computed(() => lastUpdateTime.value),
    formattedLastUpdate,
    
    // Методы
    requestTokenBalances,
    startAutoUpdate,
    stopAutoUpdate
  };
}
