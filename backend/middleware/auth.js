const logger = require('../utils/logger');
const { getUserInfo } = require('../utils/access-check');

// Добавьте в начало файла
const isMiddleware = true;

// Middleware для проверки роли
const requireRole = (allowedRoles) => async (req, res, next) => {
  if (!req.session || !req.session.authenticated || !req.session.userId) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  
  try {
    // Получение информации о пользователе
    const userInfo = await getUserInfo(req.session.userId);
    
    if (!userInfo) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    
    // Проверка роли
    if (!allowedRoles.includes(userInfo.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking user role:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

// Проверка роли пользователя
const checkRole = async (req, res, next) => {
  try {
    // Если функция вызвана как middleware
    const isMiddleware = typeof next === 'function';

    if (!req.session.authenticated) {
      return isMiddleware ? res.status(401).json({ error: 'Не авторизован' }) : false;
    }

    // Если роль администратора уже проверена в сессии
    if (req.session.isAdmin === true) {
      return isMiddleware ? next() : true;
    }

    const db = require('../db');

    // Проверка наличия токенов доступа в смарт-контракте
    if (req.session.address) {
      const address = req.session.address.toLowerCase();

      // Проверка в базе данных
      const userRole = await db.query(
        'SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE LOWER(u.address) = $1',
        [address]
      );

      if (userRole.rows.length > 0 && userRole.rows[0].name === 'admin') {
        req.session.isAdmin = true;
        return isMiddleware ? next() : true;
      }

      // Проверка токенов в смарт-контракте через сервис
      const { ethers } = require('ethers');
      const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL);
      const accessTokenABI = require('../artifacts/contracts/AccessToken.sol/AccessToken.json').abi;
      const accessTokenContract = new ethers.Contract(
        process.env.ACCESS_TOKEN_ADDRESS,
        accessTokenABI,
        provider
      );

      try {
        const hasAdminRole = await accessTokenContract.hasRole(
          ethers.keccak256(ethers.toUtf8Bytes('ADMIN_ROLE')),
          address
        );

        if (hasAdminRole) {
          // Обновляем роль в базе данных
          await db.query(
            'UPDATE users SET role_id = (SELECT id FROM roles WHERE name = $1) WHERE LOWER(address) = $2',
            ['admin', address]
          );
          req.session.isAdmin = true;
          return isMiddleware ? next() : true;
        }
      } catch (error) {
        console.error('Ошибка при проверке роли в контракте:', error);
      }
    }

    // Если пользователь не администратор
    req.session.isAdmin = false;
    return isMiddleware ? res.status(403).json({ error: 'Недостаточно прав' }) : false;
  } catch (error) {
    console.error('Ошибка при проверке роли:', error);
    return isMiddleware ? res.status(500).json({ error: 'Внутренняя ошибка сервера' }) : false;
  }
};

// Middleware для проверки аутентификации
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  next();
};

// Middleware для проверки прав администратора
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  
  if (!req.session.isAdmin) {
    return res.status(403).json({ error: 'Требуются права администратора' });
  }
  
  next();
};

module.exports = {
  requireRole,
  requireAuth,
  requireAdmin,
  checkRole,
};
