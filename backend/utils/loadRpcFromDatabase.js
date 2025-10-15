/**
 * Загрузка RPC URL из базы данных и установка в переменные окружения
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 */

// Убрано - не нужен для загрузки RPC

/**
 * Загружает RPC URL из базы данных и устанавливает их в переменные окружения
 */
async function loadRpcFromDatabase() {
  try {
    console.log('[RPC Loader] Загружаем RPC URL из базы данных...');
    
    // Получаем все RPC провайдеры из базы данных
    const rpcService = require('../services/rpcProviderService');
    const providers = await rpcService.getAllRpcProviders();
    
    if (providers.length === 0) {
      console.warn('[RPC Loader] В базе данных нет RPC провайдеров');
      return;
    }
    
    console.log(`[RPC Loader] Найдено ${providers.length} RPC провайдеров в базе данных`);
    
    // Устанавливаем переменные окружения для каждой сети
    for (const provider of providers) {
      const chainId = provider.chain_id;
      const rpcUrl = provider.rpc_url;
      
      if (!rpcUrl) {
        console.warn(`[RPC Loader] RPC URL не найден для chain_id ${chainId}`);
        continue;
      }
      
      // Устанавливаем переменные окружения в зависимости от chain_id
      switch (chainId) {
        case 1: // Ethereum Mainnet
          process.env.MAINNET_RPC_URL = rpcUrl;
          console.log(`[RPC Loader] Установлен MAINNET_RPC_URL: ${rpcUrl}`);
          break;
        case 11155111: // Sepolia
          process.env.SEPOLIA_RPC_URL = rpcUrl;
          console.log(`[RPC Loader] Установлен SEPOLIA_RPC_URL: ${rpcUrl}`);
          break;
        case 17000: // Holesky
          process.env.HOLESKY_RPC_URL = rpcUrl;
          console.log(`[RPC Loader] Установлен HOLESKY_RPC_URL: ${rpcUrl}`);
          break;
        case 421614: // Arbitrum Sepolia
          process.env.ARBITRUM_SEPOLIA_RPC_URL = rpcUrl;
          console.log(`[RPC Loader] Установлен ARBITRUM_SEPOLIA_RPC_URL: ${rpcUrl}`);
          break;
        case 84532: // Base Sepolia
          process.env.BASE_SEPOLIA_RPC_URL = rpcUrl;
          console.log(`[RPC Loader] Установлен BASE_SEPOLIA_RPC_URL: ${rpcUrl}`);
          break;
        case 42161: // Arbitrum One
          process.env.ARBITRUM_ONE_RPC_URL = rpcUrl;
          console.log(`[RPC Loader] Установлен ARBITRUM_ONE_RPC_URL: ${rpcUrl}`);
          break;
        case 8453: // Base
          process.env.BASE_RPC_URL = rpcUrl;
          console.log(`[RPC Loader] Установлен BASE_RPC_URL: ${rpcUrl}`);
          break;
        case 137: // Polygon
          process.env.POLYGON_RPC_URL = rpcUrl;
          console.log(`[RPC Loader] Установлен POLYGON_RPC_URL: ${rpcUrl}`);
          break;
        case 56: // BSC
          process.env.BSC_RPC_URL = rpcUrl;
          console.log(`[RPC Loader] Установлен BSC_RPC_URL: ${rpcUrl}`);
          break;
        default:
          console.log(`[RPC Loader] Неизвестный chain_id ${chainId}, пропускаем`);
      }
    }
    
    console.log('[RPC Loader] ✅ RPC URL успешно загружены из базы данных');
    
  } catch (error) {
    console.error('[RPC Loader] ❌ Ошибка загрузки RPC URL из базы данных:', error);
    throw error;
  }
}

module.exports = { loadRpcFromDatabase };
