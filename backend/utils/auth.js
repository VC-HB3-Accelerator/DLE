const { ethers } = require('ethers');
const db = require('../db');
const logger = require('./logger');
const authService = require('../services/auth-service');
const { USER_ROLES, IDENTITY_TYPES } = require('./constants');

// Инициализация провайдера
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_ETH);

/**
 * Проверяет подпись сообщения
 * @param {string} nonce - Nonce для проверки
 * @param {string} signature - Подпись
 * @param {string} address - Адрес кошелька
 * @returns {Promise<boolean>} - Результат проверки
 */
async function verifySignature(nonce, signature, address) {
  try {
    // Создаем сообщение для проверки
    const message = `Подпишите это сообщение для аутентификации в DApp for Business. Nonce: ${nonce}`;
    
    // Восстанавливаем адрес из подписи
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    // Сравниваем адреса (приводим к нижнему регистру для надежности)
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Проверяет, является ли пользователь администратором
 * @param {string} address - Адрес кошелька
 * @returns {Promise<boolean>} - Является ли пользователь администратором
 */
async function checkUserRole(address) {
  try {
    // Проверяем наличие токенов администратора
    const isAdmin = await authService.checkAdminTokens(address);
    return isAdmin;
  } catch (error) {
    console.error('Error checking user role:', error);
    return false;
  }
}

/**
 * Проверяет доступ пользователя
 * @param {string} walletAddress - Адрес кошелька
 * @returns {Promise<Object>} - Информация о доступе
 */
async function checkAccess(walletAddress) {
  try {
    // Проверяем наличие токенов администратора
    const isAdmin = await authService.checkAdminTokens(walletAddress);
    
    // Получаем или создаем пользователя
    const userId = await findOrCreateUser(walletAddress);
    
    return {
      userId,
      isAdmin,
      hasAccess: true
    };
  } catch (error) {
    logger.error(`Error checking access: ${error.message}`);
    return {
      hasAccess: false,
      error: error.message
    };
  }
}

/**
 * Находит или создает пользователя по адресу кошелька
 * @param {string} address - Адрес кошелька
 * @returns {Promise<Object>} - ID пользователя и роль
 */
async function findOrCreateUser(address) {
  try {
    if (!address) {
      throw new Error('Address is required');
    }

    const normalizedAddress = address.toLowerCase();

    // Сначала проверяем в таблице users
    const userResult = await db.query(
      'SELECT id FROM users WHERE LOWER(address) = $1',
      [normalizedAddress]
    );

    let userId;
    let isAdmin = false;

    if (userResult.rows.length === 0) {
      // Если пользователь не найден, создаем его
      const roleResult = await db.query('SELECT id FROM roles WHERE name = $1', ['user']);
      if (roleResult.rows.length === 0) {
        throw new Error('Role "user" not found');
      }
      const roleId = roleResult.rows[0].id;

      // Создаем пользователя
      const newUserResult = await db.query(
        'INSERT INTO users (address, role_id, created_at) VALUES ($1, $2, NOW()) RETURNING id',
        [normalizedAddress, roleId]
      );

      userId = newUserResult.rows[0].id;

      // Добавляем идентификатор кошелька
      await db.query(
        'INSERT INTO user_identities (user_id, identity_type, identity_value, created_at) VALUES ($1, $2, $3, NOW())',
        [userId, 'wallet', normalizedAddress]
      );
    } else {
      userId = userResult.rows[0].id;
    }

    // Проверяем, является ли пользователь администратором
    isAdmin = await checkUserRole(normalizedAddress);

    // Обновляем роль пользователя
    const roleNameToSet = isAdmin ? 'admin' : 'user';
    const roleToSetResult = await db.query('SELECT id FROM roles WHERE name = $1', [roleNameToSet]);
    if (roleToSetResult.rows.length > 0) {
      const roleIdToSet = roleToSetResult.rows[0].id;
      await db.query('UPDATE users SET role_id = $1 WHERE id = $2', [roleIdToSet, userId]);
    }

    return { userId, isAdmin };
  } catch (error) {
    console.error('Error finding or creating user:', error);
    throw error;
  }
}

module.exports = {
  verifySignature,
  checkAccess,
  findOrCreateUser,
  checkUserRole
}; 