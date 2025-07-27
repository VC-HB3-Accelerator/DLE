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
import websocketServiceModule from '../services/websocketService';

const { websocketService } = websocketServiceModule;

export function useTagsWebSocket() {
  const tagsUpdateCallbacks = ref([]);
  let debounceTimer = null;
  const DEBOUNCE_DELAY = 1000; // 1 секунда

  function onTagsUpdate(callback) {
    tagsUpdateCallbacks.value.push(callback);
    
    // Возвращаем функцию для отписки
    return () => {
      const index = tagsUpdateCallbacks.value.indexOf(callback);
      if (index > -1) {
        tagsUpdateCallbacks.value.splice(index, 1);
      }
    };
  }

  function handleTagsUpdate(data) {
    console.log('🏷️ [useTagsWebSocket] Получено обновление тегов:', data);
    
    // Очищаем предыдущий таймер
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Устанавливаем новый таймер для дебаунсинга
    debounceTimer = setTimeout(() => {
      console.log('🏷️ [useTagsWebSocket] Выполняем обновление тегов после дебаунсинга');
      tagsUpdateCallbacks.value.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Ошибка в callback обновления тегов:', error);
        }
      });
    }, DEBOUNCE_DELAY);
  }

  onMounted(() => {
    websocketService.on('tags-updated', handleTagsUpdate);
  });

  onUnmounted(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    websocketService.off('tags-updated', handleTagsUpdate);
  });

  return {
    onTagsUpdate
  };
} 