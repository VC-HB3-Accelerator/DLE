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
  const tableUpdateCallbacks = ref(new Map()); // tableId -> callback
  const tableRelationsUpdateCallbacks = ref(new Map()); // `${tableId}-${rowId}` -> callback

  function connect() {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      return; // Уже подключены
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    ws.value = new WebSocket(`${wsProtocol}://${window.location.host}/ws`);

    ws.value.onopen = () => {
      console.log('[TablesWebSocket] Соединение установлено');
      isConnected.value = true;
    };

    ws.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[TablesWebSocket] Получено сообщение:', data);

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

    ws.value.onclose = () => {
      console.log('[TablesWebSocket] Соединение закрыто');
      isConnected.value = false;
      // Переподключение через 3 секунды
      setTimeout(() => {
        if (!isConnected.value) {
          connect();
        }
      }, 3000);
    };

    ws.value.onerror = (error) => {
      console.error('[TablesWebSocket] Ошибка соединения:', error);
      isConnected.value = false;
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
      ws.value.close();
      ws.value = null;
    }
    isConnected.value = false;
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