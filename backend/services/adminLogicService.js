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

const logger = require('../utils/logger');

/**
 * Сервис логики для админских функций
 * Определяет права доступа, приоритеты и логику работы с админами
 */

/**
 * Определить тип отправителя на основе сессии
 * @param {Object} session - Сессия пользователя
 * @returns {Object} { senderType, role }
 */
function determineSenderType(session) {
  if (!session) {
    return { senderType: 'user', role: 'user' };
  }

  if (session.isAdmin === true) {
    return { senderType: 'admin', role: 'admin' };
  }

  return { senderType: 'user', role: 'user' };
}

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

  // Обычные пользователи всегда получают AI ответ
  if (senderType !== 'admin') {
    return true;
  }

  // Админ, пишущий себе, получает AI ответ
  if (userId === recipientId) {
    return true;
  }

  // Админ, пишущий другому пользователю, не получает AI ответ
  // (это личное сообщение от админа)
  return false;
}

/**
 * Проверить, может ли пользователь писать в беседу
 * @param {Object} params - Параметры
 * @param {boolean} params.isAdmin - Является ли админом
 * @param {number} params.userId - ID пользователя
 * @param {number} params.conversationUserId - ID владельца беседы
 * @returns {boolean}
 */
function canWriteToConversation(params) {
  const { isAdmin, userId, conversationUserId } = params;

  // Админ может писать в любую беседу
  if (isAdmin) {
    return true;
  }

  // Обычный пользователь может писать только в свою беседу
  return userId === conversationUserId;
}

/**
 * Получить приоритет запроса для очереди AI
 * @param {Object} params - Параметры
 * @param {boolean} params.isAdmin - Является ли админом
 * @param {string} params.message - Текст сообщения
 * @param {Array} params.history - История сообщений
 * @returns {number} Приоритет (чем выше, тем важнее)
 */
function getRequestPriority(params) {
  const { isAdmin, message, history = [] } = params;

  let priority = 10; // Базовый приоритет

  // Админ получает повышенный приоритет
  if (isAdmin) {
    priority += 5;
  }

  // Срочные ключевые слова
  const urgentKeywords = ['срочно', 'urgent', 'помогите', 'help', 'критично', 'critical'];
  const messageLC = (message || '').toLowerCase();
  
  if (urgentKeywords.some(keyword => messageLC.includes(keyword))) {
    priority += 10;
  }

  // Короткие сообщения обрабатываются быстрее
  if (message && message.length < 50) {
    priority += 5;
  }

  // Первое сообщение в беседе
  if (!history || history.length === 0) {
    priority += 3;
  }

  return priority;
}

/**
 * Проверить, может ли пользователь выполнить админское действие
 * @param {Object} params - Параметры
 * @param {boolean} params.isAdmin - Является ли админом
 * @param {string} params.action - Название действия
 * @returns {boolean}
 */
function canPerformAdminAction(params) {
  const { isAdmin, action } = params;

  // Только админ может выполнять админские действия
  if (!isAdmin) {
    return false;
  }

  // Список разрешенных админских действий
  const allowedActions = [
    'delete_message_history',
    'view_all_conversations',
    'manage_users',
    'manage_ai_settings',
    'broadcast_message',
    'delete_user',
    'modify_user_settings'
  ];

  return allowedActions.includes(action);
}

/**
 * Получить настройки админа
 * @param {Object} params - Параметры
 * @param {boolean} params.isAdmin - Является ли админом
 * @param {string} params.channel - Канал
 * @returns {Object} Настройки
 */
function getAdminSettings(params) {
  const { isAdmin } = params;

  if (!isAdmin) {
    // Ограниченные права для обычного пользователя
    return {
      canWriteToAnyConversation: false,
      canViewAllConversations: false,
      canManageUsers: false,
      canManageAISettings: false,
      aiReplyPriority: 0
    };
  }

  // Полные права для админа
  return {
    canWriteToAnyConversation: true,
    canViewAllConversations: true,
    canManageUsers: true,
    canManageAISettings: true,
    aiReplyPriority: 15
  };
}

/**
 * Логирование админского действия
 * @param {Object} params - Параметры
 * @param {number} params.adminId - ID админа
 * @param {string} params.action - Действие
 * @param {Object} params.details - Детали
 */
function logAdminAction(params) {
  const { adminId, action, details } = params;
  
  logger.info('[AdminLogic] Админское действие:', {
    adminId,
    action,
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Проверить, является ли сообщение от админа личным
 * @param {Object} params - Параметры
 * @returns {boolean}
 */
function isPersonalAdminMessage(params) {
  const { senderType, userId, recipientId } = params;
  
  return senderType === 'admin' && userId !== recipientId;
}

module.exports = {
  determineSenderType,
  shouldGenerateAiReply,
  canWriteToConversation,
  getRequestPriority,
  canPerformAdminAction,
  getAdminSettings,
  logAdminAction,
  isPersonalAdminMessage
};

