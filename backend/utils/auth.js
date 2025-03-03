const { SiweMessage } = require('siwe');
const { ethers } = require('ethers');
const AccessTokenABI = require('../artifacts/contracts/AccessToken.sol/AccessToken.json').abi;
require('dotenv').config();

const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_NETWORK_URL);
const accessToken = new ethers.Contract(
  process.env.ACCESS_TOKEN_ADDRESS,
  AccessTokenABI,
  provider
);

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
    const domain = message.domain || window.location.host;
    const statement = message.statement || 'Sign in with Ethereum to the app.';
    const uri = message.uri || window.location.origin;
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
    
    // Восстанавливаем адрес из подписи
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
      access: { hasAccess: false }
    };
  }

  // Проверяем доступ
  const access = await checkAccess(address);
  
  return {
    verified: true,
    access
  };
}

module.exports = {
  verifyAndCheckAccess,
  verifySignature,
  checkAccess
}; 