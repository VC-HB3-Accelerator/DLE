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

import { onMounted, onUnmounted } from 'vue';
import websocketServiceModule from '@/services/websocketService.js';

const { websocketService, onTableUpdate } = websocketServiceModule;

export function useTablesWebSocket() {
  // Подписка на обновления таблиц
  function subscribeToTableUpdates(tableId, callback) {
    return onTableUpdate(tableId, callback);
  }

  // Подписка на обновления связей (relations)
  function subscribeToTableRelationsUpdates(tableId, rowId, callback) {
    // Используем глобальный обработчик и фильтруем по tableId/rowId
    const handler = (data) => {
      if (data.tableId === tableId && data.rowId === rowId) {
        callback(data);
      }
    };
    websocketService.on('table-relations-updated', handler);
    // Возвращаем функцию для отписки
    return () => websocketService.off('table-relations-updated', handler);
  }

  onMounted(() => {
    // Соединение управляется websocketService, ничего не делаем
  });

  onUnmounted(() => {
    // Соединение управляется websocketService, ничего не делаем
  });

  return {
    subscribeToTableUpdates,
    subscribeToTableRelationsUpdates,
  };
} 