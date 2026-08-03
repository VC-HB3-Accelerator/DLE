/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
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
const { ethers } = require('ethers');
const { DLE_GET_DLE_INFO, DLE_GET_CURRENT_CHAIN_ID } = require('../constants/dleReadAbi');
const {
  fetchGovernanceParams,
  ReaderNotFoundError,
} = require('../services/dleReaderResolveService');
const { resolveDleProvider } = require('../services/dleNetworkResolveService');

// Чтение данных DLE из блокчейна
router.post('/read-dle-info', async (req, res) => {
  try {
    const { dleAddress, chainId: preferChainId } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Core] Чтение данных DLE из блокчейна: ${dleAddress}`);

    let provider, targetChainId;
    try {
      ({ provider, chainId: targetChainId } = await resolveDleProvider(dleAddress, {
        preferChainId,
      }));
    } catch (e) {
      return res.status(500).json({
        success: false,
        error: e.message || 'Не удалось найти сеть, где по адресу есть контракт',
        code: e.code,
      });
    }

    // ABI для чтения данных DLE (единый модуль dleReadAbi)
    const dleAbi = [
      DLE_GET_DLE_INFO,
      "function totalSupply() external view returns (uint256)",
      "function balanceOf(address account) external view returns (uint256)",
      "function quorumPercentage() external view returns (uint256)",
      DLE_GET_CURRENT_CHAIN_ID,
      "function logoURI() external view returns (string memory)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Читаем данные DLE
    const dleInfo = await dle.getDLEInfo();
    const totalSupply = await dle.totalSupply();
    const quorumPercentage = await dle.quorumPercentage();
    const currentChainId = await dle.getCurrentChainId();
    
    // Читаем логотип
    let logoURI = '';
    try {
      logoURI = await dle.logoURI();
    } catch (error) {
      console.log(`[DLE Core] Ошибка при чтении logoURI:`, error.message);
    }

    // Получаем информацию о партнерах из блокчейна
    const partnerBalances = [];
    let participantCount = 0;

    // Получаем события InitialTokensDistributed для определения партнеров
    try {
      // Получаем последние блоки для поиска событий
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000); // Ищем в последних 10000 блоках
      
      // ABI для события InitialTokensDistributed
      const eventAbi = [
        "event InitialTokensDistributed(address[] partners, uint256[] amounts)"
      ];
      
      const dleWithEvents = new ethers.Contract(dleAddress, [...dleAbi, ...eventAbi], provider);
      
      // Ищем события InitialTokensDistributed
      const events = await dleWithEvents.queryFilter(
        dleWithEvents.filters.InitialTokensDistributed(),
        fromBlock,
        currentBlock
      );
      
      if (events.length > 0) {
        // Берем последнее событие
        const lastEvent = events[events.length - 1];
        const partners = lastEvent.args.partners;
        const amounts = lastEvent.args.amounts;
        
        for (let i = 0; i < partners.length; i++) {
          const partnerAddress = partners[i];
          const amount = amounts[i];
          
          // Проверяем текущий баланс
          const currentBalance = await dle.balanceOf(partnerAddress);
          if (Number(currentBalance) > 0) {
            participantCount++;
            partnerBalances.push({
              address: partnerAddress,
              balance: ethers.formatUnits(currentBalance, 18),
              percentage: (Number(currentBalance) / Number(totalSupply)) * 100,
              initialAmount: ethers.formatUnits(amount, 18)
            });
          }
        }
      }
    } catch (error) {
      console.log(`[DLE Core] Ошибка при получении событий партнеров:`, error.message);
      
      // Fallback: ищем держателей токенов через события Transfer
      try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 10000);
        
        const transferEventAbi = [
          "event Transfer(address indexed from, address indexed to, uint256 value)"
        ];
        
        const dleWithTransferEvents = new ethers.Contract(dleAddress, [...dleAbi, ...transferEventAbi], provider);
        
        // Ищем события Transfer с from = address(0) (mint события)
        const mintEvents = await dleWithTransferEvents.queryFilter(
          dleWithTransferEvents.filters.Transfer(ethers.ZeroAddress),
          fromBlock,
          currentBlock
        );
        
        const uniqueRecipients = new Set();
        for (const event of mintEvents) {
          uniqueRecipients.add(event.args.to);
        }
        
        // Проверяем текущие балансы всех получателей
        for (const recipient of uniqueRecipients) {
          const balance = await dle.balanceOf(recipient);
          if (Number(balance) > 0) {
            participantCount++;
            partnerBalances.push({
              address: recipient,
              balance: ethers.formatUnits(balance, 18),
              percentage: (Number(balance) / Number(totalSupply)) * 100
            });
          }
        }
      } catch (fallbackError) {
        console.log(`[DLE Core] Ошибка при fallback поиске партнеров:`, fallbackError.message);
      }
    }

    const blockchainData = {
      name: dleInfo.name,
      symbol: dleInfo.symbol,
      dleAddress: dleAddress, // Добавляем адрес контракта
      location: dleInfo.location,
      coordinates: dleInfo.coordinates,
      jurisdiction: Number(dleInfo.jurisdiction),
      okvedCodes: dleInfo.okvedCodes,
      kpp: Number(dleInfo.kpp),
      creationTimestamp: Number(dleInfo.creationTimestamp),
      isActive: dleInfo.isActive,
      totalSupply: ethers.formatUnits(totalSupply, 18),
      partnerBalances: partnerBalances, // Информация о партнерах и их балансах
      logoURI: logoURI, // URL логотипа токена
      quorumPercentage: Number(quorumPercentage),
      currentChainId: Number(currentChainId),
      participantCount: participantCount
    };

    console.log(`[DLE Core] Данные DLE прочитаны из блокчейна:`, blockchainData);

    res.json({
      success: true,
      data: blockchainData
    });

  } catch (error) {
    console.error('[DLE Core] Ошибка при чтении данных DLE из блокчейна:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при чтении данных из блокчейна: ' + error.message
    });
  }
});

// Получить параметры управления (через DLEReader)
router.post('/get-governance-params', async (req, res) => {
  try {
    const { dleAddress, chainId: preferChainId } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Core] Получение параметров управления для DLE: ${dleAddress}`);

    let provider, targetChainId;
    try {
      ({ provider, chainId: targetChainId } = await resolveDleProvider(dleAddress, {
        preferChainId,
      }));
    } catch (e) {
      return res.status(500).json({
        success: false,
        error: e.message || 'Не удалось найти сеть, где по адресу есть контракт',
        code: e.code,
      });
    }

    const params = await fetchGovernanceParams({
      dleAddress,
      provider,
      chainId: targetChainId,
    });

    console.log(`[DLE Core] Параметры управления (Reader ${params.readerAddress}):`, params);

    res.json({
      success: true,
      data: {
        quorumPct: params.quorumPct,
        chainId: params.chainId,
        supportedCount: params.supportedCount,
        totalSupply: params.totalSupply?.toString?.() ?? String(params.totalSupply),
        proposalsCount: params.proposalsCount,
        readerAddress: params.readerAddress,
      }
    });

  } catch (error) {
    console.error('[DLE Core] Ошибка при получении параметров управления:', error);
    const status = error instanceof ReaderNotFoundError ? 404 : 500;
    res.status(status).json({
      success: false,
      error: 'Ошибка при получении параметров управления: ' + error.message,
      code: error.code || undefined,
    });
  }
});

// Проверить активность DLE
router.post('/is-active', async (req, res) => {
  try {
    const { dleAddress, chainId: preferChainId } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Core] Проверка активности DLE: ${dleAddress}`);

    const { provider } = await resolveDleProvider(dleAddress, { preferChainId });
    
    const dleAbi = [
      "function isActive() external view returns (bool)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Проверяем активность DLE
    const isActive = await dle.isActive();

    console.log(`[DLE Core] Активность DLE: ${isActive}`);

    res.json({
      success: true,
      data: {
        isActive: isActive
      }
    });

  } catch (error) {
    console.error('[DLE Core] Ошибка при проверке активности DLE:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке активности DLE: ' + error.message
    });
  }
});

// Проверка возможности деактивации DLE
router.post('/deactivate-dle', async (req, res) => {
  try {
    const { dleAddress, userAddress, chainId: preferChainId } = req.body;
    
    if (!dleAddress || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и адрес пользователя обязательны'
      });
    }

    console.log(`[DLE Core] Проверка возможности деактивации DLE: ${dleAddress} пользователем: ${userAddress}`);

    const { provider } = await resolveDleProvider(dleAddress, { preferChainId });
    
    // ABI для проверки деактивации DLE
    const dleAbi = [
      "function isActive() external view returns (bool)",
      "function balanceOf(address) external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Проверяем, что пользователь имеет токены
    const balance = await dle.balanceOf(userAddress);
    if (balance <= 0) {
      return res.status(403).json({
        success: false,
        error: 'Для деактивации DLE необходимо иметь токены'
      });
    }

    // Проверяем текущий статус
    const isActive = await dle.isActive();
    if (!isActive) {
      return res.status(400).json({
        success: false,
        error: 'DLE уже деактивирован'
      });
    }

    console.log(`[DLE Core] DLE ${dleAddress} может быть деактивирован пользователем ${userAddress}`);

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        canDeactivate: true,
        message: 'DLE может быть деактивирован при наличии валидного предложения с кворумом.'
      }
    });

  } catch (error) {
    console.error('[DLE Core] Ошибка при проверке возможности деактивации DLE:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке возможности деактивации DLE: ' + error.message
    });
  }
});

module.exports = router;
