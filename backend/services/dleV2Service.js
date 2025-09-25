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

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { getRpcUrlByChainId } = require('./rpcProviderService');
const deploymentTracker = require('../utils/deploymentTracker');
const etherscanV2 = require('./etherscanV2VerificationService');
const DeployParamsService = require('./deployParamsService');
const verificationStore = require('./verificationStore');

/**
 * Сервис для управления DLE v2 (Digital Legal Entity)
 * Современный подход с единым контрактом и базой данных
 */
class DLEV2Service {
  constructor() {
    this.deployParamsService = new DeployParamsService();
  }

  /**
   * Создает новое DLE v2 с заданными параметрами
   * @param {Object} dleParams - Параметры DLE
   * @param {string} deploymentId - Идентификатор деплоя (опционально)
   * @returns {Promise<Object>} - Результат создания DLE
   */
  async createDLE(dleParams, deploymentId = null) {
    console.log("🔥 [DLEV2-SERVICE] ФУНКЦИЯ createDLE ВЫЗВАНА!");
    logger.info("🚀 Начало создания DLE v2 с параметрами:", dleParams);
    
    try {
      // Генерируем deploymentId если не передан
      if (!deploymentId) {
        deploymentId = `deploy_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      }
      
      console.log(`🆔 Deployment ID: ${deploymentId}`);
      logger.info(`🆔 Deployment ID: ${deploymentId}`);
      
      // WebSocket обновление: начало процесса
      if (deploymentId) {
        deploymentTracker.updateProgress(deploymentId, 'Валидация параметров', 5, 'Проверяем входные данные');
      }

      // Валидация входных данных
      this.validateDLEParams(dleParams);

      // Подготовка параметров для деплоя
      console.log('🔧 Подготавливаем параметры для деплоя...');
      logger.info('🔧 Подготавливаем параметры для деплоя...');
      
      // Отладка: проверяем входные параметры
      console.log('🔍 ОТЛАДКА - Входные параметры:');
      console.log('   supportedChainIds:', JSON.stringify(dleParams.supportedChainIds, null, 2));
      console.log('   privateKey:', dleParams.privateKey ? '[ЕСТЬ]' : '[НЕТ]');
      console.log('   name:', dleParams.name);
      
      const deployParams = this.prepareDeployParams(dleParams);
      console.log('✅ Параметры подготовлены:', JSON.stringify(deployParams, null, 2));
      logger.info('✅ Параметры подготовлены:', JSON.stringify(deployParams, null, 2));
      
      // Сохраняем подготовленные параметры в базу данных
      logger.info(`💾 Сохранение подготовленных параметров деплоя в БД: ${deploymentId}`);
      await this.deployParamsService.saveDeployParams(deploymentId, deployParams, 'pending');

      // Вычисляем адрес инициализатора
      try {
        const normalizedPk = dleParams.privateKey?.startsWith('0x') ? dleParams.privateKey : `0x${dleParams.privateKey}`;
        const initializerAddress = new ethers.Wallet(normalizedPk).address;
        deployParams.initializerAddress = initializerAddress;
      } catch (e) {
        logger.warn('Не удалось вычислить initializerAddress из приватного ключа:', e.message);
      }

      // WebSocket обновление: генерация CREATE2_SALT
      if (deploymentId) {
        deploymentTracker.updateProgress(deploymentId, 'Генерация CREATE2 SALT', 10, 'Создаем уникальный идентификатор для детерминированного адреса');
      }

      // Генерируем одноразовый CREATE2_SALT
      const { createAndStoreNewCreate2Salt } = require('./secretStore');
      const { salt: create2Salt, key: saltKey } = await createAndStoreNewCreate2Salt({ label: deployParams.name || 'DLEv2' });
      logger.info(`CREATE2_SALT создан и сохранён: key=${saltKey}`);

      // Обновляем параметры в базе данных с CREATE2_SALT
      console.log('💾 Обновляем параметры в базе данных с CREATE2_SALT...');
      logger.info('💾 Обновляем параметры в базе данных с CREATE2_SALT...');
      
      const updatedParams = {
        ...deployParams,
        CREATE2_SALT: create2Salt
      };
      
      await this.deployParamsService.saveDeployParams(deploymentId, updatedParams, 'in_progress');
      logger.info(`✅ Параметры обновлены в БД с CREATE2_SALT: ${create2Salt}`);
      
      // WebSocket обновление: поиск RPC URLs
      if (deploymentId) {
        deploymentTracker.updateProgress(deploymentId, 'Поиск RPC endpoints', 15, 'Подключаемся к блокчейн сетям');
      }
      
      // Получаем RPC URLs для всех поддерживаемых сетей
      console.log('🌐 Получаем RPC URLs для всех поддерживаемых сетей...');
      logger.info('🌐 Получаем RPC URLs для всех поддерживаемых сетей...');
      const rpcUrls = {};
      for (const chainId of deployParams.supportedChainIds) {
        try {
          const rpcUrl = await getRpcUrlByChainId(chainId);
          if (rpcUrl) {
            rpcUrls[chainId] = rpcUrl;
            console.log(`✅ RPC URL для сети ${chainId}: ${rpcUrl}`);
            logger.info(`✅ RPC URL для сети ${chainId}: ${rpcUrl}`);
          } else {
            console.log(`❌ RPC URL для сети ${chainId} не найден`);
            logger.warn(`❌ RPC URL для сети ${chainId} не найден`);
          }
        } catch (error) {
          console.log(`❌ Ошибка при получении RPC URL для сети ${chainId}: ${error.message}`);
          logger.error(`❌ Ошибка при получении RPC URL для сети ${chainId}: ${error.message}`);
        }
      }

      // Проверяем баланс для всех сетей
      if (deploymentId) {
        deploymentTracker.updateProgress(deploymentId, 'Проверка баланса', 20, 'Проверяем достаточность средств для деплоя');
      }

      console.log('💰 Проверяем баланс для деплоя...');
      logger.info('💰 Проверяем баланс для деплоя...');
      
        if (dleParams.privateKey) {
        try {
          await this.checkBalances(deployParams.supportedChainIds, dleParams.privateKey);
          console.log(`✅ Баланс достаточный для деплоя!`);
        } catch (balanceError) {
          logger.error(`❌ Недостаточный баланс: ${balanceError.message}`);
          throw balanceError;
        }
      }

      // Обновляем параметры в базе данных с RPC URLs и initializer
      const finalParams = {
        ...updatedParams,
        rpcUrls: rpcUrls, // Сохраняем как объект {chainId: url}
        rpc_urls: Object.values(rpcUrls), // Также сохраняем как массив для совместимости
        initializer: dleParams.privateKey ? new ethers.Wallet(dleParams.privateKey.startsWith('0x') ? dleParams.privateKey : `0x${dleParams.privateKey}`).address : "0x0000000000000000000000000000000000000000"
      };
      
      await this.deployParamsService.saveDeployParams(deploymentId, finalParams, 'in_progress');
      logger.info(`✅ Параметры обновлены в БД с RPC URLs и initializer`);

      if (!dleParams.privateKey) {
        throw new Error('Приватный ключ для деплоя не передан');
      }

      // Сохраняем ключ Etherscan V2 ПЕРЕД деплоем
      logger.info(`🔑 Etherscan API Key получен: ${dleParams.etherscanApiKey ? '[ЕСТЬ]' : '[НЕТ]'}`);
      try {
        if (dleParams.etherscanApiKey) {
          logger.info('🔑 Сохраняем Etherscan API Key в secretStore...');
          const { setSecret } = require('./secretStore');
          await setSecret('ETHERSCAN_V2_API_KEY', dleParams.etherscanApiKey);
          logger.info('🔑 Etherscan API Key успешно сохранен в базу данных');
            } else {
          logger.warn('🔑 Etherscan API Key не передан, пропускаем сохранение');
        }
      } catch (e) {
        logger.error('🔑 Ошибка при сохранении Etherscan API Key:', e.message);
      }

      // WebSocket обновление: подготовка к деплою
      if (deploymentId) {
        deploymentTracker.updateProgress(deploymentId, 'Подготовка к деплою', 25, 'Подготавливаем параметры для деплоя');
      }

      // Запускаем деплой через скрипт
      console.log('🚀 Запускаем мультисетевой деплой...');
      logger.info('🚀 Запускаем мультисетевой деплой...');
      
      if (deploymentId) {
        deploymentTracker.updateProgress(deploymentId, 'Деплой контрактов', 30, 'Разворачиваем DLE контракты в сетях');
      }

      const deployResult = await this.runDeployMultichain(deploymentId);

      if (deploymentId) {
        deploymentTracker.updateProgress(deploymentId, 'Обработка результата', 80, 'Анализируем результат деплоя');
      }

      // Обрабатываем результат деплоя
      const result = this.extractDeployResult(deployResult.stdout, deployParams);
      
      if (!result || !result.success) {
        throw new Error('Деплой не удался: ' + (result?.error || 'Неизвестная ошибка'));
      }

      // Сохраняем данные DLE
        const dleData = {
        ...result.data,
        deploymentId: deploymentId,
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      this.saveDLEData(dleData);

      // Обновляем статус деплоя в базе данных
      if (deploymentId && result.data.dleAddress) {
        await this.deployParamsService.updateDeploymentStatus(deploymentId, 'completed', result.data.dleAddress);
        logger.info(`✅ Статус деплоя обновлен в БД: ${deploymentId} -> completed`);
      }
          
        // WebSocket обновление: финализация
        if (deploymentId) {
          deploymentTracker.updateProgress(deploymentId, 'Завершение', 100, 'Деплой успешно завершен!');
          deploymentTracker.addLog(deploymentId, `🎉 DLE ${result.data.name} (${result.data.symbol}) успешно создан!`, 'success');
          deploymentTracker.addLog(deploymentId, `📊 Партнеров: ${result.data.partnerBalances?.length || 0}`, 'info');
          deploymentTracker.addLog(deploymentId, `💰 Общий supply: ${result.data.totalSupply || 'N/A'}`, 'info');
        }
          
      const finalResult = {
            success: true,
            data: dleData
          };

      if (deploymentId) {
        deploymentTracker.completeDeployment(deploymentId, finalResult);
      }

      return finalResult;

    } catch (error) {
      logger.error('Ошибка при создании DLE v2:', error);
      
      // Обновляем статус деплоя в базе данных при ошибке
      if (deploymentId) {
        try {
          await this.deployParamsService.updateDeploymentStatus(deploymentId, 'failed');
          logger.info(`❌ Статус деплоя обновлен в БД: ${deploymentId} -> failed`);
        } catch (dbError) {
          logger.error(`❌ Ошибка при обновлении статуса деплоя в БД: ${dbError.message}`);
        }
      }
      
      // WebSocket обновление: деплой завершился с ошибкой
      if (deploymentId) {
        deploymentTracker.failDeployment(deploymentId, error);
      }
      
      throw error;
    }
  }

  /**
   * Валидирует параметры DLE
   * @param {Object} params - Параметры для валидации
   */
  validateDLEParams(params) {
    const required = ['name', 'symbol', 'location', 'jurisdiction', 'quorumPercentage'];
    const missing = required.filter(field => !params[field]);

    if (missing.length > 0) {
      throw new Error(`Отсутствуют обязательные поля: ${missing.join(', ')}`);
    }

    if (params.quorumPercentage < 1 || params.quorumPercentage > 100) {
      throw new Error('Кворум должен быть от 1 до 100 процентов');
    }

    if (!params.initialPartners || params.initialPartners.length === 0) {
      throw new Error('Необходимо указать хотя бы одного партнера');
    }

    if (!params.initialAmounts || params.initialAmounts.length === 0) {
      throw new Error('Необходимо указать начальные суммы для партнеров');
    }

    if (params.initialPartners.length !== params.initialAmounts.length) {
      throw new Error('Количество партнеров должно совпадать с количеством сумм');
    }

    if (!params.supportedChainIds || params.supportedChainIds.length === 0) {
      throw new Error('Необходимо указать поддерживаемые сети');
    }
  }

  /**
   * Сохраняет данные DLE в файловую систему
   * @param {Object} dleData - Данные DLE для сохранения
   */
  saveDLEData(dleData) {
    try {
      const dlesDir = path.join(__dirname, '../contracts-data/dles');
      
      if (!fs.existsSync(dlesDir)) {
        fs.mkdirSync(dlesDir, { recursive: true });
      }

      const filename = `${dleData.name}_${dleData.symbol}_${Date.now()}.json`;
      const filepath = path.join(dlesDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(dleData, null, 2));
      logger.info(`✅ Данные DLE сохранены: ${filepath}`);
    } catch (error) {
      logger.error('Ошибка при сохранении данных DLE:', error);
      throw error;
    }
  }

  /**
   * Подготавливает параметры для деплоя
   * @param {Object} params - Исходные параметры
   * @returns {Object} - Подготовленные параметры
   */
  prepareDeployParams(params) {
    return {
      name: params.name,
      symbol: params.symbol,
      location: params.location,
      coordinates: params.coordinates,
      jurisdiction: params.jurisdiction,
      oktmo: params.oktmo,
      okvedCodes: params.okvedCodes || [],
      kpp: params.kpp,
      quorumPercentage: params.quorumPercentage,
      initialPartners: params.initialPartners,
      initialAmounts: params.initialAmounts,
      supportedChainIds: params.supportedChainIds,
      currentChainId: params.currentChainId || params.supportedChainIds[0],
      logoURI: params.logoURI,
      privateKey: params.privateKey,
      etherscanApiKey: params.etherscanApiKey,
      autoVerifyAfterDeploy: params.autoVerifyAfterDeploy !== undefined ? params.autoVerifyAfterDeploy : true
    };
  }

  /**
   * Запускает мультисетевой деплой через скрипт
   * @param {string} deploymentId - Идентификатор деплоя
   * @param {Object} opts - Дополнительные опции
   * @returns {Promise<Object>} - Результат выполнения скрипта
   */
  async runDeployMultichain(deploymentId, opts = {}) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../scripts/deploy/deploy-multichain.js');
      const args = [];
      
      console.log(`🚀 Запускаем скрипт деплоя: ${scriptPath}`);
      logger.info(`🚀 Запускаем скрипт деплоя: ${scriptPath}`);
      
      const child = spawn('npx', ['hardhat', 'run', scriptPath], {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          DEPLOYMENT_ID: deploymentId, // Передаем deploymentId в скрипт
          ...opts.env
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(output);
        
        // НЕ отправляем логи через WebSocket здесь - они уже отправляются в скрипте деплоя
        // Это предотвращает дублирование логов
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.error(output);
        
        // НЕ отправляем ошибки через WebSocket здесь - они уже отправляются в скрипте деплоя
        // Это предотвращает дублирование логов
      });

      child.on('close', (code) => {
          if (code === 0) {
          resolve({ stdout, stderr, code });
          } else {
          reject(new Error(`Скрипт деплоя завершился с кодом ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Ошибка при запуске скрипта деплоя: ${error.message}`));
      });
    });
  }

  /**
   * Извлекает результат деплоя из вывода скрипта
   * @param {string} stdout - Вывод скрипта
   * @returns {Object|null} - Результат деплоя
   */
  extractDeployResult(stdout, deployParams = null) {
    // Ищем MULTICHAIN_DEPLOY_RESULT в выводе
    const resultMatch = stdout.match(/MULTICHAIN_DEPLOY_RESULT\s+(.+)/);
    
    if (resultMatch) {
      try {
        const deployResults = JSON.parse(resultMatch[1]);
        // Проверяем, что есть успешные деплои
        const successfulDeploys = deployResults.filter(r => r.address && r.address !== '0x0000000000000000000000000000000000000000');
        
        if (successfulDeploys.length > 0) {
          return {
            success: true,
            data: {
              deployedNetworks: deployResults,
              dleAddress: successfulDeploys[0].address, // Используем первый успешный адрес
              totalNetworks: deployResults.length,
              successfulNetworks: successfulDeploys.length,
              // Добавляем данные из параметров деплоя
              name: deployParams?.name || 'Unknown',
              symbol: deployParams?.symbol || 'UNK',
              location: deployParams?.location || 'Не указан',
              coordinates: deployParams?.coordinates || '0,0',
              jurisdiction: deployParams?.jurisdiction || 0,
              quorumPercentage: deployParams?.quorumPercentage || 51,
              logoURI: deployParams?.logoURI || '/uploads/logos/default-token.svg'
            }
          };
        }
      } catch (e) {
        logger.error('Ошибка парсинга JSON результата:', e);
      }
    }

    return null;
  }

  /**
   * Получает параметры деплоя из базы данных
   * @param {string} deploymentId - Идентификатор деплоя
   * @returns {Promise<Object|null>} - Параметры деплоя или null
   */
  async getDeployParams(deploymentId) {
    try {
      logger.info(`📖 Получение параметров деплоя из БД: ${deploymentId}`);
      return await this.deployParamsService.getDeployParams(deploymentId);
    } catch (error) {
      logger.error(`❌ Ошибка при получении параметров деплоя: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает последние параметры деплоя
   * @param {number} limit - Количество записей
   * @returns {Promise<Array>} - Список параметров деплоя
   */
  async getLatestDeployParams(limit = 10) {
    try {
      logger.info(`📋 Получение последних параметров деплоя (лимит: ${limit})`);
      return await this.deployParamsService.getLatestDeployParams(limit);
    } catch (error) {
      logger.error(`❌ Ошибка при получении последних параметров деплоя: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает список всех созданных DLE v2
   * @returns {Array<Object>} - Список DLE v2
   */
  getAllDLEs() {
    try {
      const dlesDir = path.join(__dirname, '../contracts-data/dles');
      
      if (!fs.existsSync(dlesDir)) {
        return [];
      }
      
      const files = fs.readdirSync(dlesDir);
      const dles = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filepath = path.join(dlesDir, file);
            const content = fs.readFileSync(filepath, 'utf8');
            const dleData = JSON.parse(content);
            dles.push(dleData);
          } catch (error) {
            logger.warn(`Ошибка при чтении файла ${file}:`, error.message);
          }
        }
      }

      return dles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      logger.error('Ошибка при получении списка DLE:', error);
      return [];
    }
  }

  /**
   * Группирует DLE по мультисетевым деплоям
   * @param {Array} allDles - Все DLE
   * @returns {Array} - Сгруппированные DLE
   */
  groupMultichainDLEs(allDles) {
    const groups = new Map();
    
    for (const dle of allDles) {
      const groupKey = this.createGroupKey(dle);
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          name: dle.name,
          symbol: dle.symbol,
          location: dle.location,
          jurisdiction: dle.jurisdiction,
          createdAt: dle.createdAt,
          deploymentId: dle.deploymentId,
          networks: [],
          totalSupply: dle.totalSupply,
          partnerCount: dle.partnerBalances?.length || 0
        });
      }

      groups.get(groupKey).networks.push({
          chainId: dle.chainId,
        address: dle.address,
        networkName: this.getRpcUrlForChain(dle.chainId)?.name || `Chain ${dle.chainId}`,
        status: dle.status || 'active'
      });
    }

    return Array.from(groups.values());
  }

  /**
   * Создает ключ для группировки DLE
   * @param {Object} dle - Данные DLE
   * @returns {string} - Ключ группировки
   */
  createGroupKey(dle) {
    return `${dle.name}_${dle.symbol}_${dle.jurisdiction}_${dle.location}`;
  }

  /**
   * Получает RPC URL для сети
   * @param {number} chainId - ID сети
   * @returns {Object|null} - Информация о RPC
   */
  getRpcUrlForChain(chainId) {
    const rpcMappings = {
      1: { name: 'Ethereum Mainnet', url: 'https://mainnet.infura.io/v3/' },
      11155111: { name: 'Sepolia Testnet', url: 'https://sepolia.infura.io/v3/' },
      17000: { name: 'Holesky Testnet', url: 'https://holesky.infura.io/v3/' },
      421614: { name: 'Arbitrum Sepolia', url: 'https://sepolia-rollup.arbitrum.io/rpc' },
      84532: { name: 'Base Sepolia', url: 'https://sepolia.base.org' }
    };

    return rpcMappings[chainId] || null;
  }

  /**
   * Проверяет баланс для деплоя в указанных сетях
   * @param {Array<number>} chainIds - Список ID сетей
   * @param {string} privateKey - Приватный ключ
   * @returns {Promise<void>}
   */
  async checkBalances(chainIds, privateKey) {
    const wallet = new ethers.Wallet(privateKey);
    const minBalance = ethers.parseEther('0.01'); // Минимум 0.01 ETH

    for (const chainId of chainIds) {
      try {
        const rpcUrl = await getRpcUrlByChainId(chainId);
        if (!rpcUrl) {
          throw new Error(`RPC URL не найден для сети ${chainId}`);
        }

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const balance = await provider.getBalance(wallet.address);
        
        console.log(`💰 Баланс в сети ${chainId}: ${ethers.formatEther(balance)} ETH`);
        
        if (balance < minBalance) {
          throw new Error(`Недостаточный баланс в сети ${chainId}: ${ethers.formatEther(balance)} ETH (минимум: ${ethers.formatEther(minBalance)} ETH)`);
        }
      } catch (error) {
        logger.error(`Ошибка при проверке баланса в сети ${chainId}:`, error.message);
        throw error;
      }
    }
  }
}

module.exports = DLEV2Service;