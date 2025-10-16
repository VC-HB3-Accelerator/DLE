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

/**
 * Единая матрица прав доступа для DLE
 * Используется и на backend, и на frontend
 */

// Роли в системе
const ROLES = {
  GUEST: 'guest',           // Неавторизованный гость
  USER: 'user',             // Авторизованный гость (0 токенов)
  READONLY: 'readonly',     // Админ чтение (токены > 0 && < X)
  EDITOR: 'editor'          // Админ редактор (токены >= X)
};

// Список всех прав в системе
const PERMISSIONS = {
  // Публичный доступ
  VIEW_HOME: 'view_home',
  CHAT_AI: 'chat_ai',
  
  // Получение сообщений
  RECEIVE_MESSAGES: 'receive_messages',
  
  // Просмотр данных
  VIEW_CRM: 'view_crm',
  VIEW_CONTACTS: 'view_contacts',
  VIEW_DATA: 'view_data',
  
  // Отправка сообщений
  SEND_TO_USERS: 'send_to_users',
  CHAT_WITH_ADMINS: 'chat_with_admins',
  
  // AI функции
  GENERATE_AI_REPLIES: 'generate_ai_replies',
  
  // Редактирование
  EDIT_USER_DATA: 'edit_user_data',
  EDIT_CONTACTS: 'edit_contacts',
  
  // Удаление
  DELETE_USER_DATA: 'delete_user_data',
  DELETE_MESSAGES: 'delete_messages',
  
  // Массовые операции
  BROADCAST: 'broadcast',
  
  // Управление тегами
  MANAGE_TAGS: 'manage_tags',
  
  // Блокировка пользователей
  BLOCK_USERS: 'block_users',
  
  // Управление настройками
  MANAGE_SETTINGS: 'manage_settings'
};

// Матрица: какая роль имеет какие права
const PERMISSIONS_MAP = {
  [ROLES.GUEST]: [
    PERMISSIONS.VIEW_HOME,
    PERMISSIONS.CHAT_AI
  ],
  
  [ROLES.USER]: [
    PERMISSIONS.VIEW_HOME,
    PERMISSIONS.CHAT_AI,
    PERMISSIONS.RECEIVE_MESSAGES,
    PERMISSIONS.VIEW_CONTACTS, // Пользователи могут видеть контакты для выбора
    PERMISSIONS.SEND_TO_USERS, // Пользователи могут отправлять сообщения
    PERMISSIONS.CHAT_WITH_ADMINS // Авторизованные пользователи могут видеть личные сообщения
  ],
  
  [ROLES.READONLY]: [
    PERMISSIONS.VIEW_HOME,
    PERMISSIONS.CHAT_AI,
    PERMISSIONS.RECEIVE_MESSAGES,
    PERMISSIONS.VIEW_CRM,
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.VIEW_DATA,
    PERMISSIONS.SEND_TO_USERS,
    PERMISSIONS.CHAT_WITH_ADMINS
  ],
  
  [ROLES.EDITOR]: [
    PERMISSIONS.VIEW_HOME,
    PERMISSIONS.CHAT_AI,
    PERMISSIONS.RECEIVE_MESSAGES,
    PERMISSIONS.VIEW_CRM,
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.VIEW_DATA,
    PERMISSIONS.SEND_TO_USERS,
    PERMISSIONS.CHAT_WITH_ADMINS,
    PERMISSIONS.GENERATE_AI_REPLIES,
    PERMISSIONS.EDIT_USER_DATA,
    PERMISSIONS.EDIT_CONTACTS,
    PERMISSIONS.DELETE_USER_DATA,
    PERMISSIONS.DELETE_MESSAGES,
    PERMISSIONS.BROADCAST,
    PERMISSIONS.MANAGE_TAGS,
    PERMISSIONS.BLOCK_USERS,
    PERMISSIONS.MANAGE_SETTINGS
  ]
};

/**
 * Проверяет, имеет ли роль определенное право
 * @param {string} role - Роль пользователя
 * @param {string} permission - Требуемое право
 * @returns {boolean}
 */
function hasPermission(role, permission) {
  if (!role || !permission) return false;
  return PERMISSIONS_MAP[role]?.includes(permission) || false;
}

/**
 * Получает все права для роли
 * @param {string} role - Роль пользователя
 * @returns {Array<string>}
 */
function getPermissionsForRole(role) {
  return PERMISSIONS_MAP[role] || [];
}

/**
 * Проверяет, имеет ли роль ХОТЯ БЫ ОДНО из прав
 * @param {string} role - Роль пользователя
 * @param {Array<string>} permissions - Список прав
 * @returns {boolean}
 */
function hasAnyPermission(role, permissions) {
  if (!Array.isArray(permissions)) return false;
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Проверяет, имеет ли роль ВСЕ указанные права
 * @param {string} role - Роль пользователя
 * @param {Array<string>} permissions - Список прав
 * @returns {boolean}
 */
function hasAllPermissions(role, permissions) {
  if (!Array.isArray(permissions)) return false;
  return permissions.every(p => hasPermission(role, p));
}

/**
 * Получает описание роли
 * @param {string} role - Роль пользователя
 * @returns {string}
 */
function getRoleDescription(role) {
  const descriptions = {
    [ROLES.GUEST]: 'Неавторизованный гость',
    [ROLES.USER]: 'Авторизованный гость',
    [ROLES.READONLY]: 'Админ (только чтение)',
    [ROLES.EDITOR]: 'Админ (редактор)'
  };
  
  return descriptions[role] || 'Неизвестная роль';
}

// Экспорты для CommonJS (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ROLES,
    PERMISSIONS,
    PERMISSIONS_MAP,
    hasPermission,
    getPermissionsForRole,
    hasAnyPermission,
    hasAllPermissions,
    getRoleDescription
  };
}

// ES модули для Frontend
export {
  ROLES,
  PERMISSIONS,
  PERMISSIONS_MAP,
  hasPermission,
  getPermissionsForRole,
  hasAnyPermission,
  hasAllPermissions,
  getRoleDescription
};

// CommonJS для Backend
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ROLES,
    PERMISSIONS,
    PERMISSIONS_MAP,
    hasPermission,
    getPermissionsForRole,
    hasAnyPermission,
    hasAllPermissions,
    getRoleDescription
  };
}

