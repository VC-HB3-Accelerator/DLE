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

// Чтение данных DLE из блокчейна
router.post('/read-dle-info', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Core] Чтение данных DLE из блокчейна: ${dleAddress}`);

    // Получаем RPC URL для Sepolia
    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // ABI для чтения данных DLE
    const dleAbi = [
      "function getDLEInfo() external view returns (tuple(string name, string symbol, string location, string coordinates, uint256 jurisdiction, uint256 oktmo, string[] okvedCodes, uint256 kpp, uint256 creationTimestamp, bool isActive))",
      "function totalSupply() external view returns (uint256)",
      "function balanceOf(address account) external view returns (uint256)",
      "function quorumPercentage() external view returns (uint256)",
      "function getCurrentChainId() external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Читаем данные DLE
    const dleInfo = await dle.getDLEInfo();
    const totalSupply = await dle.totalSupply();
    const quorumPercentage = await dle.quorumPercentage();
    const currentChainId = await dle.getCurrentChainId();

    // Проверяем баланс создателя (адрес, который деплоил контракт)
    const deployer = "0xF45aa4917b3775bA37f48Aeb3dc1a943561e9e0B";
    const deployerBalance = await dle.balanceOf(deployer);

    // Определяем количество участников (держателей токенов)
    let participantCount = 0;
    if (deployerBalance > 0) {
      participantCount++;
    }

    // Проверяем, есть ли другие держатели токенов
    // Для простоты считаем, что если создатель имеет меньше 100% токенов, то есть другие участники
    const deployerPercentage = (Number(deployerBalance) / Number(totalSupply)) * 100;
    if (deployerPercentage < 100) {
      participantCount = Math.max(participantCount, 2); // Минимум 2 участника
    }

    const blockchainData = {
      name: dleInfo.name,
      symbol: dleInfo.symbol,
      dleAddress: dleAddress, // Добавляем адрес контракта
      location: dleInfo.location,
      coordinates: dleInfo.coordinates,
      jurisdiction: Number(dleInfo.jurisdiction),
      oktmo: Number(dleInfo.oktmo),
      okvedCodes: dleInfo.okvedCodes,
      kpp: Number(dleInfo.kpp),
      creationTimestamp: Number(dleInfo.creationTimestamp),
      isActive: dleInfo.isActive,
      totalSupply: ethers.formatUnits(totalSupply, 18),
      deployerBalance: ethers.formatUnits(deployerBalance, 18),
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

// Получить параметры управления
router.post('/get-governance-params', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Core] Получение параметров управления для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getGovernanceParams() external view returns (uint256 quorumPct, uint256 chainId, uint256 supportedCount)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем параметры управления
    const params = await dle.getGovernanceParams();

    console.log(`[DLE Core] Параметры управления:`, params);

    res.json({
      success: true,
      data: {
        quorumPct: Number(params.quorumPct),
        chainId: Number(params.chainId),
        supportedCount: Number(params.supportedCount)
      }
    });

  } catch (error) {
    console.error('[DLE Core] Ошибка при получении параметров управления:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении параметров управления: ' + error.message
    });
  }
});

// Проверить активность DLE
router.post('/is-active', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Core] Проверка активности DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
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
    const { dleAddress, userAddress } = req.body;
    
    if (!dleAddress || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и адрес пользователя обязательны'
      });
    }

    console.log(`[DLE Core] Проверка возможности деактивации DLE: ${dleAddress} пользователем: ${userAddress}`);

    // Получаем RPC URL для Sepolia
    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
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
