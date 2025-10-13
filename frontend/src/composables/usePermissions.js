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
import { PERMISSIONS, ROLES, hasPermission as checkPermission, getRoleDescription } from '/app/shared/permissions';

/**
 * Composable для работы с правами доступа
 * Использует единую матрицу прав из shared/permissions.js
 * @returns {Object} - Объект с функциями для проверки прав доступа
 */
export function usePermissions() {
  const { userAccessLevel, isAuthenticated } = useAuthContext();

  /**
   * Текущая роль пользователя
   */
  const currentRole = computed(() => {
    if (!isAuthenticated.value) {
      return ROLES.GUEST; // Неавторизованный
    }
    
    // Если userAccessLevel не определен, возвращаем USER (авторизованный пользователь)
    return userAccessLevel.value?.level || ROLES.USER;
  });

  /**
   * Количество токенов пользователя
   */
  const tokenCount = computed(() => {
    return userAccessLevel.value?.tokenCount || 0;
  });

  /**
   * Универсальная проверка любого права
   * @param {string} permission - Право для проверки
   * @returns {boolean}
   */
  const hasPermission = (permission) => {
    return checkPermission(currentRole.value, permission);
  };

  // ========================================================================
  // Computed проверки для частого использования
  // ========================================================================
  
  // Просмотр данных
  const canViewData = computed(() => hasPermission(PERMISSIONS.VIEW_DATA));
  const canViewContacts = computed(() => hasPermission(PERMISSIONS.VIEW_CONTACTS));
  const canViewCrm = computed(() => hasPermission(PERMISSIONS.VIEW_CRM));
  
  // Редактирование и удаление
  const canEditData = computed(() => hasPermission(PERMISSIONS.EDIT_USER_DATA));
  const canEditContacts = computed(() => hasPermission(PERMISSIONS.EDIT_CONTACTS));
  const canDeleteData = computed(() => hasPermission(PERMISSIONS.DELETE_USER_DATA));
  const canDeleteMessages = computed(() => hasPermission(PERMISSIONS.DELETE_MESSAGES));
  
  // Коммуникация
  const canSendToUsers = computed(() => hasPermission(PERMISSIONS.SEND_TO_USERS));
  const canChatWithAdmins = computed(() => hasPermission(PERMISSIONS.CHAT_WITH_ADMINS));
  const canGenerateAI = computed(() => hasPermission(PERMISSIONS.GENERATE_AI_REPLIES));
  const canBroadcast = computed(() => hasPermission(PERMISSIONS.BROADCAST));
  
  // Управление
  const canManageTags = computed(() => hasPermission(PERMISSIONS.MANAGE_TAGS));
  const canBlockUsers = computed(() => hasPermission(PERMISSIONS.BLOCK_USERS));
  const canManageSettings = computed(() => hasPermission(PERMISSIONS.MANAGE_SETTINGS));
  
  const currentLevel = computed(() => currentRole.value);
  
  /**
   * Получает описание текущего уровня доступа
   */
  const getLevelDescription = (level) => {
    return getRoleDescription(level);
  };

  /**
   * Получает CSS класс для уровня доступа
   */
  const getLevelClass = (level) => {
    switch (level) {
      case ROLES.READONLY:
        return 'access-readonly';
      case ROLES.EDITOR:
        return 'access-editor';
      case ROLES.USER:
        return 'access-user';
      case ROLES.GUEST:
        return 'access-guest';
      default:
        return 'access-user';
    }
  };

  return {
    // Главная функция
    hasPermission,
    
    // Информация о роли
    currentRole,
    currentLevel, // alias для совместимости
    tokenCount,
    
    // Просмотр
    canViewData,
    canViewContacts,
    canViewCrm,
    
    // Редактирование
    canEditData,
    canEditContacts,
    canDeleteData,
    canDeleteMessages,
    
    // Коммуникация
    canSendToUsers,
    canChatWithAdmins,
    canGenerateAI,
    canBroadcast,
    
    // Управление
    canManageTags,
    canBlockUsers,
    canManageSettings,
    
    // Утилиты
    getLevelDescription,
    getLevelClass,
    
    // Константы
    ROLES,
    PERMISSIONS
  };
}
