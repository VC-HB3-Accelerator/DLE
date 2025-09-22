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
 * Сервис получения балансов токенов пользователя из БД и RPC
 */

const { ethers } = require('ethers');
const db = require('../db');
const logger = require('../utils/logger');

async function getUserTokenBalances(address) {
  if (!address) return [];

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

  // Получаем токены и RPC с расшифровкой
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
  const rpcMap = {};
  for (const rpc of rpcProviders) {
    rpcMap[rpc.network_id] = rpc.rpc_url;
  }

  const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)'];
  const results = [];

  for (const token of tokens) {
    const rpcUrl = rpcMap[token.network];
    if (!rpcUrl) continue;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
    let balance = '0';
    try {
      const rawBalance = await tokenContract.balanceOf(address);
      balance = ethers.formatUnits(rawBalance, 18);
      if (!balance || isNaN(Number(balance))) balance = '0';
    } catch (e) {
      logger.error(
        `[tokenBalanceService] Ошибка получения баланса для ${token.name} (${token.address}) в сети ${token.network}:`,
        e
      );
      balance = '0';
    }
    results.push({
      network: token.network,
      tokenAddress: token.address,
      tokenName: token.name,
      symbol: token.symbol || '',
      balance,
      minBalance: token.min_balance,
    });
  }

  return results;
}

module.exports = { getUserTokenBalances };


