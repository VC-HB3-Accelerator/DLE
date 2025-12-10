/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
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
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  // Получаем токены и RPC с расшифровкой (с таймаутом)
  let tokensResult;
  try {
    const queryPromise = db.getQuery()(
      'SELECT id, min_balance, readonly_threshold, editor_threshold, created_at, updated_at, decrypt_text(name_encrypted, $1) as name, decrypt_text(address_encrypted, $1) as address, decrypt_text(network_encrypted, $1) as network FROM auth_tokens',
      [encryptionKey]
    );
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database query timeout')), 30000)
    );
    tokensResult = await Promise.race([queryPromise, timeoutPromise]);
  } catch (error) {
    logger.error('[tokenBalanceService] Ошибка получения токенов из БД:', error.message);
    return []; // Возвращаем пустой массив при ошибке БД
  }
  const tokens = tokensResult.rows;

  // Убрано - используем rpcService вместо прямого запроса к БД
  // Используем правильный RPC URL из базы данных
  const rpcService = require('./rpcProviderService');

  const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)'];
  const results = [];

  // Получаем все RPC провайдеры из базы данных для маппинга
  const allRpcProviders = await rpcService.getAllRpcProviders();
  const networkToChainId = {};
  
  // Создаем маппинг из базы данных
  for (const provider of allRpcProviders) {
    if (provider.network_id) {
      networkToChainId[provider.network_id] = provider.chain_id;
    }
  }

  for (const token of tokens) {
    // Получаем chain_id из названия сети из базы данных
    const chainId = networkToChainId[token.network];
    if (!chainId) {
      logger.warn(`[tokenBalanceService] Неизвестная сеть: ${token.network}`);
      continue;
    }
    
    logger.info(`[tokenBalanceService] Ищем RPC для token.network: ${token.network} (chainId: ${chainId})`);
    const rpcUrl = await rpcService.getRpcUrlByChainId(chainId);
    if (!rpcUrl) {
      logger.warn(`[tokenBalanceService] RPC URL не найден для сети ${token.network} (chainId: ${chainId})`);
      // Пропускаем токен, если нет RPC URL
      results.push({
        network: token.network,
        tokenAddress: token.address,
        tokenName: token.name,
        symbol: token.symbol || '',
        balance: '0',
        minBalance: token.min_balance,
        readonlyThreshold: token.readonly_threshold,
        editorThreshold: token.editor_threshold,
        error: 'RPC URL не настроен'
      });
      continue;
    }
    logger.info(`[tokenBalanceService] Найден RPC URL: ${rpcUrl}`);
    
    // Создаем провайдер с таймаутом
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      polling: false,
      staticNetwork: true
    });
    
    // Устанавливаем таймаут для запросов
    provider._getConnection().timeout = 10000; // 10 секунд
    
    const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
    let balance = '0';
    
    try {
      logger.info(`[tokenBalanceService] Получение баланса для ${token.name} (${token.address}) в сети ${token.network} для адреса ${address}`);
      
      // Создаем промис с таймаутом
      const balancePromise = tokenContract.balanceOf(address);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const rawBalance = await Promise.race([balancePromise, timeoutPromise]);
      balance = ethers.formatUnits(rawBalance, 18);
      
      if (!balance || isNaN(Number(balance))) balance = '0';
      
      logger.info(`[tokenBalanceService] Баланс получен для ${token.name}: ${balance}`);
    } catch (e) {
      logger.error(
        `[tokenBalanceService] Ошибка получения баланса для ${token.name} (${token.address}) в сети ${token.network}:`,
        e.message || e
      );
      
      // Проверяем тип ошибки для лучшей диагностики
      const errorMessage = e.message || e.toString();
      let errorType = 'Неизвестная ошибка';
      
      if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
        errorType = 'Таймаут соединения - возможно, нужен VPN';
      } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
        errorType = 'Не удается подключиться к RPC провайдеру';
      } else if (errorMessage.includes('NETWORK_ERROR')) {
        errorType = 'Ошибка сети - проверьте интернет-соединение';
      }
      
      balance = '0';
      
      // Добавляем информацию об ошибке в результат
      results.push({
        network: token.network,
        tokenAddress: token.address,
        tokenName: token.name,
        symbol: token.symbol || '',
        balance,
        minBalance: token.min_balance,
        readonlyThreshold: token.readonly_threshold,
        editorThreshold: token.editor_threshold,
        error: errorType,
        errorDetails: errorMessage
      });
      continue;
    }
    
    // Добавляем успешный результат
    results.push({
      network: token.network,
      tokenAddress: token.address,
      tokenName: token.name,
      symbol: token.symbol || '',
      balance,
      minBalance: token.min_balance,
      readonlyThreshold: token.readonly_threshold,
      editorThreshold: token.editor_threshold,
    });
  }

  // Преобразуем в обычный массив для корректной сериализации
  return JSON.parse(JSON.stringify(results));
}

module.exports = { getUserTokenBalances };


