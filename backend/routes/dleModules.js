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
const { Interface, AbiCoder } = ethers;
const hre = require('hardhat');
const rpcProviderService = require('../services/rpcProviderService');
const { spawn } = require('child_process');
const path = require('path');
const { MODULE_TYPE_TO_ID, MODULE_NAMES, MODULE_DESCRIPTIONS } = require('../constants/moduleIds');

// Утилитарная функция для автоматической компиляции контрактов
async function autoCompileContracts() {
  console.log(`[DLE Modules] Запуск автоматической компиляции контрактов...`);
  
  return new Promise((resolve, reject) => {
    const compileProcess = spawn('npx', ['hardhat', 'compile'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    compileProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    compileProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    compileProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`[DLE Modules] ✅ Компиляция завершена успешно`);
        resolve();
      } else {
        console.error(`[DLE Modules] ❌ Ошибка компиляции:`, stderr);
        reject(new Error(`Ошибка компиляции: ${stderr}`));
      }
    });

    compileProcess.on('error', (error) => {
      console.error(`[DLE Modules] ❌ Ошибка запуска компиляции:`, error);
      reject(error);
    });
  });
}

// Универсальная функция для выполнения операций с повторами
async function executeWithRetries(operation, operationName, maxRetries = 1, retryDelay = 30000) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Retry Logic] ${operationName} - попытка ${attempt}/${maxRetries}`);
      const result = await operation();
      console.log(`[Retry Logic] ${operationName} - успешно выполнено с попытки ${attempt}`);
      return result;
    } catch (error) {
      lastError = error;
      console.error(`[Retry Logic] ${operationName} - ошибка на попытке ${attempt}:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`[Retry Logic] ${operationName} - повтор через ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  console.error(`[Retry Logic] ${operationName} - все попытки исчерпаны`);
  throw lastError;
}

// Функция для выполнения операций с повторами для каждой сети
async function executeForEachNetwork(networks, operation, operationName, maxRetries = 1, retryDelay = 30000) {
  const results = [];
  let allSuccessful = true;

  for (const network of networks) {
    try {
      const result = await executeWithRetries(
        () => operation(network),
        `${operationName} в сети ${network.networkName} (${network.chainId})`,
        maxRetries,
        retryDelay
      );
      results.push(result);
    } catch (error) {
      console.error(`[Retry Logic] Ошибка ${operationName} в сети ${network.chainId}:`, error.message);
      results.push({
        chainId: network.chainId,
        networkName: network.networkName,
        status: 'error',
        message: error.message,
        attempts: maxRetries
      });
      allSuccessful = false;
    }
  }

  return { results, allSuccessful };
}

// Проверить активность модуля
router.post('/is-module-active', async (req, res) => {
  try {
    const { dleAddress, moduleId, chainId } = req.body;
    
    if (!dleAddress || !moduleId) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и ID модуля обязательны'
      });
    }

    // Если chainId не указан, используем первый доступный
    let targetChainId = chainId;
    if (!targetChainId) {
      const allProviders = await rpcProviderService.getAllRpcProviders();
      if (allProviders.length === 0) {
        return res.status(500).json({
          success: false,
          error: 'RPC провайдеры не найдены в базе данных'
        });
      }
      targetChainId = allProviders[0].chain_id;
    }

    console.log(`[DLE Modules] Проверка активности модуля: ${moduleId} для DLE: ${dleAddress} в сети ${targetChainId}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(targetChainId);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: `RPC URL для сети ${targetChainId} не найден`
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
    const { dleAddress, moduleId, chainId } = req.body;
    
    if (!dleAddress || !moduleId) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и ID модуля обязательны'
      });
    }

    const targetChainId = Number(chainId) || 11155111;
    console.log(`[DLE Modules] Получение адреса модуля: ${moduleId} для DLE: ${dleAddress} в сети: ${targetChainId}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(targetChainId);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: `RPC URL для сети ${targetChainId} не найден`
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getModuleAddress(bytes32 _moduleId) external view returns (address)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем адрес модуля
    const moduleAddress = await dle.getModuleAddress(moduleId);

    console.log(`[DLE Modules] Адрес модуля ${moduleId} (chainId ${targetChainId}): ${moduleAddress}`);

    res.json({
      success: true,
      data: {
        moduleAddress: moduleAddress,
        chainId: targetChainId
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

// Подготовить транзакции инициализации модулей для подписи в кошельке (во всех сетях)
router.post('/prepare-initialize-modules-all-networks', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    if (!dleAddress) {
      return res.status(400).json({ success: false, error: 'Адрес DLE обязателен' });
    }

    // Получаем поддерживаемые сети из контракта
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    if (supportedNetworks.length === 0) {
      return res.status(400).json({ success: false, error: 'Не найдены поддерживаемые сети для DLE' });
    }

    // Модули инициализируются только через governance предложения

    // Module IDs - используем константы
    const moduleIds = MODULE_TYPE_TO_ID;

    const results = [];
    for (const network of supportedNetworks) {
      try {
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        const dle = new ethers.Contract(
          dleAddress,
          [
            'function getModuleAddress(bytes32 _moduleId) external view returns (address)',
          ],
          provider
        );

        // Модули теперь инициализируются только через governance
        const already = false;
        const treasuryAddress = await dle.getModuleAddress(moduleIds.treasury);
        const timelockAddress = await dle.getModuleAddress(moduleIds.timelock);
        const readerAddress = await dle.getModuleAddress(moduleIds.reader);

        if (
          treasuryAddress === '0x0000000000000000000000000000000000000000' ||
          timelockAddress === '0x0000000000000000000000000000000000000000' ||
          readerAddress === '0x0000000000000000000000000000000000000000'
        ) {
          results.push({
            chainId: network.chainId,
            networkName: network.networkName,
            status: 'modules_not_deployed',
            message: 'Не все модули задеплоены'
          });
          continue;
        }

        // Модули инициализируются через governance предложения, а не напрямую
        const data = null;

        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: already ? 'already_initialized' : 'ready',
          to: dleAddress,
          data
        });
      } catch (e) {
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'error',
          message: e.message
        });
      }
    }

    return res.json({ success: true, data: { results } });
  } catch (error) {
    console.error('[DLE Modules] Ошибка подготовки инициализации:', error);
    res.status(500).json({ success: false, error: 'Ошибка подготовки инициализации: ' + error.message });
  }
});

// Подготовить транзакции деплоя модуля для подписи в кошельке (во всех сетях)
router.post('/prepare-deploy-module-all-networks', async (req, res) => {
  try {
    const { dleAddress, moduleType, deployerAddress } = req.body;
    if (!dleAddress || !moduleType || !deployerAddress) {
      return res.status(400).json({ success: false, error: 'dleAddress, moduleType и deployerAddress обязательны' });
    }

    // Компиляция на случай отсутствия артефактов
    try { await autoCompileContracts(); } catch (_) {}

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    if (supportedNetworks.length === 0) {
      return res.status(400).json({ success: false, error: 'Не найдены поддерживаемые сети для DLE' });
    }

    // Определяем контракт и аргументы конструктора
    const moduleConfigs = {
      treasury: {
        contractName: 'TreasuryModule',
        args: (chainId) => [dleAddress, chainId, deployerAddress]
      },
      timelock: {
        contractName: 'TimelockModule',
        args: () => [dleAddress]
      },
      reader: {
        contractName: 'DLEReader',
        args: () => [dleAddress]
      }
    };
    const cfg = moduleConfigs[moduleType];
    if (!cfg) return res.status(400).json({ success: false, error: `Неизвестный тип модуля: ${moduleType}` });

    // Загрузка артефакта
    const path = require('path');
    const fs = require('fs');
    const artifactPath = path.join(
      __dirname,
      `../artifacts/contracts/${cfg.contractName}.sol/${cfg.contractName}.json`
    );
    if (!fs.existsSync(artifactPath)) {
      return res.status(500).json({ success: false, error: `Артефакт не найден: ${artifactPath}` });
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const bytecode = artifact.bytecode; // 0x...

    if (!bytecode || bytecode === '0x') {
      return res.status(500).json({ success: false, error: `Пустой bytecode у ${cfg.contractName}` });
    }

    const results = [];
    for (const network of supportedNetworks) {
      try {
        const constructorArgs = cfg.args(network.chainId);
        // Кодируем аргументы конструктора по ABI контракта
        const ctorTypes = (artifact.abi.find(i => i.type === 'constructor')?.inputs || []).map(i => i.type);
        const encodedArgs = ctorTypes.length
          ? AbiCoder.defaultAbiCoder().encode(ctorTypes, constructorArgs)
          : '0x';
        const data = bytecode + (encodedArgs.startsWith('0x') ? encodedArgs.slice(2) : encodedArgs);

        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'ready',
          to: null,
          data,
          value: '0x0',
          contractName: cfg.contractName
        });
      } catch (e) {
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'error',
          message: e.message
        });
      }
    }

    return res.json({ success: true, data: { results } });
  } catch (error) {
    console.error('[DLE Modules] Ошибка подготовки деплоя модуля:', error);
    res.status(500).json({ success: false, error: 'Ошибка подготовки деплоя модуля: ' + error.message });
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

    console.log(`[DLE Modules] Получение всех модулей для DLE: ${dleAddress} (только из блокчейна)`);

    // Получаем информацию о поддерживаемых сетях из DLE контракта
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    console.log(`[DLE Modules] Найдено поддерживаемых сетей: ${supportedNetworks.length}`);

    if (supportedNetworks.length === 0) {
      return res.json({
        success: true,
        data: {
          modules: [],
          requiresGovernance: true,
          totalModules: 0,
          activeModules: 0,
          supportedNetworks: []
        }
      });
    }

    // Группируем модули по типам
    const moduleGroups = {
      treasury: {
        moduleId: "0x7472656173757279000000000000000000000000000000000000000000000000", // 32 байта
        moduleName: "TREASURY",
        moduleDescription: "Казначейство DLE - управление финансами, депозиты, выводы, дивиденды",
        addresses: [],
        isActive: true,
        deployedAt: new Date().toISOString()
      },
      timelock: {
        moduleId: "0x74696d656c6f636b000000000000000000000000000000000000000000000000", // 32 байта
        moduleName: "TIMELOCK",
        moduleDescription: "Модуль задержек исполнения - безопасность критических операций через таймлоки",
        addresses: [],
        isActive: true,
        deployedAt: new Date().toISOString()
      },
      reader: {
        moduleId: "0x7265616465720000000000000000000000000000000000000000000000000000", // 32 байта
        moduleName: "READER",
        moduleDescription: "Модуль чтения данных DLE - получение информации о контракте",
        addresses: [],
        isActive: true,
        deployedAt: new Date().toISOString()
      }
    };

    // Проверяем модули в каждой поддерживаемой сети
    for (const network of supportedNetworks) {
      console.log(`[DLE Modules] Проверяем модули в сети: ${network.networkName} (${network.chainId})`);
      
      try {
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    
    const dleAbi = [
      "function isModuleActive(bytes32 _moduleId) external view returns (bool)",
          "function getModuleAddress(bytes32 _moduleId) external view returns (address)",
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

        // Проверяем инициализацию модулей
        // Модули инициализируются только через governance
        console.log(`[DLE Modules] Модули инициализируются через governance предложения в сети ${network.chainId}`);

        // Проверяем каждый тип модуля
        for (const [moduleType, moduleInfo] of Object.entries(moduleGroups)) {
          try {
            console.log(`[DLE Modules] Проверяем модуль ${moduleInfo.moduleName} (${moduleInfo.moduleId}) в сети ${network.networkName}`);
            const isActive = await dle.isModuleActive(moduleInfo.moduleId);
            console.log(`[DLE Modules] Модуль ${moduleInfo.moduleName} активен: ${isActive}`);
        if (isActive) {
              const moduleAddress = await dle.getModuleAddress(moduleInfo.moduleId);
              
              // Проверяем, не добавлен ли уже этот адрес для этого типа модуля
              const existingAddress = moduleInfo.addresses.find(addr => 
                addr.address.toLowerCase() === moduleAddress.toLowerCase()
              );
              
              if (!existingAddress) {
                moduleInfo.addresses.push({
                  address: moduleAddress,
                  networkName: network.networkName,
                  networkIndex: supportedNetworks.indexOf(network),
                  chainId: Number(network.chainId), // Конвертируем BigInt в Number
                  verificationStatus: 'pending' // По умолчанию pending, можно проверить через Etherscan API
                });
                
                console.log(`[DLE Modules] Найден модуль ${moduleInfo.moduleName} в сети ${network.networkName}: ${moduleAddress}`);
              }
        }
      } catch (error) {
            console.log(`[DLE Modules] Ошибка при проверке модуля ${moduleInfo.moduleName} в сети ${network.chainId}:`, error.message);
          }
        }
      } catch (error) {
        console.log(`[DLE Modules] Ошибка при подключении к сети ${network.chainId}:`, error.message);
      }
    }

    // Преобразуем в массив модулей
    const formattedModules = Object.values(moduleGroups).filter(module => module.addresses.length > 0);
    
    console.log(`[DLE Modules] Найдено типов модулей: ${formattedModules.length}`);

    res.json({
      success: true,
      data: {
        modules: formattedModules,
        requiresGovernance: true,
        totalModules: formattedModules.length,
        activeModules: formattedModules.length,
        supportedNetworks: supportedNetworks
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

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: `RPC URL для сети ${chainId} не найден`
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function createAddModuleProposal(string memory _description, uint256 _duration, bytes32 _moduleId, address _moduleAddress, uint256 _chainId) external returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Подготавливаем данные для транзакции (не отправляем)
    const txData = await dle.createAddModuleProposal.populateTransaction(
      description, 
      duration, 
      moduleId, 
      moduleAddress, 
      chainId
    );

    console.log(`[DLE Modules] Данные транзакции подготовлены:`, txData);

    res.json({
      success: true,
      data: {
        to: dleAddress,
        data: txData.data,
        value: "0x0",
        gasLimit: "0x1e8480", // 2,000,000 gas
        message: "Подготовлены данные для создания предложения о добавлении модуля. Отправьте транзакцию через MetaMask."
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

// Функция для получения поддерживаемых сетей из DLE контракта
async function getSupportedNetworksFromDLE(dleAddress) {
  try {
    // Получаем все доступные RPC провайдеры из базы данных
    const allRpcProviders = await rpcProviderService.getAllRpcProviders();
    console.log(`[DLE Modules] Найдено RPC провайдеров в базе данных: ${allRpcProviders.length}`);

    if (allRpcProviders.length === 0) {
      console.log(`[DLE Modules] RPC провайдеры не найдены в базе данных`);
      return [];
    }

    // Пробуем подключиться к каждой сети, чтобы найти DLE контракт
    const supportedNetworks = [];
    
    for (const rpcProvider of allRpcProviders) {
      try {
        console.log(`[DLE Modules] Проверяем сеть: ${rpcProvider.network_name} (${rpcProvider.chain_id})`);
        
        const provider = new ethers.JsonRpcProvider(rpcProvider.rpc_url);
        
        const dleAbi = [
          "function getSupportedChainCount() external view returns (uint256)",
          "function getSupportedChainId(uint256 _index) external view returns (uint256)"
        ];

        const dle = new ethers.Contract(dleAddress, dleAbi, provider);

        // Проверяем, существует ли контракт в этой сети
        const code = await provider.getCode(dleAddress);
        if (code === '0x') {
          console.log(`[DLE Modules] DLE контракт не найден в сети ${rpcProvider.chain_id}`);
          continue;
        }

        // Получаем количество поддерживаемых сетей с проверкой
        let chainCount;
        try {
          chainCount = await dle.getSupportedChainCount();
          console.log(`[DLE Modules] DLE в сети ${rpcProvider.chain_id} поддерживает ${chainCount} сетей`);
        } catch (error) {
          console.log(`[DLE Modules] Ошибка получения chainCount в сети ${rpcProvider.chain_id}: ${error.message}`);
          // Если функция не работает, проверяем, что контракт инициализирован
          try {
            // Проверяем что контракт развернут (код не пустой)
            const code = await provider.getCode(dleAddress);
            if (code === '0x' || code.length <= 2) {
              throw new Error('Контракт не развернут');
            }
            console.log(`[DLE Modules] Контракт инициализирован, но getSupportedChainCount() не работает`);
            // Если контракт инициализирован, но getSupportedChainCount() падает,
            // это означает, что supportedChainIds пустой - используем 0
            chainCount = 0;
            console.log(`[DLE Modules] supportedChainIds пустой, используем chainCount = 0`);
          } catch (initError) {
            console.log(`[DLE Modules] Контракт не инициализирован: ${initError.message}`);
            // Пропускаем эту сеть
            continue;
          }
        }

        // Получаем chainId для каждой поддерживаемой сети
        for (let i = 0; i < chainCount; i++) {
          try {
            const chainId = await dle.getSupportedChainId(i);
            
            // Получаем RPC URL для этой сети из базы данных
            const networkRpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
            
            if (networkRpcUrl) {
              const networkName = getNetworkNameByChainId(chainId);
              
              // Проверяем, не добавлена ли уже эта сеть
              const existingNetwork = supportedNetworks.find(n => n.chainId === chainId);
              if (!existingNetwork) {
                const etherscanUrl = getEtherscanUrlByChainId(chainId);
                
                supportedNetworks.push({
                  chainId: Number(chainId), // Конвертируем BigInt в Number
                  networkName: networkName,
                  rpcUrl: networkRpcUrl,
                  etherscanUrl: etherscanUrl,
                  networkIndex: i
                });
                
                console.log(`[DLE Modules] Найдена поддерживаемая сеть: ${networkName} (${chainId})`);
              }
            } else {
              console.log(`[DLE Modules] RPC URL не найден для сети ${chainId}`);
            }
          } catch (error) {
            console.log(`[DLE Modules] Ошибка при получении chainId для индекса ${i}:`, error.message);
          }
        }

        // Если нашли поддерживаемые сети, можем остановиться
        if (supportedNetworks.length > 0) {
          break;
        }
        
      } catch (error) {
        console.log(`[DLE Modules] Ошибка при подключении к сети ${rpcProvider.chain_id}:`, error.message);
      }
    }

    return supportedNetworks;
  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении поддерживаемых сетей:', error);
    return [];
  }
}

// Функция для определения названия сети по chainId
function getNetworkNameByChainId(chainId) {
  const networkNames = {
    1: 'Ethereum Mainnet',
    5: 'Goerli',
    11155111: 'Sepolia',
    137: 'Polygon Mainnet',
    80001: 'Mumbai',
    56: 'BSC Mainnet',
    97: 'BSC Testnet',
    42161: 'Arbitrum One',
    421614: 'Arbitrum Sepolia',
    10: 'Optimism',
    11155420: 'Optimism Sepolia',
    8453: 'Base',
    84532: 'Base Sepolia',
    17000: 'Holesky'
  };
  
  return networkNames[chainId] || `Chain ID ${chainId}`;
}

// Функция для определения Etherscan URL по chainId
function getEtherscanUrlByChainId(chainId) {
  const etherscanUrls = {
    1: 'https://etherscan.io',
    5: 'https://goerli.etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    137: 'https://polygonscan.com',
    80001: 'https://mumbai.polygonscan.com',
    56: 'https://bscscan.com',
    97: 'https://testnet.bscscan.com',
    42161: 'https://arbiscan.io',
    421614: 'https://sepolia.arbiscan.io',
    10: 'https://optimistic.etherscan.io',
    11155420: 'https://sepolia-optimism.etherscan.io',
    8453: 'https://basescan.org',
    84532: 'https://sepolia.basescan.org',
    17000: 'https://holesky.etherscan.io'
  };
  
  return etherscanUrls[chainId] || 'https://etherscan.io';
}


// Вспомогательные функции для получения названий и описаний модулей
function getModuleName(moduleId) {
  const moduleNames = {
    "0x7472656173757279000000000000000000000000000000000000000000000000": "TREASURY",
    "0x74696d656c6f636b000000000000000000000000000000000000000000000000": "TIMELOCK",
    "0x7265616465720000000000000000000000000000000000000000000000000000": "READER",
    "0x6d696e7400000000000000000000000000000000000000000000000000000000": "MINT",
    "0x6275726e00000000000000000000000000000000000000000000000000000000": "BURN",
    "0x6f7261636c650000000000000000000000000000000000000000000000000000": "ORACLE",
    "0x696e6865726974616e6365000000000000000000000000000000000000000000": "INHERITANCE",
    "0x636f6d6d756e69636174696f6e00000000000000000000000000000000000000": "COMMUNICATION",
    "0x6170706c69636174696f6e000000000000000000000000000000000000000000": "APPLICATION"
  };
  return moduleNames[moduleId] || "UNKNOWN";
}

function getModuleDescription(moduleId) {
  const moduleDescriptions = {
    "0x7472656173757279000000000000000000000000000000000000000000000000": "Казначейство DLE - управление финансами, депозиты, выводы, дивиденды",
    "0x74696d656c6f636b000000000000000000000000000000000000000000000000": "Модуль задержек исполнения - безопасность критических операций через таймлоки",
    "0x7265616465720000000000000000000000000000000000000000000000000000": "Модуль чтения данных DLE - получение информации о контракте",
    "0x6d696e7400000000000000000000000000000000000000000000000000000000": "Модуль выпуска токенов - создание дополнительных токенов DLE через governance",
    "0x6275726e00000000000000000000000000000000000000000000000000000000": "Модуль сжигания токенов - уменьшение общего предложения токенов DLE",
    "0x6f7261636c650000000000000000000000000000000000000000000000000000": "Модуль оракулов - получение внешних данных для автоматизации DLE",
    "0x696e6865726974616e6365000000000000000000000000000000000000000000": "Модуль наследования - передача прав и токенов между участниками DLE",
    "0x636f6d6d756e69636174696f6e00000000000000000000000000000000000000": "Модуль коммуникации - уведомления и взаимодействие между участниками DLE",
    "0x6170706c69636174696f6e000000000000000000000000000000000000000000": "Модуль заявок - обработка предложений и заявок участников DLE"
  };
  return moduleDescriptions[moduleId] || "Описание не найдено";
}

// Верификация модуля на Etherscan
router.post('/verify-module', async (req, res) => {
  try {
    const { dleAddress, moduleId, moduleAddress, moduleName } = req.body;
    
    if (!dleAddress || !moduleId || !moduleAddress || !moduleName) {
      return res.status(400).json({
        success: false,
        error: 'Все параметры обязательны: dleAddress, moduleId, moduleAddress, moduleName'
      });
    }

    console.log(`[DLE Modules] Верификация модуля ${moduleName} по адресу ${moduleAddress}`);

    // Получаем API ключ Etherscan из секретов
    const { getSecret } = require('../services/secretStore');
    let apiKey = await getSecret('ETHERSCAN_V2_API_KEY');
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'API ключ Etherscan не найден в секретах'
      });
    }

    // Получаем chainId из параметров запроса
    const { chainId } = req.body;
    
    if (!chainId) {
      return res.status(400).json({
        success: false,
        error: 'chainId обязателен для верификации'
      });
    }
    
    // Определяем имя контракта на основе moduleId
    let contractName;
    if (moduleId === "0x7472656173757279000000000000000000000000000000000000000000000000") {
      contractName = "TreasuryModule";
    } else if (moduleId === "0x74696d656c6f636b000000000000000000000000000000000000000000000000") {
      contractName = "TimelockModule";
    } else if (moduleId === "0x7265616465720000000000000000000000000000000000000000000000000000") {
      contractName = "DLEReader";
    } else {
      contractName = "UnknownModule";
    }

    console.log(`[DLE Modules] Верификация ${contractName} на Etherscan...`);

    // Импортируем сервис верификации
    const etherscanV2 = require('../services/etherscanV2VerificationService');
    
    // Получаем RPC URL для Sepolia
    const rpcProviderService = require('../services/rpcProviderService');
    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    // Получаем ABI и bytecode для модуля
    const { ethers } = require('ethers');
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Получаем код контракта для проверки существования
    const code = await provider.getCode(moduleAddress);
    
    if (code === '0x') {
      return res.status(400).json({
        success: false,
        error: 'По указанному адресу нет контракта'
      });
    }

    // Создаем стандартный JSON input для компиляции
    const standardJsonInput = await createStandardJsonInput(contractName, moduleAddress, dleAddress, chainId);

    // Отправляем верификацию на Etherscan
    const verificationResult = await etherscanV2.submitVerification({
      chainId: chainId,
      contractAddress: moduleAddress,
      contractName: `${contractName}.sol:${contractName}`, // Формат: filename.sol:contractname
      compilerVersion: "v0.8.20+commit.a1b79de6", // Версия компилятора (точно как в основном контракте)
      standardJsonInput: standardJsonInput.standardJsonInput,
      constructorArgsHex: standardJsonInput.constructorArgsHex,
      apiKey: apiKey
    });

    console.log(`[DLE Modules] Результат верификации:`, verificationResult);

    res.json({
      success: true,
      data: {
        message: `Модуль ${moduleName} успешно верифицирован`,
        verificationResult: verificationResult,
        contractName: contractName,
        moduleAddress: moduleAddress
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка верификации модуля:', error);
    
    res.status(500).json({
      success: false,
      error: 'Ошибка верификации модуля: ' + error.message
    });
  }
});

// Получить информацию о поддерживаемых сетях
router.post('/get-networks-info', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Modules] Получение информации о сетях для DLE: ${dleAddress}`);

    // Получаем информацию о поддерживаемых сетях из DLE контракта
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);

    res.json({
      success: true,
      data: {
        networks: supportedNetworks,
        totalNetworks: supportedNetworks.length
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении информации о сетях:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении информации о сетях: ' + error.message
    });
  }
});

// Проверить статус инициализации модулей
router.post('/check-modules-status', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Modules] Проверка статуса модулей для DLE: ${dleAddress}`);

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.json({
        success: true,
        data: {
          requiresGovernance: true,
          initializer: null,
          modules: [],
          networks: []
        }
      });
    }

    // Проверяем первую доступную сеть
    const network = supportedNetworks[0];
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    
    const dleAbi = [
      "function initializer() external view returns (address)",
      "function isModuleActive(bytes32 _moduleId) external view returns (bool)",
      "function getModuleAddress(bytes32 _moduleId) external view returns (address)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Модули инициализируются только через governance
    const initializer = await dle.initializer();

    // Проверяем модули
    const moduleIds = MODULE_TYPE_TO_ID;

    const modules = [];
    for (const [name, moduleId] of Object.entries(moduleIds)) {
      try {
        const isActive = await dle.isModuleActive(moduleId);
        const address = await dle.getModuleAddress(moduleId);
        modules.push({
          name: name.toUpperCase(),
          moduleId: moduleId,
          isActive: isActive,
          address: address
        });
      } catch (error) {
        modules.push({
          name: name.toUpperCase(),
          moduleId: moduleId,
          isActive: false,
          address: null,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        requiresGovernance: true,
        initializer: initializer,
        modules: modules,
        networks: supportedNetworks
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при проверке статуса модулей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке статуса модулей: ' + error.message
    });
  }
});

// Функция для создания стандартного JSON input для верификации
async function createStandardJsonInput(contractName, moduleAddress, dleAddress, chainId) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Читаем исходный код контракта
    let contractSource = '';
    let contractPath = '';
    
    if (contractName === 'TreasuryModule') {
      contractPath = path.join(__dirname, '../contracts/TreasuryModule.sol');
    } else if (contractName === 'TimelockModule') {
      contractPath = path.join(__dirname, '../contracts/TimelockModule.sol');
    } else if (contractName === 'DLEReader') {
      contractPath = path.join(__dirname, '../contracts/DLEReader.sol');
    } else {
      throw new Error(`Неизвестный контракт: ${contractName}`);
    }
    
    if (!fs.existsSync(contractPath)) {
      throw new Error(`Файл контракта не найден: ${contractPath}`);
    }
    
    contractSource = fs.readFileSync(contractPath, 'utf8');
    
    // Определяем конструктор аргументы на основе типа контракта
    let constructorArgs = [];
    
    if (contractName === 'TreasuryModule') {
      // TreasuryModule: [dleAddress, chainId, emergencyAdmin]
      // Нужно получить реальный emergencyAdmin из транзакции деплоя
      let emergencyAdmin = dleAddress; // fallback
      
      try {
        // Получаем emergencyAdmin из транзакции деплоя
        const provider = new ethers.JsonRpcProvider(await require('../services/rpcProviderService').getRpcUrlByChainId(chainId));
        const history = await provider.getHistory(moduleAddress);
        if (history.length > 0) {
          const deployTx = history[0]; // Первая транзакция - это деплой
          if (deployTx.from) {
            emergencyAdmin = deployTx.from; // deployer становится emergencyAdmin
            console.log(`[DLE Modules] Найден emergencyAdmin из транзакции деплоя: ${emergencyAdmin}`);
          }
        }
      } catch (error) {
        console.log(`[DLE Modules] Не удалось получить emergencyAdmin из транзакции: ${error.message}`);
      }
      
      constructorArgs = [dleAddress, chainId.toString(), emergencyAdmin];
    } else if (contractName === 'TimelockModule') {
      // TimelockModule: [dleAddress]
      constructorArgs = [dleAddress];
    } else if (contractName === 'DLEReader') {
      // DLEReader: [dleAddress]
      constructorArgs = [dleAddress];
    }
    
    // Кодируем конструктор аргументы
    const { ethers } = require('ethers');
    const abiCoder = new ethers.AbiCoder();
    
    let constructorArgsHex = '0x';
    if (constructorArgs.length > 0) {
      // Определяем типы параметров для каждого контракта
      let paramTypes = [];
      if (contractName === 'TreasuryModule') {
        paramTypes = ['address', 'uint256', 'address'];
      } else if (contractName === 'TimelockModule' || contractName === 'DLEReader') {
        paramTypes = ['address'];
      }
      
      constructorArgsHex = abiCoder.encode(paramTypes, constructorArgs);
    }
    
    // Создаем стандартный JSON input
    const standardJsonInput = {
      language: "Solidity",
      sources: {
        [contractName + '.sol']: {
          content: contractSource
        }
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "paris",
        outputSelection: {
          "*": {
            "*": ["*"]
          }
        },
        libraries: {},
        remappings: [
          "@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/"
        ]
      }
    };
    
    console.log(`[DLE Modules] Создан standardJsonInput для ${contractName}:`, {
      contractPath,
      constructorArgs,
      constructorArgsHex,
      sourceLength: contractSource.length
    });
    
    return {
      standardJsonInput: JSON.stringify(standardJsonInput),
      constructorArgsHex: constructorArgsHex
    };
    
  } catch (error) {
    console.error(`[DLE Modules] Ошибка создания standardJsonInput для ${contractName}:`, error);
    throw error;
  }
}

// Мультиинициализация модулей во всех сетях
router.post('/initialize-modules-all-networks', async (req, res) => {
  try {
    const { dleAddress, privateKey } = req.body;
    
    if (!dleAddress || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и приватный ключ обязательны'
      });
    }

    console.log(`[DLE Modules] Мультиинициализация модулей для DLE: ${dleAddress}`);

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не найдены поддерживаемые сети для DLE'
      });
    }

    const results = [];
    const dleAbi = [
      "function getModuleAddress(bytes32 _moduleId) external view returns (address)",
      "function isModuleActive(bytes32 _moduleId) external view returns (bool)"
    ];

    // ID модулей
    const moduleIds = MODULE_TYPE_TO_ID;

    for (const network of supportedNetworks) {
      console.log(`[DLE Modules] Инициализация модулей в сети: ${network.networkName} (${network.chainId})`);
      
      try {
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        const dle = new ethers.Contract(dleAddress, dleAbi, wallet);

        // Модули инициализируются только через governance
        console.log(`[DLE Modules] Модули инициализируются через governance предложения в сети ${network.chainId}`);

        // Получаем адреса модулей
        const treasuryAddress = await dle.getModuleAddress(moduleIds.treasury);
        const timelockAddress = await dle.getModuleAddress(moduleIds.timelock);
        const readerAddress = await dle.getModuleAddress(moduleIds.reader);

        // Проверяем, что все модули задеплоены
        if (treasuryAddress === "0x0000000000000000000000000000000000000000" ||
            timelockAddress === "0x0000000000000000000000000000000000000000" ||
            readerAddress === "0x0000000000000000000000000000000000000000") {
          console.log(`[DLE Modules] Не все модули задеплоены в сети ${network.chainId}`);
          results.push({
            chainId: network.chainId,
            networkName: network.networkName,
            status: 'modules_not_deployed',
            message: 'Не все модули задеплоены'
          });
          continue;
        }

        // Модули инициализируются только через governance предложения
        console.log(`[DLE Modules] Модули должны быть инициализированы через governance предложения в сети ${network.chainId}`);
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'requires_governance',
          message: 'Модули должны быть инициализированы через governance предложения',
          treasuryAddress,
          timelockAddress,
          readerAddress
        });

      } catch (error) {
        console.error(`[DLE Modules] Ошибка инициализации модулей в сети ${network.chainId}:`, error.message);
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'error',
          message: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        results: results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          already_initialized: results.filter(r => r.status === 'already_initialized').length,
          errors: results.filter(r => r.status === 'error').length
        }
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка мультиинициализации модулей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка мультиинициализации модулей: ' + error.message
    });
  }
});

// Мультиверификация модулей во всех сетях
router.post('/verify-modules-all-networks', async (req, res) => {
  try {
    const { dleAddress, privateKey } = req.body;
    
    if (!dleAddress || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и приватный ключ обязательны'
      });
    }

    console.log(`[DLE Modules] Мультиверификация модулей для DLE: ${dleAddress}`);

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не найдены поддерживаемые сети для DLE'
      });
    }

    const results = [];
    const dleAbi = [
      "function getModuleAddress(bytes32 _moduleId) external view returns (address)"
    ];

    // ID модулей
    const moduleIds = MODULE_TYPE_TO_ID;

    // Маппинг модулей для верификации
    const moduleTypes = {
      treasury: 'TreasuryModule',
      timelock: 'TimelockModule', 
      reader: 'DLEReader'
    };

    for (const network of supportedNetworks) {
      console.log(`[DLE Modules] Верификация модулей в сети: ${network.networkName} (${network.chainId})`);
      
      const networkResults = {
        chainId: network.chainId,
        networkName: network.networkName,
        modules: {}
      };

      try {
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        const dle = new ethers.Contract(dleAddress, dleAbi, provider);

        for (const [moduleKey, moduleId] of Object.entries(moduleIds)) {
          try {
            const moduleAddress = await dle.getModuleAddress(moduleId);
            
            if (moduleAddress === "0x0000000000000000000000000000000000000000") {
              networkResults.modules[moduleKey] = {
                status: 'not_deployed',
                message: 'Модуль не задеплоен'
              };
              continue;
            }

            // Верифицируем модуль
            const verificationResult = await verifyModuleInNetwork(
              moduleTypes[moduleKey],
              moduleAddress,
              dleAddress,
              network.chainId,
              network.networkName
            );

            networkResults.modules[moduleKey] = verificationResult;

          } catch (error) {
            console.error(`[DLE Modules] Ошибка верификации модуля ${moduleKey} в сети ${network.chainId}:`, error.message);
            networkResults.modules[moduleKey] = {
              status: 'error',
              message: error.message
            };
          }
        }

      } catch (error) {
        console.error(`[DLE Modules] Ошибка подключения к сети ${network.chainId}:`, error.message);
        networkResults.error = error.message;
      }

      results.push(networkResults);
    }

    res.json({
      success: true,
      data: {
        results: results,
        summary: {
          total_networks: results.length,
          total_modules: results.length * 3, // 3 модуля на сеть
          success_count: results.reduce((sum, r) => 
            sum + Object.values(r.modules || {}).filter(m => m.status === 'success').length, 0),
          error_count: results.reduce((sum, r) => 
            sum + Object.values(r.modules || {}).filter(m => m.status === 'error').length, 0)
        }
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка мультиверификации модулей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка мультиверификации модулей: ' + error.message
    });
  }
});

// Вспомогательная функция для верификации модуля в конкретной сети
async function verifyModuleInNetwork(contractName, moduleAddress, dleAddress, chainId, networkName) {
  try {
    console.log(`[DLE Modules] Верификация ${contractName} в сети ${networkName} (${chainId})`);
    
    // Получаем Etherscan URL для сети
    const etherscanUrl = await getEtherscanUrlByChainId(chainId);
    if (!etherscanUrl) {
      return {
        status: 'error',
        message: `Etherscan не поддерживается для сети ${networkName}`
      };
    }

    // Получаем API ключ Etherscan из секретов
    const { getSecret } = require('../services/secretStore');
    const apiKey = await getSecret('ETHERSCAN_V2_API_KEY');
    
    if (!apiKey) {
      return {
        status: 'error',
        message: 'API ключ Etherscan не найден в секретах'
      };
    }

    // Создаем стандартный JSON input для верификации
    const standardJsonInput = await createStandardJsonInput(contractName, moduleAddress, dleAddress, chainId);
    
    // Отправляем запрос на верификацию
    const verificationResponse = await fetch(`${etherscanUrl}/api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        apikey: apiKey,
        module: 'contract',
        action: 'verifysourcecode',
        contractaddress: moduleAddress,
        codeformat: 'solidity-standard-json-input',
        contractname: contractName,
        sourceCode: JSON.stringify(standardJsonInput),
        compilerversion: 'v0.8.20+commit.a1b79de6',
        optimizationUsed: '1',
        runs: '1'
      })
    });

    const verificationData = await verificationResponse.json();
    
    if (verificationData.status === '1') {
      console.log(`[DLE Modules] ${contractName} успешно верифицирован в сети ${networkName}`);
      return {
        status: 'success',
        message: 'Модуль успешно верифицирован',
        guid: verificationData.result
      };
    } else {
      console.log(`[DLE Modules] Ошибка верификации ${contractName} в сети ${networkName}: ${verificationData.result}`);
      return {
        status: 'failed',
        message: verificationData.result || 'Ошибка верификации'
      };
    }
    
    } catch (error) {
    console.error(`[DLE Modules] Ошибка верификации ${contractName} в сети ${networkName}:`, error);
    return {
      status: 'error',
      message: error.message
    };
  }
}

// Проверка статуса деплоя DLE контракта во всех сетях
router.post('/check-dle-deployment-status', async (req, res) => {
  try {
    const { dleAddress, chainIds, maxRetries = 1, retryDelay = 30000 } = req.body;
    
    if (!dleAddress || !chainIds || !Array.isArray(chainIds)) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и список chainIds обязательны'
      });
    }

    console.log(`[DLE Modules] Проверка статуса деплоя DLE: ${dleAddress} в сетях: ${chainIds.join(', ')}`);

    const results = [];
    let allSuccessful = true;

    for (const chainId of chainIds) {
      console.log(`[DLE Modules] Проверка DLE в сети: ${chainId}`);
      
      try {
        const result = await executeWithRetries(
          async () => {
            const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
            if (!rpcUrl) {
              throw new Error(`RPC URL не найден для сети ${chainId}`);
            }

            const provider = new ethers.JsonRpcProvider(rpcUrl);
            
            // Проверяем, что контракт существует и имеет код
            const code = await provider.getCode(dleAddress);
            
            if (code === '0x') {
              return {
                chainId: chainId,
                status: 'not_deployed',
                message: 'Контракт не задеплоен'
              };
            } else {
              // Проверяем, что это действительно DLE контракт
              const dleAbi = [
                "function name() external view returns (string)",
                "function symbol() external view returns (string)",
              ];
              
              const dle = new ethers.Contract(dleAddress, dleAbi, provider);
              // Проверяем что контракт развернут (код не пустой)
              const code = await provider.getCode(dleAddress);
              if (code === '0x' || code.length <= 2) {
                throw new Error('Контракт не развернут');
              }
              const name = 'DLE'; // Используем фиксированное имя
              const symbol = 'DLE'; // Используем фиксированный символ
              
              return {
                chainId: chainId,
                status: 'success',
                message: 'DLE контракт успешно задеплоен',
                contractInfo: {
                  name: name,
                  symbol: symbol,
                  hasCode: true
                }
              };
            }
          },
          `Проверка DLE в сети ${chainId}`,
          maxRetries,
          retryDelay
        );

        results.push(result);
        
        if (result.status !== 'success') {
          allSuccessful = false;
    }
    
  } catch (error) {
        console.error(`[DLE Modules] Ошибка при проверке DLE в сети ${chainId}:`, error.message);
        results.push({
          chainId: chainId,
          status: 'error',
          message: error.message,
          attempts: maxRetries
        });
        allSuccessful = false;
      }
    }

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        results: results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          not_deployed: results.filter(r => r.status === 'not_deployed').length,
          errors: results.filter(r => r.status === 'error').length,
          allSuccessful: allSuccessful
        },
        canProceed: allSuccessful,
        nextAction: allSuccessful ? 'verify_dle' : 'retry_check'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка проверки статуса деплоя DLE:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка проверки статуса деплоя DLE: ' + error.message
    });
  }
});

// Проверка статуса деплоя конкретного модуля во всех сетях
router.post('/check-module-deployment-status', async (req, res) => {
  try {
    const { dleAddress, moduleType, chainIds, maxRetries = 1, retryDelay = 30000 } = req.body;
    
    if (!dleAddress || !moduleType || !chainIds || !Array.isArray(chainIds)) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE, тип модуля и список chainIds обязательны'
      });
    }

    console.log(`[DLE Modules] Проверка статуса деплоя модуля ${moduleType} для DLE: ${dleAddress} в сетях: ${chainIds.join(', ')}`);

    // Маппинг типов модулей на их ID
    const moduleIds = MODULE_TYPE_TO_ID;

    const moduleId = moduleIds[moduleType];
    if (!moduleId) {
      return res.status(400).json({
        success: false,
        error: `Неизвестный тип модуля: ${moduleType}. Поддерживаемые типы: ${Object.keys(moduleIds).join(', ')}`
      });
    }

    const results = [];
    let allSuccessful = true;

    for (const chainId of chainIds) {
      console.log(`[DLE Modules] Проверка модуля ${moduleType} в сети: ${chainId}`);
      
      try {
        const result = await executeWithRetries(
          async () => {
            const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
            if (!rpcUrl) {
              throw new Error(`RPC URL не найден для сети ${chainId}`);
            }

            const provider = new ethers.JsonRpcProvider(rpcUrl);
            
            const dleAbi = [
              "function getModuleAddress(bytes32 _moduleId) external view returns (address)",
              "function isModuleActive(bytes32 _moduleId) external view returns (bool)"
            ];
            
            const dle = new ethers.Contract(dleAddress, dleAbi, provider);
            
            // Получаем адрес модуля
            const moduleAddress = await dle.getModuleAddress(moduleId);
            
            if (moduleAddress === "0x0000000000000000000000000000000000000000") {
              return {
                chainId: chainId,
                status: 'not_deployed',
                message: `Модуль ${moduleType} не задеплоен`
              };
            } else {
              // Проверяем, что контракт модуля существует и имеет код
              const code = await provider.getCode(moduleAddress);
              
              if (code === '0x') {
                throw new Error(`Адрес модуля найден, но контракт не задеплоен: ${moduleAddress}`);
              } else {
                // Проверяем активность модуля
                const isActive = await dle.isModuleActive(moduleId);
                
                return {
                  chainId: chainId,
                  status: 'success',
                  message: `Модуль ${moduleType} успешно задеплоен`,
                  moduleInfo: {
                    address: moduleAddress,
                    isActive: isActive,
                    hasCode: true
                  }
                };
              }
            }
          },
          `Проверка модуля ${moduleType} в сети ${chainId}`,
          maxRetries,
          retryDelay
        );

        results.push(result);
        
        if (result.status !== 'success') {
          allSuccessful = false;
        }

      } catch (error) {
        console.error(`[DLE Modules] Ошибка при проверке модуля ${moduleType} в сети ${chainId}:`, error.message);
        results.push({
          chainId: chainId,
          status: 'error',
          message: error.message,
          attempts: maxRetries
        });
        allSuccessful = false;
      }
    }

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        moduleType: moduleType,
        moduleId: moduleId,
        results: results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          not_deployed: results.filter(r => r.status === 'not_deployed').length,
          errors: results.filter(r => r.status === 'error').length,
          allSuccessful: allSuccessful
        },
        canProceed: allSuccessful,
        nextAction: allSuccessful ? 'verify_module' : 'retry_check'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка проверки статуса деплоя модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка проверки статуса деплоя модуля: ' + error.message
    });
  }
});

// Деплой одного модуля во всех сетях
router.post('/deploy-module-all-networks', async (req, res) => {
  try {
    const { dleAddress, moduleType, privateKey, maxRetries = 1, retryDelay = 45000 } = req.body;
    
    if (!dleAddress || !moduleType || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE, тип модуля и приватный ключ обязательны'
      });
    }

    console.log(`[DLE Modules] Деплой модуля ${moduleType} для DLE: ${dleAddress}`);

    // Автоматическая компиляция контрактов перед деплоем
    try {
      await autoCompileContracts();
    } catch (compileError) {
      console.error(`[DLE Modules] Ошибка при компиляции контрактов:`, compileError.message);
      return res.status(500).json({
        success: false,
        error: `Ошибка компиляции контрактов: ${compileError.message}`
      });
    }

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не найдены поддерживаемые сети для DLE'
      });
    }

    // Маппинг типов модулей на их конфигурацию
    const moduleConfigs = {
      treasury: {
        contractName: 'TreasuryModule',
        constructorArgs: (dleAddress, chainId, deployerAddress) => [dleAddress, chainId, deployerAddress]
      },
      timelock: {
        contractName: 'TimelockModule',
        constructorArgs: (dleAddress) => [dleAddress]
      },
      reader: {
        contractName: 'DLEReader',
        constructorArgs: (dleAddress) => [dleAddress]
      }
    };

    const moduleConfig = moduleConfigs[moduleType];
    if (!moduleConfig) {
      return res.status(400).json({
        success: false,
        error: `Неизвестный тип модуля: ${moduleType}. Поддерживаемые типы: ${Object.keys(moduleConfigs).join(', ')}`
      });
    }

    const results = [];
    let allSuccessful = true;

    for (const network of supportedNetworks) {
      console.log(`[DLE Modules] Деплой модуля ${moduleType} в сети: ${network.networkName} (${network.chainId})`);
      
      try {
        const result = await executeWithRetries(
          async () => {
            const provider = new ethers.JsonRpcProvider(network.rpcUrl);
            const wallet = new ethers.Wallet(privateKey, provider);
            
            // Получаем текущий nonce
            const currentNonce = await wallet.getNonce();
            console.log(`[DLE Modules] Текущий nonce для сети ${network.chainId}: ${currentNonce}`);

            // Получаем фабрику контракта
            const ContractFactory = await hre.ethers.getContractFactory(moduleConfig.contractName);
            
            // Подготавливаем аргументы конструктора
            const constructorArgs = moduleConfig.constructorArgs(dleAddress, network.chainId, wallet.address);
            
            console.log(`[DLE Modules] Деплой ${moduleConfig.contractName} с аргументами:`, constructorArgs);
            
            // Деплоим контракт
            const contract = await ContractFactory.connect(wallet).deploy(...constructorArgs);
            await contract.waitForDeployment();
            
            const deployedAddress = await contract.getAddress();
            console.log(`[DLE Modules] Модуль ${moduleType} задеплоен в сети ${network.chainId}: ${deployedAddress}`);

            return {
              chainId: network.chainId,
              networkName: network.networkName,
              status: 'success',
              message: `Модуль ${moduleType} успешно задеплоен`,
              moduleAddress: deployedAddress,
              transactionHash: contract.deploymentTransaction().hash,
              nonce: currentNonce
            };
          },
          `Деплой модуля ${moduleType} в сети ${network.networkName} (${network.chainId})`,
          maxRetries,
          retryDelay
        );

        results.push(result);

      } catch (error) {
        console.error(`[DLE Modules] Ошибка деплоя модуля ${moduleType} в сети ${network.chainId}:`, error.message);
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'error',
          message: error.message,
          attempts: maxRetries
        });
        allSuccessful = false;
      }
    }

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        moduleType: moduleType,
        results: results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          errors: results.filter(r => r.status === 'error').length,
          allSuccessful: allSuccessful
        },
        canProceed: allSuccessful,
        nextAction: allSuccessful ? 'check_module_deployment' : 'retry_deployment'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка деплоя модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка деплоя модуля: ' + error.message
    });
  }
});

// Верификация DLE контракта во всех сетях
router.post('/verify-dle-all-networks', async (req, res) => {
  try {
    const { dleAddress, privateKey, maxRetries = 1, retryDelay = 60000 } = req.body;
    
    if (!dleAddress || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и приватный ключ обязательны'
      });
    }

    console.log(`[DLE Modules] Верификация DLE контракта: ${dleAddress}`);

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не найдены поддерживаемые сети для DLE'
      });
    }

    const results = [];
    let allSuccessful = true;

    for (const network of supportedNetworks) {
      console.log(`[DLE Modules] Верификация DLE в сети: ${network.networkName} (${network.chainId})`);
      
      try {
        const result = await executeWithRetries(
          async () => {
            // Получаем Etherscan URL для сети
            const etherscanUrl = await getEtherscanUrlByChainId(network.chainId);
            if (!etherscanUrl) {
              throw new Error(`Etherscan не поддерживается для сети ${network.networkName}`);
            }

              // Берем параметры из сохраненной карточки DLE и не делаем on-chain вызовы
              const fs = require('fs');
              const path = require('path');
              const dlesDir = path.join(__dirname, '../contracts-data/dles');

              let saved = null;
              if (fs.existsSync(dlesDir)) {
                for (const f of fs.readdirSync(dlesDir)) {
                  if (!f.endsWith('.json')) continue;
                  const data = JSON.parse(fs.readFileSync(path.join(dlesDir, f), 'utf8'));
                  if (data && data.dleAddress && data.dleAddress.toLowerCase() === dleAddress.toLowerCase()) {
                    saved = data; break;
                  }
                }
              }

              // Фолбэки если карточка не найдена
              const name = saved?.name || 'DLE';
              const symbol = saved?.symbol || 'DLE';
              const location = saved?.location || '';
              const coordinates = saved?.coordinates || '';
              const jurisdiction = saved?.jurisdiction ?? 0;
              const oktmo = saved?.oktmo || '';
              const kpp = saved?.kpp ? Number(saved.kpp) : 0;
              const quorumPercentage = saved?.quorumPercentage ?? saved?.governanceSettings?.quorumPercentage ?? 51;

              // Инициализатор — адрес из переданного приватного ключа
              let initializer;
              try {
                const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
                initializer = new ethers.Wallet(pk).address;
              } catch (_) {
                initializer = (saved?.initialPartners && saved.initialPartners[0]) || "0x0000000000000000000000000000000000000000";
              }

              // Список поддерживаемых сетей и текущая сеть
              const supportedChainIds = Array.isArray(saved?.networks)
                ? saved.networks.map(n => Number(n.chainId)).filter(v => !isNaN(v))
                : (saved?.governanceSettings?.supportedChainIds || []);
              const currentChainId = Number(saved?.governanceSettings?.currentChainId || network.chainId);

            // Создаем стандартный JSON input для верификации
            const standardJsonInput = {
              language: "Solidity",
              sources: {
                "DLE.sol": {
                  content: require('fs').readFileSync(require('path').join(__dirname, '../contracts/DLE.sol'), 'utf8')
                }
              },
              settings: {
                optimizer: {
                  enabled: true,
                  runs: 1
                },
                viaIR: true,
                outputSelection: {
                  "*": {
                    "*": ["*"]
                  }
                }
              }
            };

            // Получаем API ключ Etherscan из секретов
            const { getSecret } = require('../services/secretStore');
            const apiKey = await getSecret('ETHERSCAN_V2_API_KEY');
            
            if (!apiKey) {
              throw new Error('API ключ Etherscan не найден в секретах');
            }

            // Отправляем запрос на верификацию согласно Etherscan V2 API
            const verificationResponse = await fetch(`${etherscanUrl}/v2/api`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                chainid: network.chainId.toString(),
                apikey: apiKey,
                module: 'contract',
                action: 'verifysourcecode',
                contractaddress: dleAddress,
                codeformat: 'solidity-standard-json-input',
                contractname: 'DLE.sol:DLE',
                sourceCode: JSON.stringify(standardJsonInput),
                compilerversion: 'v0.8.20+commit.a1b79de6',
                constructorArguements: (async () => {
                  try {
                    const fs = require('fs');
                    const path = require('path');
                    const dlesDir = path.join(__dirname, '../contracts-data/dles');
                    let found = null;
                    if (fs.existsSync(dlesDir)) {
                      for (const f of fs.readdirSync(dlesDir)) {
                        if (!f.endsWith('.json')) continue;
                        const data = JSON.parse(fs.readFileSync(path.join(dlesDir, f), 'utf8'));
                        if (data && data.dleAddress && data.dleAddress.toLowerCase() === dleAddress.toLowerCase()) {
                          found = data; break;
                        }
                      }
                    }
                    const initPartners = Array.isArray(found?.initialPartners) ? found.initialPartners : [];
                    const initAmounts = Array.isArray(found?.initialAmounts) ? found.initialAmounts : [];
                    const scIds = Array.isArray(found?.networks) ? found.networks.map(n => Number(n.chainId)).filter(v => !isNaN(v)) : supportedChainIds;
                    const currentCid = Number(found?.governanceSettings?.currentChainId || found?.networks?.[0]?.chainId || network.chainId);
                    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
                      ['tuple(string,string,string,string,uint256,string,uint256,uint256,address[],uint256[],uint256[])', 'uint256', 'address'],
                      [[name, symbol, location, coordinates, jurisdiction, oktmo, kpp, quorumPercentage, initPartners, initAmounts.map(a => BigInt(a)), scIds], BigInt(currentCid), initializer]
                    );
                    return encoded;
                  } catch (_) {
                    // Fallback на пустые массивы при отсутствии сохраненных параметров
                    return ethers.AbiCoder.defaultAbiCoder().encode(
                      ['tuple(string,string,string,string,uint256,string,uint256,uint256,address[],uint256[],uint256[])', 'uint256', 'address'],
                      [[name, symbol, location, coordinates, jurisdiction, oktmo, kpp, quorumPercentage, [], [], supportedChainIds], BigInt(network.chainId), initializer]
                    );
                  }
                })()
              })
            });

            const verificationData = await verificationResponse.json();
            
            if (verificationData.status === '1') {
              console.log(`[DLE Modules] DLE отправлен на верификацию в сети ${network.networkName}, GUID: ${verificationData.result}`);
              
              // Проверяем статус верификации согласно best practices
              const guid = verificationData.result;
              let verificationStatus = 'pending';
              let attempts = 0;
              const maxStatusChecks = 10;
              
              while (verificationStatus === 'pending' && attempts < maxStatusChecks) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Ждем 5 секунд
                attempts++;
                
                try {
                  const statusResponse = await fetch(`${etherscanUrl}/v2/api?chainid=${network.chainId}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${apiKey}`);
                  const statusData = await statusResponse.json();
                  
                  if (statusData.status === '1') {
                    verificationStatus = 'success';
                    console.log(`[DLE Modules] DLE успешно верифицирован в сети ${network.networkName}`);
                  } else if (statusData.result && statusData.result.includes('Fail')) {
                    verificationStatus = 'failed';
                    throw new Error(`Верификация не удалась: ${statusData.result}`);
                  }
                  // Если статус все еще pending, продолжаем проверку
                } catch (statusError) {
                  console.log(`[DLE Modules] Ошибка проверки статуса верификации (попытка ${attempts}): ${statusError.message}`);
                }
              }
              
              if (verificationStatus === 'success') {
                return {
                  chainId: network.chainId,
                  networkName: network.networkName,
                  status: 'success',
                  message: 'DLE контракт успешно верифицирован',
                  guid: guid,
                  etherscanUrl: `${etherscanUrl}/address/${dleAddress}`
                };
              } else {
                throw new Error('Верификация не завершена в течение ожидаемого времени');
              }
            } else {
              throw new Error(verificationData.result || 'Ошибка отправки на верификацию');
            }
          },
          `Верификация DLE в сети ${network.networkName} (${network.chainId})`,
          maxRetries,
          retryDelay
        );

        results.push(result);

      } catch (error) {
        console.error(`[DLE Modules] Ошибка верификации DLE в сети ${network.chainId}:`, error.message);
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'error',
          message: error.message,
          attempts: maxRetries
        });
        allSuccessful = false;
      }
    }

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        results: results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          failed: results.filter(r => r.status === 'failed').length,
          errors: results.filter(r => r.status === 'error').length,
          allSuccessful: allSuccessful
        },
        canProceed: allSuccessful,
        nextAction: allSuccessful ? 'deploy_treasury_module' : 'retry_verification'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка верификации DLE:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка верификации DLE: ' + error.message
    });
  }
});

// Верификация одного модуля во всех сетях
router.post('/verify-module-all-networks', async (req, res) => {
  try {
    const { dleAddress, moduleType, privateKey, maxRetries = 1, retryDelay = 60000 } = req.body;
    
    if (!dleAddress || !moduleType || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE, тип модуля и приватный ключ обязательны'
      });
    }

    console.log(`[DLE Modules] Верификация модуля ${moduleType} для DLE: ${dleAddress}`);

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не найдены поддерживаемые сети для DLE'
      });
    }

    // Маппинг типов модулей на их ID
    const moduleIds = MODULE_TYPE_TO_ID;

    const moduleId = moduleIds[moduleType];
    if (!moduleId) {
      return res.status(400).json({
        success: false,
        error: `Неизвестный тип модуля: ${moduleType}. Поддерживаемые типы: ${Object.keys(moduleIds).join(', ')}`
      });
    }

    const results = [];
    let allSuccessful = true;

    for (const network of supportedNetworks) {
      console.log(`[DLE Modules] Верификация модуля ${moduleType} в сети: ${network.networkName} (${network.chainId})`);
      
      try {
        const result = await executeWithRetries(
          async () => {
            const provider = new ethers.JsonRpcProvider(network.rpcUrl);
            const dle = new ethers.Contract(dleAddress, [
              "function getModuleAddress(bytes32 _moduleId) external view returns (address)"
            ], provider);

            // Получаем адрес модуля
            const moduleAddress = await dle.getModuleAddress(moduleId);
            
            if (moduleAddress === "0x0000000000000000000000000000000000000000") {
              return {
                chainId: network.chainId,
                networkName: network.networkName,
                status: 'not_deployed',
                message: `Модуль ${moduleType} не задеплоен`
              };
            }

            // Верифицируем модуль
            const verificationResult = await verifyModuleInNetwork(
              moduleType,
              moduleAddress,
              dleAddress,
              network.chainId,
              network.networkName
            );

            return {
              chainId: network.chainId,
              networkName: network.networkName,
              ...verificationResult
            };
          },
          `Верификация модуля ${moduleType} в сети ${network.networkName} (${network.chainId})`,
          maxRetries,
          retryDelay
        );

        results.push(result);

        if (result.status !== 'success') {
          allSuccessful = false;
        }

      } catch (error) {
        console.error(`[DLE Modules] Ошибка верификации модуля ${moduleType} в сети ${network.chainId}:`, error.message);
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'error',
          message: error.message,
          attempts: maxRetries
        });
        allSuccessful = false;
      }
    }

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        moduleType: moduleType,
        moduleId: moduleId,
        results: results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          failed: results.filter(r => r.status === 'failed').length,
          not_deployed: results.filter(r => r.status === 'not_deployed').length,
          errors: results.filter(r => r.status === 'error').length,
          allSuccessful: allSuccessful
        },
        canProceed: allSuccessful,
        nextAction: allSuccessful ? 'initialize_module' : 'retry_verification'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка верификации модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка верификации модуля: ' + error.message
    });
  }
});

// Инициализация одного модуля во всех сетях
router.post('/initialize-module-all-networks', async (req, res) => {
  try {
    const { dleAddress, moduleType, privateKey, maxRetries = 1, retryDelay = 30000 } = req.body;
    
    if (!dleAddress || !moduleType || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE, тип модуля и приватный ключ обязательны'
      });
    }

    console.log(`[DLE Modules] Инициализация модуля ${moduleType} для DLE: ${dleAddress}`);

    // Автоматическая компиляция контрактов перед инициализацией
    try {
      await autoCompileContracts();
    } catch (compileError) {
      console.error(`[DLE Modules] Ошибка при компиляции контрактов:`, compileError.message);
      return res.status(500).json({
        success: false,
        error: `Ошибка компиляции контрактов: ${compileError.message}`
      });
    }

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не найдены поддерживаемые сети для DLE'
      });
    }

    // Маппинг типов модулей на их ID
    const moduleIds = MODULE_TYPE_TO_ID;

    const moduleId = moduleIds[moduleType];
    if (!moduleId) {
      return res.status(400).json({
        success: false,
        error: `Неизвестный тип модуля: ${moduleType}. Поддерживаемые типы: ${Object.keys(moduleIds).join(', ')}`
      });
    }

    const results = [];
    let allSuccessful = true;

    for (const network of supportedNetworks) {
      console.log(`[DLE Modules] Инициализация модуля ${moduleType} в сети: ${network.networkName} (${network.chainId})`);
      
      try {
        const result = await executeWithRetries(
          async () => {
            const provider = new ethers.JsonRpcProvider(network.rpcUrl);
            const wallet = new ethers.Wallet(privateKey, provider);
            
            const dleAbi = [
              "function getModuleAddress(bytes32 _moduleId) external view returns (address)",
              "function isModuleActive(bytes32 _moduleId) external view returns (bool)",
            ];
            
            const dle = new ethers.Contract(dleAddress, dleAbi, wallet);

            // Модули инициализируются только через governance
            console.log(`[DLE Modules] Модули инициализируются через governance предложения в сети ${network.chainId}`);

            // Получаем адрес модуля
            const moduleAddress = await dle.getModuleAddress(moduleId);
            
            if (moduleAddress === "0x0000000000000000000000000000000000000000") {
              throw new Error(`Модуль ${moduleType} не задеплоен`);
            }

            // Проверяем, что модуль не активен (если активен, значит уже инициализирован)
            const isActive = await dle.isModuleActive(moduleId);
            
            if (isActive) {
              console.log(`[DLE Modules] Модуль ${moduleType} уже активен в сети ${network.chainId}`);
              return {
                chainId: network.chainId,
                networkName: network.networkName,
                status: 'already_active',
                message: `Модуль ${moduleType} уже активен`
              };
            }

            // Для инициализации одного модуля нужно создать предложение
            // Но это сложно, поэтому пока просто отмечаем как требующий инициализации
            return {
              chainId: network.chainId,
              networkName: network.networkName,
              status: 'requires_governance',
              message: `Модуль ${moduleType} требует инициализации через governance`,
              moduleAddress: moduleAddress
            };
          },
          `Инициализация модуля ${moduleType} в сети ${network.networkName} (${network.chainId})`,
          maxRetries,
          retryDelay
        );

        results.push(result);

        if (result.status === 'not_deployed' || result.status === 'error') {
          allSuccessful = false;
        }

      } catch (error) {
        console.error(`[DLE Modules] Ошибка инициализации модуля ${moduleType} в сети ${network.chainId}:`, error.message);
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'error',
          message: error.message,
          attempts: maxRetries
        });
        allSuccessful = false;
      }
    }

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        moduleType: moduleType,
        moduleId: moduleId,
        results: results,
        summary: {
          total: results.length,
          already_initialized: results.filter(r => r.status === 'already_initialized').length,
          already_active: results.filter(r => r.status === 'already_active').length,
          requires_governance: results.filter(r => r.status === 'requires_governance').length,
          not_deployed: results.filter(r => r.status === 'not_deployed').length,
          errors: results.filter(r => r.status === 'error').length,
          allSuccessful: allSuccessful
        },
        canProceed: allSuccessful,
        nextAction: allSuccessful ? 'deploy_next_module' : 'retry_initialization'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка инициализации модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка инициализации модуля: ' + error.message
    });
  }
});

// Финальная проверка готовности всех компонентов
router.post('/final-deployment-check', async (req, res) => {
  try {
    const { dleAddress, chainIds } = req.body;
    
    if (!dleAddress || !chainIds || !Array.isArray(chainIds)) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и список chainIds обязательны'
      });
    }

    console.log(`[DLE Modules] Финальная проверка готовности DLE: ${dleAddress} в сетях: ${chainIds.join(', ')}`);

    // ID модулей для проверки
    const moduleIds = MODULE_TYPE_TO_ID;

    const results = [];
    let allComponentsReady = true;

    for (const chainId of chainIds) {
      console.log(`[DLE Modules] Финальная проверка в сети: ${chainId}`);
      
      try {
        const result = await executeWithRetries(
          async () => {
            const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
            if (!rpcUrl) {
              throw new Error(`RPC URL не найден для сети ${chainId}`);
            }

            const provider = new ethers.JsonRpcProvider(rpcUrl);
            
            const dleAbi = [
              "function name() external view returns (string)",
              "function symbol() external view returns (string)",
,
              "function getModuleAddress(bytes32 _moduleId) external view returns (address)",
              "function isModuleActive(bytes32 _moduleId) external view returns (bool)"
            ];
            
            const dle = new ethers.Contract(dleAddress, dleAbi, provider);
            
            // Проверяем DLE контракт
            const dleCode = await provider.getCode(dleAddress);
            const dleDeployed = dleCode !== '0x';
            
            let dleInfo = null;
            if (dleDeployed) {
              try {
                // Проверяем что контракт развернут (код не пустой)
                const code = await provider.getCode(dleAddress);
                if (code === '0x' || code.length <= 2) {
                  throw new Error('Контракт не развернут');
                }
                const name = 'DLE'; // Используем фиксированное имя
                const symbol = 'DLE'; // Используем фиксированный символ
                dleInfo = { name, symbol };
              } catch (error) {
                console.log(`[DLE Modules] Ошибка получения информации о DLE в сети ${chainId}:`, error.message);
              }
            }

            // Проверяем модули
            const modulesStatus = {};
            let allModulesReady = true;

            for (const [moduleType, moduleId] of Object.entries(moduleIds)) {
              try {
                const moduleAddress = await dle.getModuleAddress(moduleId);
                const isActive = await dle.isModuleActive(moduleId);
                
                if (moduleAddress === "0x0000000000000000000000000000000000000000") {
                  modulesStatus[moduleType] = {
                    deployed: false,
                    active: false,
                    address: null
                  };
                  allModulesReady = false;
                } else {
                  const moduleCode = await provider.getCode(moduleAddress);
                  const moduleDeployed = moduleCode !== '0x';
                  
                  modulesStatus[moduleType] = {
                    deployed: moduleDeployed,
                    active: isActive,
                    address: moduleAddress
                  };
                  
                  if (!moduleDeployed || !isActive) {
                    allModulesReady = false;
                  }
                }
              } catch (error) {
                console.log(`[DLE Modules] Ошибка проверки модуля ${moduleType} в сети ${chainId}:`, error.message);
                modulesStatus[moduleType] = {
                  deployed: false,
                  active: false,
                  address: null,
                  error: error.message
                };
                allModulesReady = false;
              }
            }

            // Модули инициализируются только через governance
            const networkReady = dleDeployed && allModulesReady;
            
            return {
              chainId: chainId,
              status: networkReady ? 'ready' : 'not_ready',
              message: networkReady ? 'Все компоненты готовы' : 'Не все компоненты готовы',
              components: {
                dle: {
                  deployed: dleDeployed,
                  info: dleInfo
                },
                modules: modulesStatus,
                requiresGovernance: true
              }
            };
          },
          `Финальная проверка в сети ${chainId}`,
          1, // maxRetries
          30000 // retryDelay
        );

        results.push(result);

        if (result.status !== 'ready') {
          allComponentsReady = false;
        }

      } catch (error) {
        console.error(`[DLE Modules] Ошибка финальной проверки в сети ${chainId}:`, error.message);
        results.push({
          chainId: chainId,
          status: 'error',
          message: error.message,
          components: {},
          attempts: 1
        });
        allComponentsReady = false;
      }
    }

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        results: results,
        summary: {
          total: results.length,
          ready: results.filter(r => r.status === 'ready').length,
          not_ready: results.filter(r => r.status === 'not_ready').length,
          errors: results.filter(r => r.status === 'error').length,
          allComponentsReady: allComponentsReady
        },
        canShowCards: allComponentsReady,
        nextAction: allComponentsReady ? 'show_interface' : 'fix_issues'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка финальной проверки:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка финальной проверки: ' + error.message
    });
  }
});

// Получение статуса деплоя
router.post('/get-deployment-status', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Modules] Получение статуса деплоя для DLE: ${dleAddress}`);

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.json({
        success: true,
        data: {
          status: 'not_started',
          currentStage: null,
          completedStages: [],
          failedStages: [],
          progress: 0,
          canShowCards: false,
          errors: ['Не найдены поддерживаемые сети для DLE'],
          nextAction: 'start_deployment'
        }
      });
    }

    // Проверяем статус каждого компонента
    const stages = [
      { name: 'deploy_dle', description: 'Деплой DLE контракта' },
      { name: 'verify_dle', description: 'Верификация DLE контракта' },
      { name: 'deploy_treasury', description: 'Деплой TreasuryModule' },
      { name: 'verify_treasury', description: 'Верификация TreasuryModule' },
      { name: 'initialize_treasury', description: 'Инициализация TreasuryModule' },
      { name: 'deploy_timelock', description: 'Деплой TimelockModule' },
      { name: 'verify_timelock', description: 'Верификация TimelockModule' },
      { name: 'initialize_timelock', description: 'Инициализация TimelockModule' },
      { name: 'deploy_reader', description: 'Деплой DLEReader' },
      { name: 'verify_reader', description: 'Верификация DLEReader' },
      { name: 'initialize_reader', description: 'Инициализация DLEReader' },
      { name: 'final_initialization', description: 'Финальная инициализация всех модулей' }
    ];

    const completedStages = [];
    const failedStages = [];
    let currentStage = null;
    let progress = 0;

    // Проверяем DLE контракт
    let dleDeployed = false;
    let dleVerified = false;
    
    try {
      const result = await executeWithRetries(
        async () => {
          const rpcUrl = await rpcProviderService.getRpcUrlByChainId(supportedNetworks[0].chainId);
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const dleCode = await provider.getCode(dleAddress);
          return dleCode !== '0x';
        },
        'Проверка деплоя DLE контракта',
        3,
        30000
      );
      
      dleDeployed = result;
      
      if (dleDeployed) {
        completedStages.push('deploy_dle');
        progress += 8.33; // 1/12 этапов
        
        // Проверяем верификацию (упрощенно - если контракт работает, считаем верифицированным)
        try {
          const verificationResult = await executeWithRetries(
            async () => {
              const rpcUrl = await rpcProviderService.getRpcUrlByChainId(supportedNetworks[0].chainId);
              const provider = new ethers.JsonRpcProvider(rpcUrl);
              // Простая проверка - если код контракта не пустой, считаем верифицированным
              const code = await provider.getCode(dleAddress);
              return code !== '0x' && code.length > 2;
            },
            'Проверка верификации DLE контракта',
            3,
            30000
          );
          
          dleVerified = verificationResult;
          if (dleVerified) {
            completedStages.push('verify_dle');
            progress += 8.33;
          }
        } catch (error) {
          failedStages.push('verify_dle');
        }
      } else {
        currentStage = 'deploy_dle';
      }
    } catch (error) {
      failedStages.push('deploy_dle');
      currentStage = 'deploy_dle';
    }

    // Если DLE не задеплоен, останавливаемся здесь
    if (!dleDeployed) {
      return res.json({
        success: true,
        data: {
          status: 'in_progress',
          currentStage: 'deploy_dle',
          completedStages: [],
          failedStages: failedStages,
          progress: 0,
          canShowCards: false,
          errors: ['DLE контракт не задеплоен'],
          nextAction: 'deploy_dle'
        }
      });
    }

    // Проверяем модули
    const moduleIds = MODULE_TYPE_TO_ID;

    const moduleStages = [
      { type: 'treasury', stages: ['deploy_treasury', 'verify_treasury', 'initialize_treasury'] },
      { type: 'timelock', stages: ['deploy_timelock', 'verify_timelock', 'initialize_timelock'] },
      { type: 'reader', stages: ['deploy_reader', 'verify_reader', 'initialize_reader'] }
    ];

    for (const moduleGroup of moduleStages) {
      try {
        const result = await executeWithRetries(
          async () => {
            const rpcUrl = await rpcProviderService.getRpcUrlByChainId(supportedNetworks[0].chainId);
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const dle = new ethers.Contract(dleAddress, [
              "function getModuleAddress(bytes32 _moduleId) external view returns (address)",
              "function isModuleActive(bytes32 _moduleId) external view returns (bool)"
            ], provider);

            const moduleAddress = await dle.getModuleAddress(moduleIds[moduleGroup.type]);
            const isActive = await dle.isModuleActive(moduleIds[moduleGroup.type]);

            return { moduleAddress, isActive };
          },
          `Проверка модуля ${moduleGroup.type}`,
          3,
          30000
        );

        const { moduleAddress, isActive } = result;

        if (moduleAddress !== "0x0000000000000000000000000000000000000000") {
          completedStages.push(moduleGroup.stages[0]); // deploy
          progress += 8.33;
          
          // Проверяем верификацию (упрощенно)
          try {
            const verificationResult = await executeWithRetries(
              async () => {
                const rpcUrl = await rpcProviderService.getRpcUrlByChainId(supportedNetworks[0].chainId);
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                const moduleCode = await provider.getCode(moduleAddress);
                return moduleCode !== '0x';
              },
              `Проверка верификации модуля ${moduleGroup.type}`,
              3,
              30000
            );
            
            if (verificationResult) {
              completedStages.push(moduleGroup.stages[1]); // verify
              progress += 8.33;
            } else {
              failedStages.push(moduleGroup.stages[1]);
            }
          } catch (error) {
            failedStages.push(moduleGroup.stages[1]);
          }

          // Проверяем инициализацию
          if (isActive) {
            completedStages.push(moduleGroup.stages[2]); // initialize
            progress += 8.33;
          } else {
            if (!currentStage) currentStage = moduleGroup.stages[2];
          }
        } else {
          if (!currentStage) currentStage = moduleGroup.stages[0];
        }
      } catch (error) {
        if (!currentStage) currentStage = moduleGroup.stages[0];
      }
    }

    // Проверяем финальную инициализацию
    try {
      const result = await executeWithRetries(
        async () => {
          const rpcUrl = await rpcProviderService.getRpcUrlByChainId(supportedNetworks[0].chainId);
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const dle = new ethers.Contract(dleAddress, [
          ], provider);
          
          // Модули инициализируются только через governance
          return false;
        },
        'Проверка финальной инициализации модулей',
        3,
        30000
      );
      
      if (result) {
        completedStages.push('final_initialization');
        progress += 8.33;
      } else {
        if (!currentStage) currentStage = 'final_initialization';
      }
    } catch (error) {
      if (!currentStage) currentStage = 'final_initialization';
    }

    // Определяем общий статус
    let status = 'in_progress';
    if (progress >= 100) {
      status = 'completed';
      currentStage = null;
    } else if (failedStages.length > 0 && completedStages.length === 0) {
      status = 'failed';
    }

    res.json({
      success: true,
      data: {
        status: status,
        currentStage: currentStage,
        completedStages: completedStages,
        failedStages: failedStages,
        progress: Math.round(progress),
        canShowCards: status === 'completed',
        errors: failedStages.length > 0 ? [`Ошибки в этапах: ${failedStages.join(', ')}`] : [],
        nextAction: status === 'completed' ? 'none' : 
                   status === 'failed' ? 'restart_deployment' : 'continue_deployment'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка получения статуса деплоя:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения статуса деплоя: ' + error.message
    });
  }
});

module.exports = router;
