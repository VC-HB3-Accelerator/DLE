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

// console.log('[DIAG][auth.js] Файл загружен:', __filename);

const { createError } = require('../utils/error');
const authService = require('../services/auth-service');
const logger = require('../utils/logger');
// НОВАЯ СИСТЕМА РОЛЕЙ: используем shared/permissions.js
const { hasPermission, ROLES, PERMISSIONS } = require('/app/shared/permissions');
const db = require('../db');

// Получаем ключ шифрования
const encryptionUtils = require('../utils/encryptionUtils');
const encryptionKey = encryptionUtils.getEncryptionKey();

/**
 * Middleware для проверки аутентификации
 */
const requireAuth = async (req, res, next) => {
  // Проверяем аутентификацию через сессию
  if (!req.session) {
    logger.warn(`[requireAuth] Сессия отсутствует для ${req.method} ${req.path}`);
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  
  // Проверяем различные способы аутентификации
  const isAuthenticated = req.session.authenticated || 
                         (req.session.userId && req.session.authType) ||
                         (req.session.address && req.session.authType === 'wallet');
  
  if (!isAuthenticated) {
    logger.warn(`[requireAuth] Пользователь не аутентифицирован для ${req.method} ${req.path}`, {
      hasSession: !!req.session,
      authenticated: req.session?.authenticated,
      userId: req.session?.userId,
      address: req.session?.address,
      authType: req.session?.authType
    });
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  
  next();
};

/**
 * Middleware: только роль editor (секреты: ключ шифрования, пароль БД).
 * Не смотрит матрицу «Действия» — для обычных настроек используйте
 * requirePermission(PERMISSIONS.MANAGE_SETTINGS).
 */
async function requireAdmin(req, res, next) {
  try {
    const isAuthenticated = req.session?.authenticated ||
      (req.session?.userId && req.session?.authType) ||
      (req.session?.address && req.session?.authType === 'wallet');

    if (!req.session || !isAuthenticated) {
      logger.warn(`[requireAdmin] Сессия не аутентифицирована`);
      return next(createError('Требуется аутентификация', 401));
    }

    if (req.session.userAccessLevel?.level === ROLES.EDITOR) {
      return next();
    }

    if (req.session.address) {
      const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
      if (userAccessLevel.level === ROLES.EDITOR) {
        req.session.userAccessLevel = userAccessLevel;
        return next();
      }
    }

    if (req.session.userId) {
      const userResult = await db.getQuery()('SELECT role FROM users WHERE id = $1', [
        req.session.userId,
      ]);
      if (userResult.rows.length > 0 && userResult.rows[0].role === ROLES.EDITOR) {
        req.session.userAccessLevel = {
          ...(req.session.userAccessLevel || {}),
          level: ROLES.EDITOR,
          hasAccess: true,
        };
        return next();
      }
    }

    logger.warn(`[requireAdmin] Доступ запрещен (нужна роль editor)`);
    return next(createError('Доступ запрещен', 403));
  } catch (error) {
    logger.error(`Error in requireAdmin middleware: ${error.message}`);
    return next(createError('Внутренняя ошибка сервера', 500));
  }
}

/**
 * Middleware для проверки определенной роли
 * @param {string} role - Требуемая роль
 */
function requireRole(role) {
  return async (req, res, next) => {
    try {
      if (!req.session || !req.session.authenticated) {
        return next(createError('Требуется аутентификация', 401));
      }

      // Editor проходит любую requireRole (полный доступ)
      if (req.session.userAccessLevel?.level === ROLES.EDITOR) {
        return next();
      }

      if (req.session.userId) {
        const userResult = await db.getQuery()('SELECT role FROM users WHERE id = $1', [
          req.session.userId,
        ]);
        if (userResult.rows.length > 0 && userResult.rows[0].role === role) {
          return next();
        }
      }

      return next(createError('Доступ запрещен', 403));
    } catch (error) {
      logger.error(`Error in requireRole middleware: ${error.message}`);
      return next(createError('Внутренняя ошибка сервера', 500));
    }
  };
}

/**
 * Проверяет роль пользователя
 * @param {string} role - Роль для проверки
 */
async function checkRole(req, res, next) {
  try {
    if (!req.session.authenticated) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Если есть адрес кошелька - проверяем токены
    if (req.session.address) {
      req.session.userAccessLevel = await authService.getUserAccessLevel(req.session.address);
      await req.session.save();
    }

    if (!req.session.userAccessLevel?.hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  } catch (error) {
    // console.error('Error in checkRole middleware:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Проверка аутентификации - алиас для requireAuth
 */
const isAuthenticated = requireAuth;

/**
 * НОВАЯ СИСТЕМА: проверка прав через permissions
 */
const isAdmin = (req, res, next) => {
  // Определяем роль пользователя через новую систему
  let userRole = ROLES.GUEST;
  
  if (req.user?.userAccessLevel) {
    if (req.user.userAccessLevel.level === 'readonly') {
      userRole = ROLES.READONLY;
    } else if (req.user.userAccessLevel.level === 'editor') {
      userRole = ROLES.EDITOR;
    } else if (req.user?.id) {
      userRole = ROLES.USER;
    }
  } else if (req.user?.id) {
    userRole = ROLES.USER;
  }
  
  // Проверяем права через новую систему
  if (!hasPermission(userRole, PERMISSIONS.VIEW_CRM)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireRole,
  checkRole,
  isAuthenticated,
  isAdmin
};
