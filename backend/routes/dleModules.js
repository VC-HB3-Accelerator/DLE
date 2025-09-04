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

      // Сначала пытаемся получить модули из файлов деплоя
    console.log(`[DLE Modules] Вызываем getDeployedModulesInfo...`);
    const modulesInfo = await getDeployedModulesInfo(dleAddress);
    console.log(`[DLE Modules] Результат getDeployedModulesInfo:`, modulesInfo);
    
    if (modulesInfo.modules && modulesInfo.modules.length > 0) {
      console.log(`[DLE Modules] Модули найдены в файлах, количество: ${modulesInfo.modules.length}`);
      
      // Преобразуем данные в нужный формат для frontend
      // Группируем модули по типам, а не по сетям
      const moduleGroups = {
        treasury: {
          moduleId: "0x747265617375727900000000000000000000000000000000000000000000000000",
          moduleName: "TREASURY",
          moduleDescription: "Казначейство DLE - управление финансами, депозиты, выводы, дивиденды",
          addresses: [],
          isActive: true,
          deployedAt: modulesInfo.deployTimestamp
        },
        timelock: {
          moduleId: "0x74696d656c6f636b000000000000000000000000000000000000000000000000",
          moduleName: "TIMELOCK",
          moduleDescription: "Модуль задержек исполнения - безопасность критических операций через таймлоки",
          addresses: [],
          isActive: true,
          deployedAt: modulesInfo.deployTimestamp
        },
        reader: {
          moduleId: "0x726561646572000000000000000000000000000000000000000000000000000000",
          moduleName: "READER",
          moduleDescription: "Модуль чтения данных DLE - получение информации о контракте",
          addresses: [],
          isActive: true,
          deployedAt: modulesInfo.deployTimestamp
        }
      };
      
      // Собираем адреса для каждого типа модуля из всех сетей
      // Определяем реальные chainId для каждого адреса
      for (let networkIndex = 0; networkIndex < modulesInfo.modules.length; networkIndex++) {
        const networkModules = modulesInfo.modules[networkIndex];
        
        console.log(`[DLE Modules] Обрабатываем сеть ${networkIndex + 1}:`, networkModules);
        
        // Получаем информацию о сети из файла деплоя
        let chainId = null;
        let networkName = `Сеть ${networkIndex + 1}`;
        
        // Если в файле есть информация о сетях, используем её
        if (modulesInfo.networks && modulesInfo.networks[networkIndex]) {
          chainId = modulesInfo.networks[networkIndex].chainId;
          networkName = modulesInfo.networks[networkIndex].networkName || `Сеть ${networkIndex + 1}`;
        }
        
        if (networkModules.treasuryModule) {
          moduleGroups.treasury.addresses.push({
            address: networkModules.treasuryModule,
            networkName: networkName,
            networkIndex: networkIndex,
            chainId: chainId,
            verificationStatus: modulesInfo.verification?.[networkIndex]?.treasuryModule || 'pending'
          });
        }
        
        if (networkModules.timelockModule) {
          moduleGroups.timelock.addresses.push({
            address: networkModules.timelockModule,
            networkName: networkName,
            networkIndex: networkIndex,
            chainId: chainId,
            verificationStatus: modulesInfo.verification?.[networkIndex]?.timelockModule || 'pending'
          });
        }
        
        if (networkModules.dleReader) {
          moduleGroups.reader.addresses.push({
            address: networkModules.dleReader,
            networkName: networkName,
            networkIndex: networkIndex,
            chainId: chainId,
            verificationStatus: modulesInfo.verification?.[networkIndex]?.dleReader || 'pending'
          });
        }
      }
      
      // Преобразуем в массив модулей
      const formattedModules = Object.values(moduleGroups).filter(module => module.addresses.length > 0);
      
      console.log(`[DLE Modules] Сгруппированные модули:`, formattedModules);
      console.log(`[DLE Modules] Найдено типов модулей: ${formattedModules.length}`);

      res.json({
        success: true,
        data: {
          modules: formattedModules,
          modulesInitialized: true,
          totalModules: formattedModules.length,
          activeModules: formattedModules.length
        }
      });
    } else {
      console.log(`[DLE Modules] Файлы модулей не найдены или пусты, проверяем блокчейн для DLE: ${dleAddress}`);
      
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
        "function getModuleAddress(bytes32 _moduleId) external view returns (address)",
        "function modulesInitialized() external view returns (bool)"
      ];

      const dle = new ethers.Contract(dleAddress, dleAbi, provider);

      // Проверяем инициализацию модулей
      let modulesInitialized = false;
      try {
        modulesInitialized = await dle.modulesInitialized();
      } catch (error) {
        console.log(`[DLE Modules] Ошибка при проверке инициализации модулей:`, error.message);
      }

      if (!modulesInitialized) {
        console.log(`[DLE Modules] Модули для DLE ${dleAddress} не инициализированы`);
        return res.json({
          success: true,
          data: {
            modules: [],
            modulesInitialized: false,
            totalModules: 0,
            activeModules: 0
          }
        });
      }

      // Список стандартных модулей DLE
      const standardModuleIds = [
        "0x7472656173757279000000000000000000000000000000000000000000000000", // "treasury"
        "0x74696d656c6f636b000000000000000000000000000000000000000000000000", // "timelock"
        "0x6d696e7400000000000000000000000000000000000000000000000000000000", // "mint"
        "0x6275726e00000000000000000000000000000000000000000000000000000000", // "burn"
        "0x6f7261636c650000000000000000000000000000000000000000000000000000", // "oracle"
        "0x696e6865726974616e6365000000000000000000000000000000000000000000", // "inheritance"
        "0x636f6d6d756e69636174696f6e00000000000000000000000000000000000000", // "communication"
        "0x6170706c69636174696f6e000000000000000000000000000000000000000000"  // "application"
      ];

      const modules = [];
      
      // Проверяем каждый модуль
      for (const moduleId of standardModuleIds) {
        try {
          const isActive = await dle.isModuleActive(moduleId);
          if (isActive) {
            const moduleAddress = await dle.getModuleAddress(moduleId);
            
            // Получаем человекочитаемое название модуля
            const moduleName = getModuleName(moduleId);
            const moduleDescription = getModuleDescription(moduleId);
            
            modules.push({
              moduleId: moduleId,
              moduleName: moduleName,
              moduleDescription: moduleDescription,
              moduleAddress: moduleAddress,
              isActive: isActive,
              deployedAt: new Date().toISOString() // В реальности нужно брать из событий
            });
            
            console.log(`[DLE Modules] Найден активный модуль: ${moduleName} по адресу ${moduleAddress}`);
          }
        } catch (error) {
          console.log(`[DLE Modules] Ошибка при проверке модуля ${getModuleName(moduleId)}:`, error.message);
        }
      }

      console.log(`[DLE Modules] Всего найдено активных модулей в блокчейне: ${modules.length}`);

      res.json({
        success: true,
        data: {
          modules: modules,
          modulesInitialized: modulesInitialized,
          totalModules: standardModuleIds.length,
          activeModules: modules.length
        }
      });
    }

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
    // Ищем файл модулей в правильной директории
    const tempDir = path.join(__dirname, '../scripts/temp');
    const modulesFileName = `modules-${dleAddress.toLowerCase()}.json`;
    const modulesFilePath = path.join(tempDir, modulesFileName);
    
    if (!fs.existsSync(modulesFilePath)) {
      console.log(`[DLE Modules] Файл модулей не найден: ${modulesFileName}`);
      return { modules: [], verification: {} };
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(modulesFilePath, 'utf8'));
      console.log(`[DLE Modules] Загружена информация о модулях для DLE: ${dleAddress}`);
      
      // Получаем статус верификации для каждого модуля
      const modulesWithVerification = [];
      
      if (data.modules && Array.isArray(data.modules)) {
        for (const networkModules of data.modules) {
          if (networkModules.treasuryModule) {
            modulesWithVerification.push({
              ...networkModules,
              verificationStatus: data.verification?.[0]?.treasuryModule || 'pending'
            });
          }
        }
      }
      
      return {
        modules: data.modules || [],
        verification: data.verification || {},
        deployTimestamp: data.deployTimestamp,
        networks: data.networks || [], // ✅ Добавляем поле networks
        modulesWithVerification: modulesWithVerification
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
    84532: 'Base Sepolia'
  };
  
  return networkNames[chainId] || `Chain ID ${chainId}`;
}

// Функция для получения модулей из файлов
async function getModulesFromFiles(dleAddress) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Ищем файл модулей в правильной директории
    const tempDir = path.join(__dirname, '../scripts/temp');
    const modulesFileName = `modules-${dleAddress.toLowerCase()}.json`;
    const modulesFilePath = path.join(tempDir, modulesFileName);
    
    if (!fs.existsSync(modulesFilePath)) {
      console.log(`[DLE Modules] Файл модулей не найден: ${modulesFileName}`);
      return [];
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(modulesFilePath, 'utf8'));
      console.log(`[DLE Modules] Загружена информация о модулях для DLE: ${dleAddress}`);
      
      const modules = [];
      
      // Обрабатываем модули из файла
      if (data.modules && Array.isArray(data.modules)) {
        for (const networkModules of data.modules) {
          if (networkModules.treasuryModule) {
            modules.push({
              moduleId: "0x7472656173757279000000000000000000000000000000000000000000000000",
              moduleName: "TREASURY",
              moduleDescription: "Казначейство DLE - управление финансами, депозиты, выводы, дивиденды",
              moduleAddress: networkModules.treasuryModule,
              isActive: true,
              deployedAt: data.deployTimestamp
            });
          }
          
          if (networkModules.timelockModule) {
            modules.push({
              moduleId: "0x74696d656c6f636b000000000000000000000000000000000000000000000000",
              moduleName: "TIMELOCK",
              moduleDescription: "Модуль задержек исполнения - безопасность критических операций через таймлоки",
              moduleAddress: networkModules.timelockModule,
              isActive: true,
              deployedAt: data.deployTimestamp
            });
          }
          
          if (networkModules.dleReader) {
            modules.push({
              moduleId: "0x726561646572000000000000000000000000000000000000000000000000000000",
              moduleName: "READER",
              moduleDescription: "Модуль чтения данных DLE - получение информации о контракте",
              moduleAddress: networkModules.dleReader,
              isActive: true,
              deployedAt: data.deployTimestamp
            });
          }
        }
      }
      
      // Убираем дубликаты (модули могут быть в нескольких сетях)
      const uniqueModules = modules.filter((module, index, self) => 
        index === self.findIndex(m => m.moduleId === module.moduleId)
      );
      
      return uniqueModules;
      
    } catch (error) {
      console.error(`Ошибка при чтении файла ${modulesFileName}:`, error);
      return [];
    }
    
  } catch (error) {
    console.error('Ошибка при получении информации о модулях из файлов:', error);
    return [];
  }
}

// Вспомогательные функции для получения названий и описаний модулей
function getModuleName(moduleId) {
  const moduleNames = {
    "0x7472656173757279000000000000000000000000000000000000000000000000": "TREASURY",
    "0x74696d656c6f636b000000000000000000000000000000000000000000000000": "TIMELOCK",
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

    // Определяем chainId (Sepolia)
    const chainId = 11155111; // Sepolia testnet
    
    // Определяем имя контракта на основе moduleId
    let contractName;
    if (moduleId === "0x7472656173757279000000000000000000000000000000000000000000000000") {
      contractName = "TreasuryModule";
    } else if (moduleId === "0x74696d656c6f636b000000000000000000000000000000000000000000000000") {
      contractName = "TimelockModule";
    } else if (moduleId === "0x726561646572000000000000000000000000000000000000000000000000000000") {
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

    // Обновляем статус верификации в файле модулей
    await updateModuleVerificationStatus(dleAddress, moduleId, 'success');

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
    
    // Обновляем статус верификации в файле модулей
    if (req.body.dleAddress && req.body.moduleId) {
      await updateModuleVerificationStatus(req.body.dleAddress, req.body.moduleId, 'failed');
    }
    
    res.status(500).json({
      success: false,
      error: 'Ошибка верификации модуля: ' + error.message
    });
  }
});

// Функция для обновления статуса верификации в файле модулей
async function updateModuleVerificationStatus(dleAddress, moduleId, status) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const tempDir = path.join(__dirname, '../scripts/temp');
    const modulesFileName = `modules-${dleAddress.toLowerCase()}.json`;
    const modulesFilePath = path.join(tempDir, modulesFileName);
    
    if (!fs.existsSync(modulesFilePath)) {
      console.log(`[DLE Modules] Файл модулей не найден для обновления статуса: ${modulesFileName}`);
      return;
    }
    
    const data = JSON.parse(fs.readFileSync(modulesFilePath, 'utf8'));
    
    // Обновляем статус верификации для всех сетей
    if (data.verification && Array.isArray(data.verification)) {
      for (let i = 0; i < data.verification.length; i++) {
        if (moduleId === "0x7472656173757279000000000000000000000000000000000000000000000000") {
          data.verification[i].treasuryModule = status;
        } else if (moduleId === "0x74696d656c6f636b000000000000000000000000000000000000000000000000") {
          data.verification[i].timelockModule = status;
        } else if (moduleId === "0x726561646572000000000000000000000000000000000000000000000000000000") {
          data.verification[i].dleReader = status;
        }
      }
    }
    
    // Записываем обновленные данные обратно в файл
    fs.writeFileSync(modulesFilePath, JSON.stringify(data, null, 2));
    console.log(`[DLE Modules] Статус верификации обновлен для модуля ${moduleId}: ${status}`);
    
  } catch (error) {
    console.error('[DLE Modules] Ошибка обновления статуса верификации:', error);
  }
}

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

module.exports = router;
