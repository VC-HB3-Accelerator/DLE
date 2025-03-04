const { SiweMessage } = require('siwe');
const { ethers } = require('ethers');
const AccessTokenABI = require('../artifacts/contracts/AccessToken.sol/AccessToken.json').abi;
require('dotenv').config();
const { pool } = require('../db');

// В ethers.js v6.x используется JsonRpcProvider напрямую
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const accessToken = new ethers.Contract(process.env.ACCESS_TOKEN_ADDRESS, AccessTokenABI, provider);

// Проверяем наличие адреса контракта
if (!process.env.ACCESS_TOKEN_ADDRESS) {
  console.error('ACCESS_TOKEN_ADDRESS не указан в .env файле');
}

/**
 * Проверяет подпись сообщения
 * @param {Object} message - Сообщение для проверки
 * @param {string} signature - Подпись сообщения
 * @param {string} address - Адрес кошелька
 * @returns {Promise<boolean>} - Результат проверки
 */
async function verifySignature(message, signature, address) {
  try {
    // Формируем сообщение для проверки
    const domain = message.domain || 'localhost';
    const statement = message.statement || 'Sign in with Ethereum to the app.';
    const uri = message.uri || 'http://localhost:8000';
    const version = message.version || '1';
    const chainId = message.chainId || '1';
    const nonce = message.nonce;

    const messageToVerify = `${domain} wants you to sign in with your Ethereum account:
${address}

${statement}

URI: ${uri}
Version: ${version}
Chain ID: ${chainId}
Nonce: ${nonce}
`;

    // В ethers.js v6.x используется verifyMessage напрямую
    const recoveredAddress = ethers.verifyMessage(messageToVerify, signature);

    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

async function checkAccess(address) {
  // Временная заглушка
  return { hasAccess: false, role: null };
}

async function verifyAndCheckAccess(message, signature, address) {
  // Проверяем подпись
  const verified = await verifySignature(message, signature, address);
  if (!verified) {
    return {
      verified: false,
      access: { hasAccess: false },
    };
  }

  // Проверяем доступ
  const access = await checkAccess(address);

  return {
    verified: true,
    access,
  };
}

// Функция для поиска или создания пользователя
async function findOrCreateUser(identifier, identityType = 'wallet') {
  try {
    // Проверяем, является ли адрес адресом администратора
    const isAdmin = identityType === 'wallet' && 
                    identifier.toLowerCase() === process.env.ADMIN_WALLET_ADDRESS.toLowerCase();
    
    console.log(`Проверка на администратора: ${identifier.toLowerCase()} === ${process.env.ADMIN_WALLET_ADDRESS.toLowerCase()} = ${isAdmin}`);
    
    // Проверяем, существует ли пользователь с таким идентификатором
    const identityResult = await pool.query(
      'SELECT user_id FROM user_identities WHERE identity_type = $1 AND identity_value = $2',
      [identityType, identifier.toLowerCase()]
    );

    let userId;
    let isNewUser = false;

    if (identityResult.rows.length > 0) {
      // Пользователь найден
      userId = identityResult.rows[0].user_id;
      console.log(`Найден существующий пользователь с ID: ${userId}`);
      
      // Обновляем статус администратора, если это необходимо
      if (isAdmin) {
        await pool.query(
          'UPDATE users SET is_admin = true WHERE id = $1',
          [userId]
        );
        console.log(`Обновлен статус администратора для пользователя ${userId}`);
      }
    } else {
      // Создаем нового пользователя с явным указанием всех необходимых полей
      const username = `user_${Date.now()}`;
      
      // Проверяем существование роли USER или ADMIN
      const roleName = isAdmin ? 'ADMIN' : 'USER';
      const roleCheck = await pool.query('SELECT id FROM roles WHERE name = $1', [roleName]);
      let roleId;
      
      if (roleCheck.rows.length > 0) {
        roleId = roleCheck.rows[0].id;
      } else {
        // Если роли нет, создаем её
        const newRole = await pool.query(
          'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id',
          [roleName, isAdmin ? 'Administrator role' : 'Regular user role']
        );
        roleId = newRole.rows[0].id;
      }
      
      // Создаем пользователя с обязательными полями
      const userResult = await pool.query(
        `INSERT INTO users (username, role_id, address, created_at, is_admin) 
         VALUES ($1, $2, $3, NOW(), $4) 
         RETURNING id`,
        [username, roleId, identifier.toLowerCase(), isAdmin]
      );
      
      userId = userResult.rows[0].id;
      isNewUser = true;

      // Создаем запись в таблице идентификаторов
      await pool.query(
        'INSERT INTO user_identities (user_id, identity_type, identity_value, verified, created_at) VALUES ($1, $2, $3, true, NOW())',
        [userId, identityType, identifier.toLowerCase()]
      );

      console.log(`Создан новый пользователь с ID: ${userId}, isAdmin: ${isAdmin}`);
    }

    // Получаем информацию о пользователе
    try {
      const userInfo = await pool.query(
        `SELECT u.id, u.username, u.is_admin, r.name as role
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [userId]
      );

      if (userInfo.rows.length > 0) {
        return userInfo.rows[0];
      }
    } catch (err) {
      console.error('Ошибка при получении информации о пользователе:', err);
    }

    // Если не удалось получить полную информацию, возвращаем базовую
    return {
      id: userId,
      username: isNewUser ? `user_${Date.now()}` : 'unknown',
      is_admin: isAdmin,
      role: isAdmin ? 'ADMIN' : 'USER'
    };
  } catch (error) {
    console.error('Ошибка при поиске/создании пользователя:', error);
    throw error;
  }
}

module.exports = {
  verifyAndCheckAccess,
  verifySignature,
  checkAccess,
  findOrCreateUser
};
