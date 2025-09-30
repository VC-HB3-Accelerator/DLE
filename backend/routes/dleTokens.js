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
const { getSupportedChainIds } = require('../utils/networkLoader');

// Получить баланс токенов
router.post('/get-token-balance', async (req, res) => {
  try {
    const { dleAddress, account } = req.body;
    
    if (!dleAddress || !account) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и адрес аккаунта обязательны'
      });
    }

    console.log(`[DLE Tokens] Получение баланса токенов для аккаунта: ${account} в DLE: ${dleAddress}`);

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    let candidateChainIds = []; // Будет заполнено из deploy_params
    
    try {
      // Получаем поддерживаемые сети из параметров деплоя
      const latestParams = await deployParamsService.getLatestDeployParams(1);
      if (latestParams.length > 0) {
        const params = latestParams[0];
        candidateChainIds = params.supportedChainIds || candidateChainIds;
      }
    } catch (error) {
      console.error('❌ Ошибка получения параметров деплоя, используем fallback:', error);
    }
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function balanceOf(address account) external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем баланс токенов
    const balance = await dle.balanceOf(account);

    console.log(`[DLE Tokens] Баланс токенов для ${account}: ${balance}`);

    res.json({
      success: true,
      data: {
        account: account,
        balance: ethers.formatUnits(balance, 18)
      }
    });

  } catch (error) {
    console.error('[DLE Tokens] Ошибка при получении баланса токенов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении баланса токенов: ' + error.message
    });
  }
});

// Получить общее предложение токенов
router.post('/get-total-supply', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Tokens] Получение общего предложения токенов для DLE: ${dleAddress}`);

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    let candidateChainIds = []; // Будет заполнено из deploy_params
    
    try {
      // Получаем поддерживаемые сети из параметров деплоя
      const latestParams = await deployParamsService.getLatestDeployParams(1);
      if (latestParams.length > 0) {
        const params = latestParams[0];
        candidateChainIds = params.supportedChainIds || candidateChainIds;
      }
    } catch (error) {
      console.error('❌ Ошибка получения параметров деплоя, используем fallback:', error);
    }
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function totalSupply() external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем общее предложение токенов
    const totalSupply = await dle.totalSupply();

    console.log(`[DLE Tokens] Общее предложение токенов: ${totalSupply}`);

    res.json({
      success: true,
      data: {
        totalSupply: ethers.formatUnits(totalSupply, 18)
      }
    });

  } catch (error) {
    console.error('[DLE Tokens] Ошибка при получении общего предложения токенов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении общего предложения токенов: ' + error.message
    });
  }
});

// Получить держателей токенов
router.post('/get-token-holders', async (req, res) => {
  try {
    const { dleAddress, offset = 0, limit = 10 } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Tokens] Получение держателей токенов для DLE: ${dleAddress}`);

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    let candidateChainIds = []; // Будет заполнено из deploy_params
    
    try {
      // Получаем поддерживаемые сети из параметров деплоя
      const latestParams = await deployParamsService.getLatestDeployParams(1);
      if (latestParams.length > 0) {
        const params = latestParams[0];
        candidateChainIds = params.supportedChainIds || candidateChainIds;
      }
    } catch (error) {
      console.error('❌ Ошибка получения параметров деплоя, используем fallback:', error);
    }
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function totalSupply() external view returns (uint256)",
      "function balanceOf(address account) external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем общее предложение токенов
    const totalSupply = await dle.totalSupply();
    
    // Список известных адресов для проверки
    const knownAddresses = [
      "0xF45aa4917b3775bA37f48Aeb3dc1a943561e9e0B", // Создатель
      "0x15A4ed4759e5762174b300a4Cf51cc17ad967f4d", // Инициатор предложения
      "0x2F2F070AA10bD3Ea14949b9953E2040a05421B17", // Сам DLE контракт
      "0x0000000000000000000000000000000000000000"  // Нулевой адрес
    ];
    
    const holders = [];
    
    // Проверяем балансы известных адресов
    for (const address of knownAddresses) {
      try {
        const balance = await dle.balanceOf(address);
        if (balance > 0) {
          const percentage = (Number(balance) / Number(totalSupply)) * 100;
          holders.push({
            address: address,
            balance: ethers.formatUnits(balance, 18),
            percentage: percentage
          });
        }
      } catch (error) {
        console.log(`[DLE Tokens] Ошибка при получении баланса для ${address}:`, error.message);
      }
    }
    
    // Сортируем по балансу (убывание)
    holders.sort((a, b) => Number(b.balance) - Number(a.balance));
    
    // Применяем пагинацию
    const start = Number(offset);
    const end = start + Number(limit);
    const paginatedHolders = holders.slice(start, end);

    console.log(`[DLE Tokens] Найдено держателей токенов: ${holders.length}`);

    res.json({
      success: true,
      data: {
        holders: paginatedHolders,
        total: holders.length,
        offset: Number(offset),
        limit: Number(limit)
      }
    });

  } catch (error) {
    console.error('[DLE Tokens] Ошибка при получении держателей токенов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении держателей токенов: ' + error.message
    });
  }
});

module.exports = router;
