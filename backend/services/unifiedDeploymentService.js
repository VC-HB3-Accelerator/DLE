/**
 * Единый сервис для управления деплоем DLE
 * Объединяет все операции с данными и деплоем
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 */

const logger = require('../utils/logger');
const DeployParamsService = require('./deployParamsService');
const deploymentTracker = require('../utils/deploymentTracker');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
// ContractVerificationService удален - используем Hardhat verify
const { getRpcUrlByChainId } = require('./rpcProviderService');
const { ethers } = require('ethers');
// Убираем прямой импорт broadcastDeploymentUpdate - используем только deploymentTracker

class UnifiedDeploymentService {
  constructor() {
    this.deployParamsService = new DeployParamsService();
  }

  /**
   * Создает новый деплой DLE с полным циклом
   * @param {Object} dleParams - Параметры DLE из формы
   * @param {string} deploymentId - ID деплоя (опционально)
   * @returns {Promise<Object>} - Результат деплоя
   */
  async createDLE(dleParams, deploymentId = null) {
    try {
      // 1. Генерируем ID деплоя
      if (!deploymentId) {
        deploymentId = `deploy_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      }

      logger.info(`🚀 Начало создания DLE: ${deploymentId}`);

      // 2. Валидируем параметры
      this.validateDLEParams(dleParams);

      // 3. Подготавливаем параметры для деплоя
      const deployParams = await this.prepareDeployParams(dleParams);

      // 4. Сохраняем в БД
      await this.deployParamsService.saveDeployParams(deploymentId, deployParams, 'pending');
      logger.info(`💾 Параметры сохранены в БД: ${deploymentId}`);

      // 5. Запускаем деплой
      const result = await this.executeDeployment(deploymentId);

      // 6. Сохраняем результат
      await this.deployParamsService.updateDeploymentStatus(deploymentId, 'completed', result);
      logger.info(`✅ Деплой завершен: ${deploymentId}`);

      return {
        success: true,
        deploymentId,
        data: result
      };

    } catch (error) {
      logger.error(`❌ Ошибка деплоя ${deploymentId}:`, error);
      
      // Обновляем статус на ошибку
      if (deploymentId) {
        await this.deployParamsService.updateDeploymentStatus(deploymentId, 'failed', { error: error.message });
      }

      throw error;
    }
  }

  /**
   * Валидирует параметры DLE
   * @param {Object} params - Параметры для валидации
   */
  validateDLEParams(params) {
    const required = ['name', 'symbol', 'privateKey', 'supportedChainIds'];
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
   * Подготавливает параметры для деплоя
   * @param {Object} dleParams - Исходные параметры
   * @returns {Promise<Object>} - Подготовленные параметры
   */
  async prepareDeployParams(dleParams) {
    // Генерируем RPC URLs на основе supportedChainIds из базы данных
    const rpcUrls = await this.generateRpcUrls(dleParams.supportedChainIds || []);
    
    return {
      name: dleParams.name,
      symbol: dleParams.symbol,
      location: dleParams.location || '',
      coordinates: dleParams.coordinates || '',
      jurisdiction: dleParams.jurisdiction || 1,
      oktmo: dleParams.oktmo || 45000000000,
      okved_codes: dleParams.okvedCodes || [],
      kpp: dleParams.kpp || 770101001,
      quorum_percentage: dleParams.quorumPercentage || 51,
      initial_partners: dleParams.initialPartners || [],
      // initialAmounts в человекочитаемом формате, умножение на 1e18 происходит при деплое
      initial_amounts: dleParams.initialAmounts || [],
      supported_chain_ids: dleParams.supportedChainIds || [],
      current_chain_id: 1, // Governance chain всегда Ethereum
      private_key: dleParams.privateKey,
      etherscan_api_key: dleParams.etherscanApiKey,
      logo_uri: dleParams.logoURI || '',
      create2_salt: dleParams.CREATE2_SALT || `0x${Math.random().toString(16).substring(2).padStart(64, '0')}`,
      auto_verify_after_deploy: dleParams.autoVerifyAfterDeploy || false,
      modules_to_deploy: dleParams.modulesToDeploy || [],
      rpc_urls: rpcUrls,
      deployment_status: 'pending'
    };
  }

  /**
   * Генерирует RPC URLs на основе chain IDs из базы данных
   * @param {Array} chainIds - Массив chain IDs
   * @returns {Promise<Array>} - Массив RPC URLs
   */
  async generateRpcUrls(chainIds) {
    const { getRpcUrlByChainId } = require('./rpcProviderService');
    const rpcUrls = [];
    
    for (const chainId of chainIds) {
      try {
        const rpcUrl = await getRpcUrlByChainId(chainId);
        if (rpcUrl) {
          rpcUrls.push(rpcUrl);
          logger.info(`[RPC_GEN] Найден RPC для chainId ${chainId}: ${rpcUrl}`);
        } else {
          logger.warn(`[RPC_GEN] RPC не найден для chainId ${chainId}`);
        }
      } catch (error) {
        logger.error(`[RPC_GEN] Ошибка получения RPC для chainId ${chainId}:`, error.message);
      }
    }
    
    return rpcUrls;
  }

  /**
   * Выполняет деплой контрактов
   * @param {string} deploymentId - ID деплоя
   * @returns {Promise<Object>} - Результат деплоя
   */
  async executeDeployment(deploymentId) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../scripts/deploy/deploy-multichain.js');
      
      logger.info(`🚀 Запуск деплоя: ${scriptPath}`);
      
      // Используем npx для более надежного запуска hardhat в Docker
      const child = spawn('npx', ['hardhat', 'run', scriptPath], {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          DEPLOYMENT_ID: deploymentId
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        logger.info(`[DEPLOY] ${output.trim()}`);
        
        // Определяем этап процесса по содержимому вывода
        let progress = 50;
        let message = 'Деплой в процессе...';
        
        if (output.includes('Генерация ABI файла')) {
          progress = 10;
          message = 'Генерация ABI файла...';
        } else if (output.includes('Генерация flattened контракта')) {
          progress = 20;
          message = 'Генерация flattened контракта...';
        } else if (output.includes('Compiled') && output.includes('Solidity files')) {
          progress = 30;
          message = 'Компиляция контрактов...';
        } else if (output.includes('Загружены параметры')) {
          progress = 40;
          message = 'Загрузка параметров деплоя...';
        } else if (output.includes('deploying DLE directly')) {
          progress = 60;
          message = 'Деплой контрактов в сети...';
        } else if (output.includes('Верификация в сети')) {
          progress = 80;
          message = 'Верификация контрактов...';
        }
        
        // Отправляем WebSocket сообщение о прогрессе через deploymentTracker
        deploymentTracker.updateDeployment(deploymentId, {
          status: 'in_progress',
          progress: progress,
          message: message,
          output: output.trim()
        });
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        logger.error(`[DEPLOY ERROR] ${output.trim()}`);
      });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            const result = this.parseDeployResult(stdout);
            
            // Сохраняем результат в БД
            this.deployParamsService.updateDeploymentStatus(deploymentId, 'completed', result)
              .then(() => {
                logger.info(`✅ Результат деплоя сохранен в БД: ${deploymentId}`);
                
                // Отправляем WebSocket сообщение о завершении через deploymentTracker
                deploymentTracker.completeDeployment(deploymentId, result);
                
                resolve(result);
              })
              .catch(dbError => {
                logger.error(`❌ Ошибка сохранения результата в БД: ${dbError.message}`);
                resolve(result); // Все равно возвращаем результат
              });
          } catch (error) {
            reject(new Error(`Ошибка парсинга результата: ${error.message}`));
          }
        } else {
          // Логируем детали ошибки для отладки
          logger.error(`❌ Деплой завершился с ошибкой (код ${code})`);
          logger.error(`📋 stdout: ${stdout}`);
          logger.error(`📋 stderr: ${stderr}`);
          
          // Извлекаем конкретную ошибку из вывода
          const errorMessage = stderr || stdout || 'Неизвестная ошибка';
          
          // Создаем объект ошибки для сохранения в БД
          const errorResult = {
            success: false,
            error: `Деплой завершился с ошибкой (код ${code}): ${errorMessage}`,
            stdout: stdout,
            stderr: stderr
          };
          
          // Сохраняем ошибку в БД
          this.deployParamsService.updateDeploymentStatus(deploymentId, 'failed', errorResult)
            .then(() => {
              logger.info(`✅ Результат ошибки сохранен в БД: ${deploymentId}`);
            })
            .catch(dbError => {
              logger.error(`❌ Ошибка сохранения результата ошибки в БД: ${dbError.message}`);
            });
          
          // Отправляем WebSocket сообщение об ошибке через deploymentTracker
          deploymentTracker.failDeployment(deploymentId, new Error(`Деплой завершился с ошибкой (код ${code}): ${errorMessage}`));
          
          reject(new Error(`Деплой завершился с ошибкой (код ${code}): ${errorMessage}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Ошибка запуска деплоя: ${error.message}`));
      });
    });
  }

  /**
   * Парсит результат деплоя из вывода скрипта
   * @param {string} stdout - Вывод скрипта
   * @returns {Object} - Структурированный результат
   */
  parseDeployResult(stdout) {
    try {
      logger.info(`🔍 Анализируем вывод деплоя (${stdout.length} символов)`);
      
      // Ищем MULTICHAIN_DEPLOY_RESULT в выводе
      const resultMatch = stdout.match(/MULTICHAIN_DEPLOY_RESULT\s+(.+)/);
      if (resultMatch) {
        const jsonStr = resultMatch[1].trim();
        const deployResults = JSON.parse(jsonStr);
        logger.info(`📊 Результаты деплоя: ${JSON.stringify(deployResults, null, 2)}`);
        
        // Проверяем, что есть успешные деплои
        const successfulDeploys = deployResults.filter(r => r.address && r.address !== '0x0000000000000000000000000000000000000000' && !r.error);
        
        if (successfulDeploys.length > 0) {
          const dleAddress = successfulDeploys[0].address;
          logger.info(`✅ DLE адрес: ${dleAddress}`);
          
          return {
            success: true,
            data: {
              dleAddress: dleAddress,
              networks: deployResults.map(result => ({
                chainId: result.chainId,
                address: result.address,
                success: result.address && result.address !== '0x0000000000000000000000000000000000000000' && !result.error,
                error: result.error || null,
                verification: result.verification || 'pending'
              }))
            },
            message: `DLE успешно развернут в ${successfulDeploys.length} сетях`
          };
        } else {
          // Если нет успешных деплоев, но есть результаты, возвращаем их с ошибками
          const failedDeploys = deployResults.filter(r => r.error);
          logger.warn(`⚠️ Все деплои неудачны. Ошибки: ${failedDeploys.map(d => d.error).join(', ')}`);
          
          return {
            success: false,
            data: {
              networks: deployResults.map(result => ({
                chainId: result.chainId,
                address: result.address || null,
                success: false,
                error: result.error || 'Unknown error'
              }))
            },
            message: `Деплой неудачен во всех сетях. Ошибки: ${failedDeploys.map(d => d.error).join(', ')}`
          };
        }
      }
      
      // Fallback: создаем результат из текста
      return {
        success: true,
        message: 'Деплой выполнен успешно',
        output: stdout
      };
    } catch (error) {
      logger.error('❌ Ошибка парсинга результата деплоя:', error);
      throw new Error(`Не удалось распарсить результат деплоя: ${error.message}`);
    }
  }

  /**
   * Получает статус деплоя
   * @param {string} deploymentId - ID деплоя
   * @returns {Object} - Статус деплоя
   */
  async getDeploymentStatus(deploymentId) {
    return await this.deployParamsService.getDeployParams(deploymentId);
  }

  /**
   * Получает все деплои
   * @returns {Array} - Список деплоев
   */
  async getAllDeployments() {
    return await this.deployParamsService.getAllDeployments();
  }

  /**
   * Удаляет параметры деплоя по deploymentId
   * @param {string} deploymentId - ID деплоя
   * @returns {boolean} - Успешность удаления
   */
  async deleteDeployParams(deploymentId) {
    return await this.deployParamsService.deleteDeployParams(deploymentId);
  }

  /**
   * Получает все DLE из файлов (для совместимости)
   * @returns {Array} - Список DLE
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
        if (file.includes('dle-v2-') && file.endsWith('.json')) {
          const filePath = path.join(dlesDir, file);
          try {
            const dleData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (dleData.dleAddress) {
              dles.push(dleData);
            }
          } catch (err) {
            logger.error(`Ошибка при чтении файла ${file}:`, err);
          }
        }
      }

      return dles;
    } catch (error) {
      logger.error('Ошибка при получении списка DLE:', error);
      return [];
    }
  }

  /**
   * Автоматическая верификация контрактов во всех сетях
   * @param {Object} params - Параметры верификации
   * @returns {Promise<Object>} - Результат верификации
   */
  async autoVerifyAcrossChains({ deployParams, deployResult, apiKey }) {
    try {
      logger.info('🔍 Начинаем автоматическую верификацию контрактов');
      
      if (!deployResult?.data?.networks) {
        throw new Error('Нет данных о сетях для верификации');
      }

      const verificationResults = [];

      for (const network of deployResult.data.networks) {
        try {
          logger.info(`🔍 Верификация в сети ${network.chainId}...`);
          
          const result = await etherscanV2.verifyContract({
            contractAddress: network.dleAddress,
            chainId: network.chainId,
            deployParams,
            apiKey
          });

          verificationResults.push({
            chainId: network.chainId,
            address: network.dleAddress,
            success: result.success,
            guid: result.guid,
            message: result.message
          });

          logger.info(`✅ Верификация в сети ${network.chainId} завершена`);
        } catch (error) {
          logger.error(`❌ Ошибка верификации в сети ${network.chainId}:`, error);
          verificationResults.push({
            chainId: network.chainId,
            address: network.dleAddress,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: true,
        results: verificationResults
      };
    } catch (error) {
      logger.error('❌ Ошибка автоматической верификации:', error);
      throw error;
    }
  }

  /**
   * Проверяет балансы в указанных сетях
   * @param {Array} chainIds - Список ID сетей
   * @param {string} privateKey - Приватный ключ
   * @returns {Promise<Object>} - Результат проверки
   */
  async checkBalances(chainIds, privateKey) {
    try {
      logger.info(`💰 Проверка балансов в ${chainIds.length} сетях`);
      
      const wallet = new ethers.Wallet(privateKey);
      const results = [];

      for (const chainId of chainIds) {
        try {
          const rpcUrl = await getRpcUrlByChainId(chainId);
          if (!rpcUrl) {
            results.push({
              chainId,
              success: false,
              error: `RPC URL не найден для сети ${chainId}`
            });
            continue;
          }

          // Убеждаемся, что rpcUrl - это строка
          const rpcUrlString = typeof rpcUrl === 'string' ? rpcUrl : rpcUrl.toString();
          const provider = new ethers.JsonRpcProvider(rpcUrlString);
          const balance = await provider.getBalance(wallet.address);
          const balanceEth = ethers.formatEther(balance);

          results.push({
            chainId,
            success: true,
            address: wallet.address,
            balance: balanceEth,
            balanceWei: balance.toString()
          });

          logger.info(`💰 Сеть ${chainId}: ${balanceEth} ETH`);
        } catch (error) {
          logger.error(`❌ Ошибка проверки баланса в сети ${chainId}:`, error);
          results.push({
            chainId,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: true,
        results
      };
    } catch (error) {
      logger.error('❌ Ошибка проверки балансов:', error);
      throw error;
    }
  }

  /**
   * Закрывает соединения
   */
  async close() {
    await this.deployParamsService.close();
  }
}

module.exports = UnifiedDeploymentService;
