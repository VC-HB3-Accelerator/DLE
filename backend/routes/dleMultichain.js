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

const express = require('express');
const router = express.Router();
const deployParamsService = require('../services/deployParamsService');

/**
 * Получить адрес контракта в указанной сети для мультичейн голосования
 * POST /api/dle-core/get-multichain-contracts
 */
router.post('/get-multichain-contracts', async (req, res) => {
  try {
    const { originalContract, targetChainId } = req.body;
    
    console.log('🔍 [MULTICHAIN] Поиск контракта для мультичейн голосования:', {
      originalContract,
      targetChainId
    });
    
    if (!originalContract || !targetChainId) {
      return res.status(400).json({
        success: false,
        error: 'Не указан originalContract или targetChainId'
      });
    }
    
    // Ищем контракт в указанной сети
    // Для мультичейн контрактов с одинаковым адресом (детерминированный деплой)
    // или контракты в разных сетях с разными адресами
    
    // Сначала проверяем, есть ли контракт с таким же адресом в целевой сети
    const contractsInTargetNetwork = await deployParamsService.getContractsByChainId(targetChainId);
    
    console.log('📊 [MULTICHAIN] Контракты в целевой сети:', contractsInTargetNetwork);
    
    // Ищем контракт в целевой сети (все контракты в targetChainId уже отфильтрованы)
    const targetContract = contractsInTargetNetwork[0]; // Берем первый контракт в целевой сети
    
    if (targetContract) {
      console.log('✅ [MULTICHAIN] Найден контракт в целевой сети:', targetContract.dleAddress);
      
      return res.json({
        success: true,
        contractAddress: targetContract.dleAddress,
        chainId: targetChainId,
        source: 'database'
      });
    }
    
    // Если не найден контракт в целевой сети, проверяем мультичейн развертывание
    // с одинаковым адресом (CREATE2)
    const { ethers } = require('ethers');
    
    // Получаем RPC URL из параметров деплоя
    let rpcUrl;
    try {
      // Получаем последние параметры деплоя
      const latestParams = await deployParamsService.getLatestDeployParams(1);
      if (latestParams.length > 0) {
        const params = latestParams[0];
        const rpcUrls = params.rpcUrls || params.rpc_urls || {};
        rpcUrl = rpcUrls[targetChainId];
      }
      
      // Если не найден в параметрах, используем fallback
      if (!rpcUrl) {
        const fallbackConfigs = {
          '11155111': null,
          '17000': null,
          '421614': null,
          '84532': null
        };
        rpcUrl = fallbackConfigs[targetChainId];
      }
      
      if (!rpcUrl) {
        return res.status(400).json({
          success: false,
          error: `Неподдерживаемая сеть: ${targetChainId}`
        });
      }
    } catch (error) {
      console.error('❌ Ошибка получения RPC URL:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка получения конфигурации сети'
      });
    }
    
    try {
      const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
      const contractCode = await provider.getCode(originalContract);
      
      if (contractCode && contractCode !== '0x') {
        console.log('✅ [MULTICHAIN] Контракт существует в целевой сети с тем же адресом (CREATE2)');
        
        return res.json({
          success: true,
          contractAddress: originalContract,
          chainId: targetChainId,
          source: 'blockchain'
        });
      }
    } catch (blockchainError) {
      console.warn('⚠️ [MULTICHAIN] Ошибка проверки контракта в блокчейне:', blockchainError.message);
    }
    
    // Контракт не найден
    console.log('❌ [MULTICHAIN] Контракт не найден в целевой сети');
    
    return res.json({
      success: false,
      error: 'Контракт не найден в целевой сети'
    });
    
  } catch (error) {
    console.error('❌ [MULTICHAIN] Ошибка поиска мультичейн контракта:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

module.exports = router;