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

const { ethers } = require('ethers');
const logger = require('../utils/logger');
const db = require('../db');
const authTokenService = require('./authTokenService');
const rpcProviderService = require('./rpcProviderService');

// Минимальный ABI для ERC20
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)'
];

/**
 * Основной метод проверки роли админа
 * @param {string} address - Адрес кошелька
 * @returns {Promise<boolean>} - Является ли пользователь админом
 */
async function checkAdminRole(address) {
  if (!address) return false;
  logger.info(`Checking admin role for address: ${address}`);
  
  try {
  let foundTokens = false;
  let errorCount = 0;
  const balances = {};
  // Получаем ключ шифрования
  const fs = require('fs');
  const path = require('path');
  let encryptionKey = 'default-key';
  
  try {
    const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
    if (fs.existsSync(keyPath)) {
      encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
    }
  } catch (keyError) {
    console.error('Error reading encryption key:', keyError);
  }

  // Получаем токены и RPC из базы с расшифровкой
  const tokensResult = await db.getQuery()(
    'SELECT id, min_balance, created_at, updated_at, decrypt_text(name_encrypted, $1) as name, decrypt_text(address_encrypted, $1) as address, decrypt_text(network_encrypted, $1) as network FROM auth_tokens',
    [encryptionKey]
  );
  const tokens = tokensResult.rows;

  const rpcProvidersResult = await db.getQuery()(
    'SELECT id, chain_id, created_at, updated_at, decrypt_text(network_id_encrypted, $1) as network_id, decrypt_text(rpc_url_encrypted, $1) as rpc_url FROM rpc_providers',
    [encryptionKey]
  );
  const rpcProviders = rpcProvidersResult.rows;
  
  logger.info(`Retrieved ${tokens.length} tokens and ${rpcProviders.length} RPC providers`);
  logger.info('Tokens:', JSON.stringify(tokens, null, 2));
  logger.info('RPC Providers:', JSON.stringify(rpcProviders, null, 2));
  const rpcMap = {};
  for (const rpc of rpcProviders) {
    rpcMap[rpc.network_id] = rpc.rpc_url;
  }
  const checkPromises = tokens.map(async (token) => {
    try {
      const rpcUrl = rpcMap[token.network];
      if (!rpcUrl) {
        logger.error(`No RPC URL for network ${token.network}`);
        balances[token.network] = 'Error: No RPC URL';
        errorCount++;
        return null;
      }
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      // Проверяем доступность сети с таймаутом
      try {
        const networkCheckPromise = provider.getNetwork();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Network check timeout')), 3000)
        );
        await Promise.race([networkCheckPromise, timeoutPromise]);
      } catch (networkError) {
        logger.error(`Provider for ${token.network} is not available: ${networkError.message}`);
        balances[token.network] = 'Error: Network unavailable';
        errorCount++;
        return null;
      }
      const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const balancePromise = tokenContract.balanceOf(address);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );
      const balance = await Promise.race([balancePromise, timeoutPromise]);
      const formattedBalance = ethers.formatUnits(balance, 18);
      balances[token.network] = formattedBalance;
      logger.info(`Token balance on ${token.network}:`, {
        address,
        contract: token.address,
        balance: formattedBalance,
        minBalance: token.min_balance,
        hasTokens: parseFloat(formattedBalance) >= parseFloat(token.min_balance),
      });
      if (parseFloat(formattedBalance) >= parseFloat(token.min_balance)) {
        logger.info(`Found admin tokens on ${token.network}`);
        foundTokens = true;
      }
      return { network: token.network, balance: formattedBalance };
    } catch (error) {
      logger.error(`Error checking balance in ${token.network}:`, {
        address,
        contract: token.address,
        error: error.message || 'Unknown error',
      });
      balances[token.network] = 'Error';
      errorCount++;
      return null;
    }
  });
  await Promise.all(checkPromises);
  if (errorCount === tokens.length) {
    logger.error(`All network checks for ${address} failed. Cannot verify admin status.`);
    return false;
  }
  if (foundTokens) {
    logger.info(`Admin role summary for ${address}:`, {
      networks: Object.keys(balances).filter(
        (net) => parseFloat(balances[net]) > 0 && balances[net] !== 'Error'
      ),
      balances,
    });
    logger.info(`Admin role granted for ${address}`);
    return true;
  }
  logger.info(`Admin role denied - no tokens found for ${address}`);
  return false;
  } catch (error) {
    logger.error(`Error in checkAdminRole for ${address}:`, error);
    return false;
  }
}

module.exports = { checkAdminRole }; 