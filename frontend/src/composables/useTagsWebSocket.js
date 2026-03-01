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

import { ref, onMounted, onUnmounted } from 'vue';
import websocketServiceModule from '../services/websocketService';

const { websocketService } = websocketServiceModule;

export function useTagsWebSocket() {
  console.log('🏷️ [useTagsWebSocket] Композабл создан');
  const tagsUpdateCallbacks = ref([]);
  const isSubscribed = ref(false);

  function onTagsUpdate(callback) {
    console.log('🏷️ [useTagsWebSocket] Регистрация колбэка');
    
    // Проверяем, не зарегистрирован ли уже этот колбэк
    if (tagsUpdateCallbacks.value.includes(callback)) {
      console.log('🏷️ [useTagsWebSocket] Колбэк уже зарегистрирован, пропускаем');
      return () => {
        const index = tagsUpdateCallbacks.value.indexOf(callback);
        if (index > -1) {
          tagsUpdateCallbacks.value.splice(index, 1);
        }
      };
    }
    
    tagsUpdateCallbacks.value.push(callback);
    console.log('🏷️ [useTagsWebSocket] Количество колбэков:', tagsUpdateCallbacks.value.length);
    
    // Возвращаем функцию для отписки
    return () => {
      console.log('🏷️ [useTagsWebSocket] Отписка колбэка');
      const index = tagsUpdateCallbacks.value.indexOf(callback);
      if (index > -1) {
        tagsUpdateCallbacks.value.splice(index, 1);
        console.log('🏷️ [useTagsWebSocket] Колбэк удален, осталось:', tagsUpdateCallbacks.value.length);
      }
    };
  }

  function handleTagsUpdate(data) {
    console.log('🏷️ [useTagsWebSocket] Получено уведомление об обновлении тегов:', data);
    console.log('🏷️ [useTagsWebSocket] Количество активных колбэков:', tagsUpdateCallbacks.value.length);
    
    // Вызываем все зарегистрированные колбэки
    tagsUpdateCallbacks.value.forEach((callback, index) => {
      try {
        console.log('🏷️ [useTagsWebSocket] Выполняем колбэк #', index);
        callback(data);
      } catch (error) {
        console.error('🏷️ [useTagsWebSocket] Ошибка в колбэке #', index, ':', error);
      }
    });
  }

  onMounted(() => {
    console.log('🏷️ [useTagsWebSocket] onMounted вызван');
    
    // Проверяем, не подписаны ли уже
    if (isSubscribed.value) {
      console.log('🏷️ [useTagsWebSocket] Уже подписаны, пропускаем');
      return;
    }
    
    console.log('🏷️ [useTagsWebSocket] Подписываемся на tags-updated');
    websocketService.on('tags-updated', handleTagsUpdate);
    isSubscribed.value = true;
    console.log('🏷️ [useTagsWebSocket] Подписка завершена');
  });

  onUnmounted(() => {
    console.log('🏷️ [useTagsWebSocket] onUnmounted вызван');
    if (isSubscribed.value) {
      websocketService.off('tags-updated', handleTagsUpdate);
      isSubscribed.value = false;
      console.log('🏷️ [useTagsWebSocket] Отписка завершена');
    }
    // Очищаем все колбэки
    tagsUpdateCallbacks.value = [];
    console.log('🏷️ [useTagsWebSocket] Колбэки очищены');
  });

  return {
    onTagsUpdate
  };
} 