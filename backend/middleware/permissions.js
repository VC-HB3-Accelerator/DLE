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

const logger = require('../utils/logger');
const roleActionCapabilitiesService = require('../services/roleActionCapabilitiesService');

/**
 * Получить роль пользователя из сессии
 * @param {Object} req - Express request
 * @returns {Promise<string>} - Роль: 'guest', 'user', 'readonly', 'editor'
 */
async function getUserRole(req) {
  const userId = req.session?.userId;
  const address = req.session?.address;
  
  // Неавторизованный пользователь
  if (!userId) {
    return 'guest';
  }
  
  // Авторизован, но нет кошелька или адреса
  if (!address) {
    return 'user';
  }
  
  // Используем существующую логику из auth-service для получения роли
  try {
    const authService = require('../services/auth-service');
    const accessLevel = await authService.getUserAccessLevel(address);
    
    // accessLevel.level может быть: 'user', 'readonly', 'editor'
    return accessLevel?.level || 'user';
  } catch (error) {
    logger.error('[Permissions] Error getting user role:', error);
    return 'user'; // Безопасное значение по умолчанию
  }
}

/**
 * Middleware: Требует конкретное право доступа
 * @param {string} permission - Требуемое право
 * @returns {Function} Express middleware
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const role = await getUserRole(req);
      
      if (!(await roleActionCapabilitiesService.roleHasPermission(role, permission))) {
        logger.warn(`[Permissions] Access denied: ${role} tried to access ${permission}`);
        return res.status(403).json({ 
          error: 'Доступ запрещен',
          required: permission,
          yourRole: role
        });
      }
      
      // Сохраняем роль в req для использования в route handlers
      req.userRole = role;
      next();
    } catch (error) {
      logger.error('[Permissions] Error checking permission:', error);
      res.status(500).json({ error: 'Ошибка проверки прав доступа' });
    }
  };
}

/**
 * Middleware: Требует хотя бы одно из прав
 * @param {Array<string>} permissions - Список прав (достаточно одного)
 * @returns {Function} Express middleware
 */
function requireAnyPermission(permissions) {
  return async (req, res, next) => {
    try {
      const role = await getUserRole(req);
      let allowed = false;
      for (const permission of permissions) {
        if (await roleActionCapabilitiesService.roleHasPermission(role, permission)) {
          allowed = true;
          break;
        }
      }
      
      if (!allowed) {
        logger.warn(`[Permissions] Access denied: ${role} tried to access any of [${permissions.join(', ')}]`);
        return res.status(403).json({ 
          error: 'Доступ запрещен',
          required: permissions,
          yourRole: role
        });
      }
      
      req.userRole = role;
      next();
    } catch (error) {
      logger.error('[Permissions] Error checking permissions:', error);
      res.status(500).json({ error: 'Ошибка проверки прав доступа' });
    }
  };
}

/**
 * Middleware: Проверяет право в route handler (не блокирует запрос)
 * Добавляет req.hasPermission() для использования в контроллере
 */
function attachPermissionChecker(req, res, next) {
  getUserRole(req).then(async (role) => {
    req.userRole = role;
    const actions = await roleActionCapabilitiesService.getActionsForUi(role);
    req.hasPermission = (permission) => actions[permission] === true;
    next();
  }).catch((error) => {
    logger.error('[Permissions] Error attaching permission checker:', error);
    req.userRole = 'guest';
    req.hasPermission = () => false;
    next();
  });
}

module.exports = {
  getUserRole,
  requirePermission,
  requireAnyPermission,
  attachPermissionChecker
};
