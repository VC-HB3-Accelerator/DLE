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

const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const rpcProviderService = require('../services/rpcProviderService');

// Получить поддерживаемые сети
router.post('/get-supported-chains', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Multichain] Получение поддерживаемых сетей для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function listSupportedChains() external view returns (uint256[] memory)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем поддерживаемые сети
    const supportedChains = await dle.listSupportedChains();

    console.log(`[DLE Multichain] Поддерживаемые сети:`, supportedChains);

    res.json({
      success: true,
      data: {
        chains: supportedChains.map(chainId => Number(chainId))
      }
    });

  } catch (error) {
    console.error('[DLE Multichain] Ошибка при получении поддерживаемых сетей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении поддерживаемых сетей: ' + error.message
    });
  }
});

// Проверить поддержку сети
router.post('/is-chain-supported', async (req, res) => {
  try {
    const { dleAddress, chainId } = req.body;
    
    if (!dleAddress || chainId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и ID сети обязательны'
      });
    }

    console.log(`[DLE Multichain] Проверка поддержки сети ${chainId} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function isChainSupported(uint256 _chainId) external view returns (bool)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Проверяем поддержку сети
    const isSupported = await dle.isChainSupported(chainId);

    console.log(`[DLE Multichain] Поддержка сети ${chainId}: ${isSupported}`);

    res.json({
      success: true,
      data: {
        chainId: Number(chainId),
        isSupported: isSupported
      }
    });

  } catch (error) {
    console.error('[DLE Multichain] Ошибка при проверке поддержки сети:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке поддержки сети: ' + error.message
    });
  }
});

// Получить количество поддерживаемых сетей
router.post('/get-supported-chain-count', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Multichain] Получение количества поддерживаемых сетей для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getSupportedChainCount() external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем количество поддерживаемых сетей
    const count = await dle.getSupportedChainCount();

    console.log(`[DLE Multichain] Количество поддерживаемых сетей: ${count}`);

    res.json({
      success: true,
      data: {
        count: Number(count)
      }
    });

  } catch (error) {
    console.error('[DLE Multichain] Ошибка при получении количества поддерживаемых сетей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении количества поддерживаемых сетей: ' + error.message
    });
  }
});

// Получить ID сети по индексу
router.post('/get-supported-chain-id', async (req, res) => {
  try {
    const { dleAddress, index } = req.body;
    
    if (!dleAddress || index === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и индекс обязательны'
      });
    }

    console.log(`[DLE Multichain] Получение ID сети по индексу ${index} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getSupportedChainId(uint256 _index) external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем ID сети по индексу
    const chainId = await dle.getSupportedChainId(index);

    console.log(`[DLE Multichain] ID сети по индексу ${index}: ${chainId}`);

    res.json({
      success: true,
      data: {
        index: Number(index),
        chainId: Number(chainId)
      }
    });

  } catch (error) {
    console.error('[DLE Multichain] Ошибка при получении ID сети по индексу:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении ID сети по индексу: ' + error.message
    });
  }
});

// Проверить подключение к сети
router.post('/check-chain-connection', async (req, res) => {
  try {
    const { dleAddress, chainId } = req.body;
    
    if (!dleAddress || chainId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и ID сети обязательны'
      });
    }

    console.log(`[DLE Multichain] Проверка подключения к сети ${chainId} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function checkChainConnection(uint256 _chainId) external view returns (bool)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Проверяем подключение к сети
    const isAvailable = await dle.checkChainConnection(chainId);

    console.log(`[DLE Multichain] Подключение к сети ${chainId}: ${isAvailable}`);

    res.json({
      success: true,
      data: {
        chainId: Number(chainId),
        isAvailable: isAvailable
      }
    });

  } catch (error) {
    console.error('[DLE Multichain] Ошибка при проверке подключения к сети:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке подключения к сети: ' + error.message
    });
  }
});

// Проверить готовность к синхронизации
router.post('/check-sync-readiness', async (req, res) => {
  try {
    const { dleAddress, proposalId } = req.body;
    
    if (!dleAddress || proposalId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и ID предложения обязательны'
      });
    }

    console.log(`[DLE Multichain] Проверка готовности к синхронизации предложения ${proposalId} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function checkSyncReadiness(uint256 _proposalId) external view returns (bool)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Проверяем готовность к синхронизации
    const allChainsReady = await dle.checkSyncReadiness(proposalId);

    console.log(`[DLE Multichain] Готовность к синхронизации предложения ${proposalId}: ${allChainsReady}`);

    res.json({
      success: true,
      data: {
        proposalId: Number(proposalId),
        allChainsReady: allChainsReady
      }
    });

  } catch (error) {
    console.error('[DLE Multichain] Ошибка при проверке готовности к синхронизации:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке готовности к синхронизации: ' + error.message
    });
  }
});

// Синхронизировать во все сети
router.post('/sync-to-all-chains', async (req, res) => {
  try {
    const { dleAddress, proposalId, userAddress, privateKey } = req.body;
    
    if (!dleAddress || proposalId === undefined || !userAddress || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны, включая приватный ключ'
      });
    }

    console.log(`[DLE Multichain] Синхронизация предложения ${proposalId} во все сети для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    const dleAbi = [
      "function syncToAllChains(uint256 _proposalId) external"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, wallet);

    // Синхронизируем во все сети
    const tx = await dle.syncToAllChains(proposalId);
    const receipt = await tx.wait();

    console.log(`[DLE Multichain] Синхронизация выполнена:`, receipt);

    res.json({
      success: true,
      data: {
        transactionHash: receipt.hash
      }
    });

  } catch (error) {
    console.error('[DLE Multichain] Ошибка при синхронизации во все сети:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при синхронизации во все сети: ' + error.message
    });
  }
});

// Исполнить предложение по подписям
router.post('/execute-proposal-by-signatures', async (req, res) => {
  try {
    const { dleAddress, proposalId, signatures, userAddress, privateKey } = req.body;
    
    if (!dleAddress || proposalId === undefined || !signatures || !userAddress || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны, включая приватный ключ'
      });
    }

    console.log(`[DLE Multichain] Исполнение предложения ${proposalId} по подписям для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    const dleAbi = [
      "function executeProposalBySignatures(uint256 _proposalId, bytes[] calldata _signatures) external"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, wallet);

    // Исполняем предложение по подписям
    const tx = await dle.executeProposalBySignatures(proposalId, signatures);
    const receipt = await tx.wait();

    console.log(`[DLE Multichain] Предложение исполнено по подписям:`, receipt);

    res.json({
      success: true,
      data: {
        transactionHash: receipt.hash
      }
    });

  } catch (error) {
    console.error('[DLE Multichain] Ошибка при исполнении предложения по подписям:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при исполнении предложения по подписям: ' + error.message
    });
  }
});

module.exports = router;
