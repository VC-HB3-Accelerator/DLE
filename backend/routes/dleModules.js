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

// Проверить активность модуля
router.post('/is-module-active', async (req, res) => {
  try {
    const { dleAddress, moduleId } = req.body;
    
    if (!dleAddress || !moduleId) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и ID модуля обязательны'
      });
    }

    console.log(`[DLE Modules] Проверка активности модуля: ${moduleId} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function isModuleActive(bytes32 _moduleId) external view returns (bool)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Проверяем активность модуля
    const isActive = await dle.isModuleActive(moduleId);

    console.log(`[DLE Modules] Активность модуля ${moduleId}: ${isActive}`);

    res.json({
      success: true,
      data: {
        isActive: isActive
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при проверке активности модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке активности модуля: ' + error.message
    });
  }
});

// Получить информацию о задеплоенных модулях для DLE
router.get('/deployed/:dleAddress', async (req, res) => {
  try {
    const { dleAddress } = req.params;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Modules] Получение информации о модулях для DLE: ${dleAddress}`);

    // Получаем информацию о модулях из файлов деплоя
    const modulesInfo = await getDeployedModulesInfo(dleAddress);

    res.json({
      success: true,
      data: modulesInfo
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении информации о модулях:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении информации о модулях: ' + error.message
    });
  }
});

// Получить адрес модуля
router.post('/get-module-address', async (req, res) => {
  try {
    const { dleAddress, moduleId } = req.body;
    
    if (!dleAddress || !moduleId) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и ID модуля обязательны'
      });
    }

    console.log(`[DLE Modules] Получение адреса модуля: ${moduleId} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getModuleAddress(bytes32 _moduleId) external view returns (address)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем адрес модуля
    const moduleAddress = await dle.getModuleAddress(moduleId);

    console.log(`[DLE Modules] Адрес модуля ${moduleId}: ${moduleAddress}`);

    res.json({
      success: true,
      data: {
        moduleAddress: moduleAddress
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении адреса модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении адреса модуля: ' + error.message
    });
  }
});

// Получить все модули
router.post('/get-all-modules', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Modules] Получение всех модулей для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function isModuleActive(bytes32 _moduleId) external view returns (bool)",
      "function getModuleAddress(bytes32 _moduleId) external view returns (address)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Список известных модулей для проверки
    const knownModules = [
      "0x7472656173757279000000000000000000000000000000000000000000000000", // "treasury"
      "0x6d756c7469736967000000000000000000000000000000000000000000000000", // "multisig"
      "0x646561637469766174696f6e0000000000000000000000000000000000000000", // "deactivation"
      "0x616e616c79746963730000000000000000000000000000000000000000000000", // "analytics"
      "0x6e6f74696669636174696f6e7300000000000000000000000000000000000000"  // "notifications"
    ];
    
    const modules = [];
    
    // Проверяем активность известных модулей
    for (const moduleId of knownModules) {
      try {
        const isActive = await dle.isModuleActive(moduleId);
        if (isActive) {
          const address = await dle.getModuleAddress(moduleId);
          modules.push({
            id: moduleId,
            address: address,
            isActive: isActive
          });
        }
      } catch (error) {
        console.log(`[DLE Modules] Ошибка при проверке модуля ${moduleId}:`, error.message);
      }
    }

    console.log(`[DLE Modules] Найдено активных модулей: ${modules.length}`);

    res.json({
      success: true,
      data: {
        modules: modules
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении всех модулей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении всех модулей: ' + error.message
    });
  }
});

// Создать предложение о добавлении модуля
router.post('/create-add-module-proposal', async (req, res) => {
  try {
    const { dleAddress, description, duration, moduleId, moduleAddress, chainId } = req.body;
    
    if (!dleAddress || !description || !duration || !moduleId || !moduleAddress || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[DLE Modules] Создание предложения о добавлении модуля: ${moduleId} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function createAddModuleProposal(string memory _description, uint256 _duration, bytes32 _moduleId, address _moduleAddress, uint256 _chainId) external returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Создаем предложение
    const tx = await dle.createAddModuleProposal(description, duration, moduleId, moduleAddress, chainId);
    const receipt = await tx.wait();

    console.log(`[DLE Modules] Предложение о добавлении модуля создано:`, receipt);

    res.json({
      success: true,
      data: {
        proposalId: receipt.logs[0].args.proposalId,
        transactionHash: receipt.hash
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при создании предложения о добавлении модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при создании предложения о добавлении модуля: ' + error.message
    });
  }
});

// Создать предложение об удалении модуля
router.post('/create-remove-module-proposal', async (req, res) => {
  try {
    const { dleAddress, description, duration, moduleId, chainId } = req.body;
    
    if (!dleAddress || !description || !duration || !moduleId || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[DLE Modules] Создание предложения об удалении модуля: ${moduleId} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function createRemoveModuleProposal(string memory _description, uint256 _duration, bytes32 _moduleId, uint256 _chainId) external returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Создаем предложение
    const tx = await dle.createRemoveModuleProposal(description, duration, moduleId, chainId);
    const receipt = await tx.wait();

    console.log(`[DLE Modules] Предложение об удалении модуля создано:`, receipt);

    res.json({
      success: true,
      data: {
        proposalId: receipt.logs[0].args.proposalId,
        transactionHash: receipt.hash
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при создании предложения об удалении модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при создании предложения об удалении модуля: ' + error.message
    });
  }
});

// Функция для получения информации о задеплоенных модулях
async function getDeployedModulesInfo(dleAddress) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Ищем файл модулей для конкретного DLE
    const deployDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(deployDir)) {
      return { modules: [], verification: {} };
    }
    
    // Ищем файл по адресу DLE
    const modulesFileName = `modules-${dleAddress.toLowerCase()}.json`;
    const modulesFilePath = path.join(deployDir, modulesFileName);
    
    if (!fs.existsSync(modulesFilePath)) {
      console.log(`[DLE Modules] Файл модулей не найден: ${modulesFileName}`);
      return { modules: [], verification: {} };
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(modulesFilePath, 'utf8'));
      console.log(`[DLE Modules] Загружена информация о модулях для DLE: ${dleAddress}`);
      
      return {
        modules: data.modules || [],
        verification: data.verification || {},
        deployTimestamp: data.deployTimestamp
      };
    } catch (error) {
      console.error(`Ошибка при чтении файла ${modulesFileName}:`, error);
      return { modules: [], verification: {} };
    }
    
  } catch (error) {
    console.error('Ошибка при получении информации о модулях:', error);
    return { modules: [], verification: {} };
  }
}

module.exports = router;
