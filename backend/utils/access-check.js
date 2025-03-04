const { ethers } = require('ethers');
require('dotenv').config();
const db = require('../db');
const contractArtifact = require('../artifacts/contracts/MyContract.sol/MyContract.json');
const contractABI = contractArtifact.abi;
const logger = require('./logger');
const { getContract } = require('./contracts');

// Проверяем наличие необходимых переменных окружения
if (!process.env.ACCESS_TOKEN_ADDRESS) {
  console.error('ACCESS_TOKEN_ADDRESS не указан в .env файле');
}

if (!process.env.ETHEREUM_NETWORK_URL) {
  console.error('ETHEREUM_NETWORK_URL не указан в .env файле');
}

// Подключение к контракту
const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_NETWORK_URL);
let accessToken;

try {
  const AccessTokenABI = require('../artifacts/contracts/AccessToken.sol/AccessToken.json').abi;
  accessToken = new ethers.Contract(process.env.ACCESS_TOKEN_ADDRESS, AccessTokenABI, provider);
} catch (error) {
  console.error('Ошибка инициализации контракта AccessToken:', error);
}

/**
 * Проверяет доступ и роль пользователя
 * @param {string} address - Ethereum адрес пользователя
 * @returns {Promise<{hasAccess: boolean, role: string|null}>}
 */
async function checkAccess(address) {
  try {
    if (!address || !accessToken) {
      return { hasAccess: false, role: null };
    }

    // Проверяем активный токен
    const activeTokenId = await accessToken.activeTokens(address);
    if (activeTokenId.toString() === '0') {
      return { hasAccess: false, role: null };
    }

    // Получаем роль
    const roleId = await accessToken.checkRole(address);
    const roles = ['ADMIN', 'MODERATOR', 'SUPPORT'];
    const role = roles[roleId];

    return {
      hasAccess: true,
      role,
      tokenId: activeTokenId.toString(),
    };
  } catch (error) {
    console.error('Access check error:', error);
    return { hasAccess: false, role: null };
  }
}

// Функция для проверки, является ли пользователь администратором
async function checkIfAdmin(address) {
  try {
    console.log('Проверка прав администратора для адреса:', address);

    // Проверяем в базе данных
    const result = await db.query('SELECT is_admin FROM users WHERE address = $1', [address]);

    if (result.rows.length === 0) {
      console.log(`Пользователь с адресом ${address} не найден в базе данных`);
      return false;
    }

    const isAdmin = result.rows[0].is_admin;
    console.log(`Пользователь с адресом ${address} имеет статус администратора:`, isAdmin);

    return isAdmin;
  } catch (error) {
    console.error('Ошибка при проверке прав администратора:', error);
    return false;
  }
}

/**
 * Проверяет баланс токенов пользователя и обновляет его роль
 * @param {string} address - Адрес кошелька пользователя
 * @returns {Promise<boolean>} - Имеет ли пользователь права администратора
 */
async function checkTokenBalanceAndUpdateRole(address) {
  try {
    // Получение контракта токенов
    const accessTokenContract = await getContract('AccessToken');
    
    // Проверка баланса
    const balance = await accessTokenContract.balanceOf(address);
    
    // Минимальное количество токенов для прав администратора
    const minTokens = ethers.utils.parseUnits(process.env.MIN_ADMIN_TOKENS || "1", 18);
    
    const isAdmin = balance.gte(minTokens);
    
    // Получение ID пользователя по адресу кошелька
    const userResult = await db.query(`
      SELECT u.id FROM users u
      JOIN user_identities ui ON u.id = ui.user_id
      WHERE ui.identity_type = 'wallet' AND ui.identity_value = $1
    `, [address.toLowerCase()]);
    
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      
      // Получение ID роли
      const roleResult = await db.query(
        'SELECT id FROM roles WHERE name = $1',
        [isAdmin ? 'admin' : 'user']
      );
      
      if (roleResult.rows.length > 0) {
        const roleId = roleResult.rows[0].id;
        
        // Обновление роли пользователя
        await db.query(
          'UPDATE users SET role_id = $1, last_token_check = NOW() WHERE id = $2',
          [roleId, userId]
        );
        
        logger.info(`Updated user ${userId} role to ${isAdmin ? 'admin' : 'user'} based on token balance`);
      }
    }
    
    return isAdmin;
  } catch (error) {
    logger.error(`Error checking token balance for ${address}: ${error.message}`);
    return false;
  }
}

/**
 * Получает информацию о пользователе, включая его роль
 * @param {number} userId - ID пользователя
 * @returns {Promise<Object>} - Информация о пользователе
 */
async function getUserInfo(userId) {
  try {
    const result = await db.query(`
      SELECT u.id, u.username, u.preferred_language, r.name as role
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error(`Error getting user info for ${userId}: ${error.message}`);
    return null;
  }
}

/**
 * Запускает проверку токенов для всех пользователей
 */
async function checkAllUsersTokens() {
  try {
    // Получение всех пользователей с кошельками
    const walletUsers = await db.query(`
      SELECT u.id, ui.identity_value as address 
      FROM users u
      JOIN user_identities ui ON u.id = ui.user_id
      WHERE ui.identity_type = 'wallet'
    `);
    
    logger.info(`Checking token balances for ${walletUsers.rows.length} users`);
    
    for (const user of walletUsers.rows) {
      // Проверка баланса токенов
      const hasTokens = await checkTokenBalanceAndUpdateRole(user.address);
      
      logger.info(`User ${user.id} with address ${user.address}: admin=${hasTokens}`);
    }
  } catch (error) {
    logger.error(`Error checking token balances: ${error.message}`);
  }
}

module.exports = {
  checkAccess,
  checkIfAdmin,
  checkTokenBalanceAndUpdateRole,
  getUserInfo,
  checkAllUsersTokens
};
