const { ethers } = require('ethers');
require('dotenv').config();
const contractArtifact = require('../artifacts/contracts/MyContract.sol/MyContract.json');
const contractABI = contractArtifact.abi;

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
  accessToken = new ethers.Contract(
    process.env.ACCESS_TOKEN_ADDRESS,
    AccessTokenABI,
    provider
  );
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
      tokenId: activeTokenId.toString()
    };
  } catch (error) {
    console.error('Access check error:', error);
    return { hasAccess: false, role: null };
  }
}

async function checkAdmin(address) {
  try {
    console.log('Проверка прав администратора для адреса:', address);
    // Проверяем, является ли пользователь администратором через смарт-контракт
    const contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      contractABI,
      provider
    );
    
    console.log('Контракт инициализирован:', {
      address: process.env.CONTRACT_ADDRESS,
      provider: provider.connection.url
    });
    
    const isAdmin = await contract.isAdmin(address);
    console.log('Результат проверки из контракта:', isAdmin);
    
    return isAdmin;
  } catch (error) {
    console.error('Ошибка при проверке прав администратора:', error);
    // В случае ошибки возвращаем false вместо выброса исключения
    return false;
  }
}

module.exports = { checkAccess, checkAdmin }; 