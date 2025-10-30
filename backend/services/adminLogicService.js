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

const logger = require('../utils/logger');

/**
 * Сервис логики для админских функций
 * Определяет права доступа, приоритеты и логику работы с админами
 */

/**
 * Определить, нужно ли генерировать AI ответ
 * @param {Object} params - Параметры
 * @param {string} params.senderType - Тип отправителя (user/admin)
 * @param {number} params.userId - ID пользователя
 * @param {number} params.recipientId - ID получателя
 * @param {string} params.channel - Канал (web/telegram/email)
 * @returns {boolean}
 */
function shouldGenerateAiReply(params) {
  const { senderType, userId, recipientId } = params;

  // Если recipientId не указан или равен userId - это личный чат с ИИ
  // ИИ должен отвечать в личных чатах
  if (!recipientId || recipientId === userId) {
    return true;
  }

  // Если recipientId отличается от userId - это публичный чат между пользователями
  // ИИ НЕ должен отвечать на сообщения между пользователями
  return false;
}

/**
 * Проверить, может ли пользователь писать в беседу
 * @param {Object} params - Параметры
 * @param {Object} params.userAccessLevel - Уровень доступа пользователя
 * @param {number} params.userId - ID пользователя
 * @param {number} params.conversationUserId - ID владельца беседы
 * @returns {boolean}
 */
function canWriteToConversation(params) {
  const { userAccessLevel, userId, conversationUserId } = params;

  // Админ может писать в любую беседу
  if (userAccessLevel?.hasAccess) {
    return true;
  }

  // Обычный пользователь может писать только в свою беседу
  return userId === conversationUserId;
}


/**
 * Проверить, может ли пользователь выполнить админское действие
 * @param {Object} params - Параметры
 * @param {string} params.role - Роль пользователя ('editor', 'readonly', 'user')
 * @param {string} params.action - Название действия
 * @returns {boolean}
 */
function canPerformAdminAction(params) {
  const { role, action } = params;

  // Обычный пользователь не может выполнять админские действия
  if (role === 'user') {
    return false;
  }

  // Список действий только для editor (с правами редактирования)
  const editorOnlyActions = [
    'delete_message_history',
    'manage_users',
    'manage_ai_settings',
    'broadcast_message',      // ← Массовая рассылка только для editor!
    'delete_user',
    'modify_user_settings'
  ];

  // Список действий для readonly (только просмотр и личные чаты)
  const readonlyActions = [
    'view_all_conversations',  // Просмотр всех бесед
    'create_admin_chat',       // Создание приватных чатов между админами
    'view_admin_chat'          // Просмотр приватных чатов
  ];

  // readonly может только просматривать и общаться
  if (role === 'readonly') {
    return readonlyActions.includes(action);
  }

  // editor может все (и свои действия, и readonly действия)
  if (role === 'editor' || role === 'readonly') {
    return editorOnlyActions.includes(action) || readonlyActions.includes(action);
  }

  return false;
}

/**
 * Получить настройки админа с учетом роли
 * @param {Object} params - Параметры
 * @param {string} params.role - Роль пользователя ('editor', 'readonly', 'user')
 * @returns {Object} Настройки прав доступа
 */
function getAdminSettings(params) {
  const { role } = params;

  // Editor - полные права
  if (role === 'editor' || role === 'readonly') {
    return {
      role: 'editor',
      roleDisplay: 'Редактор',
      canWriteToAnyConversation: true,
      canViewAllConversations: true,
      canManageUsers: true,
      canManageAISettings: true,
      canBroadcast: true,
      canDeleteUsers: true,
      canModifySettings: true,
      canCreateAdminChat: true
    };
  }

  // Readonly - только просмотр и общение
  if (role === 'readonly') {
    return {
      role: 'readonly',
      roleDisplay: 'Только чтение',
      canWriteToAnyConversation: false,  // Только в свои беседы
      canViewAllConversations: true,     // Может просматривать все
      canManageUsers: false,
      canManageAISettings: false,
      canBroadcast: false,
      canDeleteUsers: false,
      canModifySettings: false,
      canCreateAdminChat: true           // Может создавать приватные чаты с админами
    };
  }

  // User - минимальные права
  return {
    role: 'user',
    roleDisplay: 'Пользователь',
    canWriteToAnyConversation: false,
    canViewAllConversations: false,
    canManageUsers: false,
    canManageAISettings: false,
    canBroadcast: false,
    canDeleteUsers: false,
    canModifySettings: false,
    canCreateAdminChat: false
  };
}

module.exports = {
  shouldGenerateAiReply,
  canWriteToConversation,
  canPerformAdminAction,
  getAdminSettings
};

