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

import { ref, onMounted, onUnmounted } from 'vue';

export function useTablesWebSocket() {
  const ws = ref(null);
  const isConnected = ref(false);
  const isConnecting = ref(false); // Добавляем флаг для предотвращения множественных подключений
  const tableUpdateCallbacks = ref(new Map()); // tableId -> callback
  const tableRelationsUpdateCallbacks = ref(new Map()); // `${tableId}-${rowId}` -> callback
  const pingInterval = ref(null); // Интервал для ping сообщений

  function connect() {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      console.log('[TablesWebSocket] Уже подключены, пропускаем');
      return; // Уже подключены
    }

    if (isConnecting.value) {
      console.log('[TablesWebSocket] Уже пытаемся подключиться, пропускаем');
      return; // Уже пытаемся подключиться
    }

    isConnecting.value = true;

    // Определяем правильный URL для WebSocket
    let wsUrl;
    if (import.meta.env.DEV) {
      // В режиме разработки используем прокси через Vite
      wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
    } else {
      // В продакшене используем тот же хост
      wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
    }

    console.log('[TablesWebSocket] Подключение к:', wsUrl);
    console.log('[TablesWebSocket] Текущий хост:', window.location.host);
    console.log('[TablesWebSocket] Протокол:', window.location.protocol);
    
    try {
      ws.value = new WebSocket(wsUrl);
    } catch (error) {
      console.error('[TablesWebSocket] Ошибка создания WebSocket:', error);
      isConnecting.value = false;
      return;
    }

    ws.value.onopen = () => {
      console.log('[TablesWebSocket] Соединение установлено');
      isConnected.value = true;
      isConnecting.value = false;
      
      // Запускаем ping каждые 30 секунд
      pingInterval.value = setInterval(() => {
        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
          try {
            ws.value.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          } catch (error) {
            console.error('[TablesWebSocket] Ошибка отправки ping:', error);
          }
        }
      }, 30000);
    };

    ws.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[TablesWebSocket] Получено сообщение:', data);

        // Обрабатываем pong ответ
        if (data.type === 'pong') {
          console.log('[TablesWebSocket] Получен pong ответ');
          return;
        }

        if (data.type === 'table-updated') {
          const callbacks = tableUpdateCallbacks.value.get(data.tableId);
          if (callbacks) {
            callbacks.forEach(callback => callback(data));
          }
        }

        if (data.type === 'table-relations-updated') {
          const key = `${data.tableId}-${data.rowId}`;
          const callbacks = tableRelationsUpdateCallbacks.value.get(key);
          if (callbacks) {
            callbacks.forEach(callback => callback(data));
          }
        }
      } catch (error) {
        console.error('[TablesWebSocket] Ошибка обработки сообщения:', error);
      }
    };

    ws.value.onclose = (event) => {
      console.log('[TablesWebSocket] Соединение закрыто', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      isConnected.value = false;
      isConnecting.value = false;
      
      // Останавливаем ping интервал
      if (pingInterval.value) {
        clearInterval(pingInterval.value);
        pingInterval.value = null;
      }
      
      // Переподключение только если это не было намеренное закрытие
      if (event.code !== 1000) {
        setTimeout(() => {
          if (!isConnected.value && !isConnecting.value) {
            console.log('[TablesWebSocket] Попытка переподключения...');
            connect();
          }
        }, 3000);
      }
    };

    ws.value.onerror = (error) => {
      console.error('[TablesWebSocket] Ошибка соединения:', error);
      console.error('[TablesWebSocket] WebSocket readyState:', ws.value?.readyState);
      isConnected.value = false;
      isConnecting.value = false;
    };
  }

  function subscribeToTableUpdates(tableId, callback) {
    if (!tableUpdateCallbacks.value.has(tableId)) {
      tableUpdateCallbacks.value.set(tableId, []);
    }
    tableUpdateCallbacks.value.get(tableId).push(callback);

    // Возвращаем функцию для отписки
    return () => {
      const callbacks = tableUpdateCallbacks.value.get(tableId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
        if (callbacks.length === 0) {
          tableUpdateCallbacks.value.delete(tableId);
        }
      }
    };
  }

  function subscribeToTableRelationsUpdates(tableId, rowId, callback) {
    const key = `${tableId}-${rowId}`;
    if (!tableRelationsUpdateCallbacks.value.has(key)) {
      tableRelationsUpdateCallbacks.value.set(key, []);
    }
    tableRelationsUpdateCallbacks.value.get(key).push(callback);

    // Возвращаем функцию для отписки
    return () => {
      const callbacks = tableRelationsUpdateCallbacks.value.get(key);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
        if (callbacks.length === 0) {
          tableRelationsUpdateCallbacks.value.delete(key);
        }
      }
    };
  }

  function disconnect() {
    if (ws.value) {
      // Останавливаем ping интервал
      if (pingInterval.value) {
        clearInterval(pingInterval.value);
        pingInterval.value = null;
      }
      
      // Корректно закрываем соединение
      if (ws.value.readyState === WebSocket.OPEN) {
        ws.value.close(1000, 'Manual disconnect');
      }
      ws.value = null;
    }
    isConnected.value = false;
    isConnecting.value = false;
  }

  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    isConnected,
    connect,
    disconnect,
    subscribeToTableUpdates,
    subscribeToTableRelationsUpdates
  };
} 