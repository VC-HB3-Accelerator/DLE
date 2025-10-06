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

import { computed } from 'vue';
import { useAuthContext } from './useAuth';

/**
 * Composable для работы с правами доступа
 * @returns {Object} - Объект с функциями для проверки прав доступа
 */
export function usePermissions() {
  const { userAccessLevel, isAdmin } = useAuthContext();

  /**
   * Проверяет, может ли пользователь только читать данные
   */
  const canRead = computed(() => {
    return (userAccessLevel.value && userAccessLevel.value.hasAccess) || isAdmin.value;
  });

  /**
   * Проверяет, может ли пользователь редактировать данные
   */
  const canEdit = computed(() => {
    return userAccessLevel.value && userAccessLevel.value.level === 'editor';
  });

  /**
   * Проверяет, может ли пользователь удалять данные
   */
  const canDelete = computed(() => {
    return userAccessLevel.value && userAccessLevel.value.level === 'editor';
  });

  /**
   * Проверяет, может ли пользователь управлять настройками системы
   */
  const canManageSettings = computed(() => {
    return userAccessLevel.value && userAccessLevel.value.level === 'editor';
  });

  /**
   * Получает текущий уровень доступа
   */
  const currentLevel = computed(() => {
    return userAccessLevel.value ? userAccessLevel.value.level : 'user';
  });

  /**
   * Получает количество токенов пользователя
   */
  const tokenCount = computed(() => {
    return userAccessLevel.value ? userAccessLevel.value.tokenCount : 0;
  });

  /**
   * Получает описание текущего уровня доступа
   */
  const getLevelDescription = (level) => {
    switch (level) {
      case 'readonly':
        return 'Только чтение';
      case 'editor':
        return 'Редактор';
      case 'user':
      default:
        return 'Пользователь';
    }
  };

  /**
   * Получает CSS класс для уровня доступа
   */
  const getLevelClass = (level) => {
    switch (level) {
      case 'readonly':
        return 'access-readonly';
      case 'editor':
        return 'access-editor';
      case 'user':
      default:
        return 'access-user';
    }
  };

  return {
    canRead,
    canEdit,
    canDelete,
    canManageSettings,
    currentLevel,
    tokenCount,
    getLevelDescription,
    getLevelClass
  };
}
