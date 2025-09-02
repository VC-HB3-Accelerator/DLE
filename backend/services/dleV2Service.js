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
const etherscanV2 = require('./etherscanV2VerificationService');
const verificationStore = require('./verificationStore');

/**
 * Сервис для управления DLE v2 (Digital Legal Entity)
 * Современный подход с единым контрактом
 */
class DLEV2Service {
  /**
   * Создает новое DLE v2 с заданными параметрами
   * @param {Object} dleParams - Параметры DLE
   * @returns {Promise<Object>} - Результат создания DLE
   */
  async createDLE(dleParams) {
    let paramsFile = null;
    let tempParamsFile = null;
    try {
      logger.info('Начало создания DLE v2 с параметрами:', dleParams);

      // Валидация входных данных
      this.validateDLEParams(dleParams);

      // Подготовка параметров для деплоя
      const deployParams = this.prepareDeployParams(dleParams);

      // Вычисляем адрес инициализатора (инициализатором является деплоер из переданного приватного ключа)
      try {
        const normalizedPk = dleParams.privateKey?.startsWith('0x') ? dleParams.privateKey : `0x${dleParams.privateKey}`;
        const initializerAddress = new ethers.Wallet(normalizedPk).address;
        deployParams.initializerAddress = initializerAddress;
      } catch (e) {
        logger.warn('Не удалось вычислить initializerAddress из приватного ключа:', e.message);
      }

      // Генерируем одноразовый CREATE2_SALT и сохраняем его с уникальным ключом в secrets
      const { createAndStoreNewCreate2Salt } = require('./secretStore');
      const { salt: create2Salt, key: saltKey } = await createAndStoreNewCreate2Salt({ label: deployParams.name || 'DLEv2' });
      logger.info(`CREATE2_SALT создан и сохранён: key=${saltKey}`);

      // Сохраняем параметры во временный файл
      paramsFile = this.saveParamsToFile(deployParams);

      // Копируем параметры во временный файл с предсказуемым именем
      tempParamsFile = path.join(__dirname, '../scripts/deploy/current-params.json');
      const deployDir = path.dirname(tempParamsFile);
      if (!fs.existsSync(deployDir)) {
        fs.mkdirSync(deployDir, { recursive: true });
      }
      fs.copyFileSync(paramsFile, tempParamsFile);
      
      // Готовим RPC для всех выбранных сетей
      const rpcUrls = [];
      for (const cid of deployParams.supportedChainIds) {
        logger.info(`Поиск RPC URL для chain_id: ${cid}`);
        const ru = await getRpcUrlByChainId(cid);
        if (!ru) {
          throw new Error(`RPC URL для сети с chain_id ${cid} не найден в базе данных`);
        }
        rpcUrls.push(ru);
      }

      // Добавляем CREATE2_SALT, RPC_URLS и initializer в файл параметров
      const currentParams = JSON.parse(fs.readFileSync(tempParamsFile, 'utf8'));
      // Копируем все параметры из deployParams
      Object.assign(currentParams, deployParams);
      currentParams.CREATE2_SALT = create2Salt;
      currentParams.rpcUrls = rpcUrls;
      currentParams.currentChainId = deployParams.currentChainId || deployParams.supportedChainIds[0];
      const { ethers } = require('ethers');
      currentParams.initializer = dleParams.privateKey ? new ethers.Wallet(dleParams.privateKey.startsWith('0x') ? dleParams.privateKey : `0x${dleParams.privateKey}`).address : "0x0000000000000000000000000000000000000000";
      fs.writeFileSync(tempParamsFile, JSON.stringify(currentParams, null, 2));
      
      logger.info(`Файл параметров скопирован и обновлен с CREATE2_SALT`);

      // Лёгкая проверка баланса в первой сети
      {
        const { ethers } = require('ethers');
        const provider = new ethers.JsonRpcProvider(rpcUrls[0]);
        if (dleParams.privateKey) {
          const pk = dleParams.privateKey.startsWith('0x') ? dleParams.privateKey : `0x${dleParams.privateKey}`;
          const walletAddress = new ethers.Wallet(pk, provider).address;
          const balance = await provider.getBalance(walletAddress);
          
          if (typeof ethers.parseEther !== 'function') {
            throw new Error('Метод ethers.parseEther не найден');
          }
          const minBalance = ethers.parseEther("0.00001");
          
          if (typeof ethers.formatEther !== 'function') {
            throw new Error('Метод ethers.formatEther не найден');
          }
          logger.info(`Баланс кошелька ${walletAddress}: ${ethers.formatEther(balance)} ETH`);
          if (balance < minBalance) {
            throw new Error(`Недостаточно ETH для деплоя в ${deployParams.supportedChainIds[0]}. Баланс: ${ethers.formatEther(balance)} ETH`);
          }
        }
      }
      if (!dleParams.privateKey) {
        throw new Error('Приватный ключ для деплоя не передан');
      }

      // Рассчитываем INIT_CODE_HASH автоматически из актуального initCode
      const initCodeHash = await this.computeInitCodeHash({
        ...deployParams,
        currentChainId: deployParams.currentChainId || deployParams.supportedChainIds[0]
      });

      // Factory больше не используется - деплой DLE напрямую
      logger.info(`Подготовка к прямому деплою DLE в сетях: ${deployParams.supportedChainIds.join(', ')}`);

      // Мультисетевой деплой одним вызовом
      logger.info('Запуск мульти-чейн деплоя...');
      
      const result = await this.runDeployMultichain(paramsFile, {
        rpcUrls: rpcUrls,
        chainIds: deployParams.supportedChainIds,
        privateKey: dleParams.privateKey?.startsWith('0x') ? dleParams.privateKey : `0x${dleParams.privateKey}`,
        salt: create2Salt,
        initCodeHash
      });

      logger.info('Деплой завершен, результат:', JSON.stringify(result, null, 2));

      // Сохраняем информацию о созданном DLE для отображения на странице управления
      try {
        logger.info('Результат деплоя для сохранения:', JSON.stringify(result, null, 2));
        
        // Проверяем структуру результата
        if (!result || typeof result !== 'object') {
          logger.error('Неверная структура результата деплоя:', result);
          throw new Error('Неверная структура результата деплоя');
        }

        // Если результат - массив (прямой результат из скрипта), преобразуем его
        let deployResult = result;
        if (Array.isArray(result)) {
          logger.info('Результат - массив, преобразуем в объект');
          const addresses = result.map(r => r.address);
          const allSame = addresses.every(addr => addr.toLowerCase() === addresses[0].toLowerCase());
          deployResult = {
            success: true,
            data: {
              dleAddress: addresses[0],
              networks: result.map((r, index) => ({
                chainId: r.chainId,
                address: r.address,
                success: true
              })),
              allSame
            }
          };
        }

        const firstNet = Array.isArray(deployResult?.data?.networks) && deployResult.data.networks.length > 0 ? deployResult.data.networks[0] : null;
        const dleData = {
          name: deployParams.name,
          symbol: deployParams.symbol,
          location: deployParams.location,
          coordinates: deployParams.coordinates,
          jurisdiction: deployParams.jurisdiction,
          okvedCodes: deployParams.okvedCodes || [],
          kpp: deployParams.kpp,
          quorumPercentage: deployParams.quorumPercentage,
          initialPartners: deployParams.initialPartners || [],
          initialAmounts: deployParams.initialAmounts || [],
          governanceSettings: {
            quorumPercentage: deployParams.quorumPercentage,
            supportedChainIds: deployParams.supportedChainIds,
            currentChainId: deployParams.currentChainId
          },
          dleAddress: (deployResult?.data?.dleAddress) || (firstNet?.address) || null,
          version: 'v2',
          networks: deployResult?.data?.networks || [],
          createdAt: new Date().toISOString()
        };
        
        logger.info('Данные DLE для сохранения:', JSON.stringify(dleData, null, 2));
        
        if (dleData.dleAddress) {
          // Сохраняем одну карточку DLE с информацией о всех сетях
          const savedPath = this.saveDLEData(dleData);
          logger.info(`DLE данные сохранены в: ${savedPath}`);
        } else {
          logger.error('Не удалось получить адрес DLE из результата деплоя');
        }
      } catch (e) {
        logger.warn('Не удалось сохранить локальную карточку DLE:', e.message);
      }

      // Сохраняем ключ Etherscan V2 для последующих авто‑обновлений статуса, если он передан
      try {
        if (dleParams.etherscanApiKey) {
          const { setSecret } = require('./secretStore');
          await setSecret('ETHERSCAN_V2_API_KEY', dleParams.etherscanApiKey);
        }
      } catch (_) {}

      // Авто-верификация через Etherscan V2 (опционально)
      if (dleParams.autoVerifyAfterDeploy) {
        try {
          await this.autoVerifyAcrossChains({
            deployParams,
            deployResult: result,
            apiKey: dleParams.etherscanApiKey
          });
        } catch (e) {
          logger.warn('Авто-верификация завершилась с ошибкой:', e.message);
        }
      }

      return result;

    } catch (error) {
      logger.error('Ошибка при создании DLE v2:', error);
      throw error;
    } finally {
      try {
        if (paramsFile || tempParamsFile) {
          this.cleanupTempFiles(paramsFile, tempParamsFile);
        }
      } catch (e) {
        logger.warn('Ошибка при очистке временных файлов (finally):', e.message);
      }
      try {
        this.pruneOldTempFiles(24 * 60 * 60 * 1000);
      } catch (e) {
        logger.warn('Ошибка при автоочистке старых временных файлов:', e.message);
      }
    }
  }

  /**
   * Валидирует параметры DLE
   * @param {Object} params - Параметры для валидации
   */
  validateDLEParams(params) {
    if (!params.name || params.name.trim() === '') {
      throw new Error('Название DLE обязательно');
    }

    if (!params.symbol || params.symbol.trim() === '') {
      throw new Error('Символ токена обязателен');
    }

    if (!params.location || params.location.trim() === '') {
      throw new Error('Местонахождение DLE обязательно');
    }

    if (!params.initialPartners || !Array.isArray(params.initialPartners)) {
      throw new Error('Партнеры должны быть массивом');
    }

    if (!params.initialAmounts || !Array.isArray(params.initialAmounts)) {
      throw new Error('Суммы должны быть массивом');
    }

    if (params.initialPartners.length !== params.initialAmounts.length) {
      throw new Error('Количество партнеров должно соответствовать количеству сумм распределения');
    }

    if (params.initialPartners.length === 0) {
      throw new Error('Должен быть указан хотя бы один партнер');
    }

    if (params.quorumPercentage > 100 || params.quorumPercentage < 1) {
      throw new Error('Процент кворума должен быть от 1% до 100%');
    }

    // Проверяем адреса партнеров
    for (let i = 0; i < params.initialPartners.length; i++) {
      if (!ethers.isAddress || !ethers.isAddress(params.initialPartners[i])) {
        throw new Error(`Неверный адрес партнера ${i + 1}: ${params.initialPartners[i]}`);
      }
    }

    // Проверяем, что выбраны сети
    if (!params.supportedChainIds || !Array.isArray(params.supportedChainIds) || params.supportedChainIds.length === 0) {
      throw new Error('Должна быть выбрана хотя бы одна сеть для деплоя');
    }

    // Дополнительные проверки безопасности
    if (params.name.length > 100) {
      throw new Error('Название DLE слишком длинное (максимум 100 символов)');
    }

    if (params.symbol.length > 10) {
      throw new Error('Символ токена слишком длинный (максимум 10 символов)');
    }

    if (params.location.length > 200) {
      throw new Error('Местонахождение слишком длинное (максимум 200 символов)');
    }

    // Проверяем суммы токенов
    for (let i = 0; i < params.initialAmounts.length; i++) {
      const amount = params.initialAmounts[i];
      if (typeof amount !== 'string' && typeof amount !== 'number') {
        throw new Error(`Неверный тип суммы для партнера ${i + 1}`);
      }
      
      const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error(`Неверная сумма для партнера ${i + 1}: ${amount}`);
      }
    }

    // Проверяем приватный ключ
    if (!params.privateKey) {
      throw new Error('Приватный ключ обязателен для деплоя');
    }

    const pk = params.privateKey.startsWith('0x') ? params.privateKey : `0x${params.privateKey}`;
    if (!/^0x[a-fA-F0-9]{64}$/.test(pk)) {
      throw new Error('Неверный формат приватного ключа');
    }

    // Проверяем, что не деплоим в mainnet без подтверждения
    const mainnetChains = [1, 137, 56, 42161]; // Ethereum, Polygon, BSC, Arbitrum
    const hasMainnet = params.supportedChainIds.some(id => mainnetChains.includes(id));
    
    if (hasMainnet) {
      logger.warn('⚠️ ВНИМАНИЕ: Деплой включает mainnet сети! Убедитесь, что это необходимо.');
    }

    logger.info('✅ Валидация параметров DLE пройдена успешно');
  }

  /**
   * Сохраняет/обновляет локальную карточку DLE для отображения в UI
   * @param {Object} dleData
   * @returns {string} Путь к сохраненному файлу
   */
  saveDLEData(dleData) {
    try {
      if (!dleData || !dleData.dleAddress) {
        throw new Error('Неверные данные для сохранения карточки DLE: отсутствует dleAddress');
      }
      const dlesDir = path.join(__dirname, '../contracts-data/dles');
      if (!fs.existsSync(dlesDir)) {
        fs.mkdirSync(dlesDir, { recursive: true });
      }

      // Если уже есть файл с таким адресом — обновим его
      let targetFile = null;
      try {
        const files = fs.readdirSync(dlesDir);
        for (const file of files) {
          if (file.endsWith('.json') && file.includes('dle-v2-')) {
            const fp = path.join(dlesDir, file);
            try {
              const existing = JSON.parse(fs.readFileSync(fp, 'utf8'));
              if (existing?.dleAddress && existing.dleAddress.toLowerCase() === dleData.dleAddress.toLowerCase()) {
                targetFile = fp;
                // Совмещаем данные (не удаляя существующие поля сетей/верификации, если присутствуют)
                dleData = { ...existing, ...dleData };
                break;
              }
            } catch (_) {}
          }
        }
      } catch (_) {}

      if (!targetFile) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `dle-v2-${ts}.json`;
        targetFile = path.join(dlesDir, fileName);
      }

      fs.writeFileSync(targetFile, JSON.stringify(dleData, null, 2));
      logger.info(`Карточка DLE сохранена: ${targetFile}`);
      return targetFile;
    } catch (e) {
      logger.error('Ошибка сохранения карточки DLE:', e);
      throw e;
    }
  }

  /**
   * Подготавливает параметры для деплоя
   * @param {Object} params - Параметры DLE из формы
   * @returns {Object} - Подготовленные параметры для скрипта деплоя
   */
  prepareDeployParams(params) {
    // Создаем копию объекта, чтобы не изменять исходный
    const deployParams = { ...params };

    // Преобразуем суммы из строк или чисел в BigNumber, если нужно
    if (deployParams.initialAmounts && Array.isArray(deployParams.initialAmounts)) {
      deployParams.initialAmounts = deployParams.initialAmounts.map(rawAmount => {
        // Принимаем как строки, так и числа; конвертируем в base units (18 знаков)
        try {
          if (typeof rawAmount === 'number' && Number.isFinite(rawAmount)) {
            if (typeof ethers.parseUnits !== 'function') {
              throw new Error('Метод ethers.parseUnits не найден');
            }
            return ethers.parseUnits(rawAmount.toString(), 18).toString();
          }
          if (typeof rawAmount === 'string') {
            const a = rawAmount.trim();
            if (a.startsWith('0x')) {
              // Уже base units (hex BigNumber) — оставляем как есть
              return BigInt(a).toString();
            }
            // Десятичная строка — конвертируем в base units
            if (typeof ethers.parseUnits !== 'function') {
              throw new Error('Метод ethers.parseUnits не найден');
            }
            return ethers.parseUnits(a, 18).toString();
          }
          // BigInt или иные типы — приводим к строке без изменения масштаба
          return rawAmount.toString();
        } catch (e) {
          // Фолбэк: безопасно привести к строке
          return String(rawAmount);
        }
      });
    }

    // Убеждаемся, что okvedCodes - это массив
    if (!Array.isArray(deployParams.okvedCodes)) {
      deployParams.okvedCodes = [];
    }

    // Преобразуем kpp в число
    if (deployParams.kpp) {
      deployParams.kpp = parseInt(deployParams.kpp) || 0;
    } else {
      deployParams.kpp = 0;
    }

    // Убеждаемся, что supportedChainIds - это массив
    if (!Array.isArray(deployParams.supportedChainIds)) {
      deployParams.supportedChainIds = [1]; // По умолчанию Ethereum
    }

    // Устанавливаем currentChainId как первую выбранную сеть
    if (deployParams.supportedChainIds.length > 0) {
      deployParams.currentChainId = deployParams.supportedChainIds[0];
    } else {
      deployParams.currentChainId = 1; // По умолчанию Ethereum
    }

    // Обрабатываем logoURI
    if (deployParams.logoURI) {
      // Если logoURI относительный путь, делаем его абсолютным
      if (deployParams.logoURI.startsWith('/uploads/')) {
        deployParams.logoURI = `http://localhost:8000${deployParams.logoURI}`;
      }
      // Если это placeholder, оставляем как есть
      if (deployParams.logoURI.includes('placeholder.com')) {
        // Оставляем как есть
      }
    }

    return deployParams;
  }

  /**
   * Сохраняет параметры во временный файл
   * @param {Object} params - Параметры для сохранения
   * @returns {string} - Путь к сохраненному файлу
   */
  saveParamsToFile(params) {
    const tempDir = path.join(__dirname, '../temp');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const fileName = `dle-v2-params-${Date.now()}.json`;
    const filePath = path.join(tempDir, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(params, null, 2));
    
    return filePath;
  }

  /**
   * Запускает скрипт деплоя DLE v2
   * @param {string} paramsFile - Путь к файлу с параметрами
   * @returns {Promise<Object>} - Результат деплоя
   */
  runDeployScript(paramsFile, extraEnv = {}) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../scripts/deploy/deploy-multichain.js');
      if (!fs.existsSync(scriptPath)) {
        reject(new Error('Скрипт деплоя DLE v2 не найден: ' + scriptPath));
        return;
      }

      const envVars = {
        ...process.env,
        RPC_URL: extraEnv.rpcUrl,
        PRIVATE_KEY: extraEnv.privateKey
      };

      const hardhatProcess = spawn('npx', ['hardhat', 'run', scriptPath], {
        cwd: path.join(__dirname, '..'),
        env: envVars,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      hardhatProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        logger.info(`[DLE v2 Deploy] ${data.toString().trim()}`);
      });

      hardhatProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.error(`[DLE v2 Deploy Error] ${data.toString().trim()}`);
      });

      hardhatProcess.on('close', (code) => {
        try {
          const result = this.extractDeployResult(stdout);
          resolve(result);
        } catch (error) {
          logger.error('Ошибка при извлечении результатов деплоя DLE v2:', error);
          if (code === 0) {
            reject(new Error('Не удалось найти информацию о созданном DLE v2'));
          } else {
            reject(new Error(`Скрипт деплоя DLE v2 завершился с кодом ${code}: ${stderr}`));
          }
        }
      });

      hardhatProcess.on('error', (error) => {
        logger.error('Ошибка запуска скрипта деплоя DLE v2:', error);
        reject(error);
      });
    });
  }

  // Мультисетевой деплой
  runDeployMultichain(paramsFile, opts = {}) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../scripts/deploy/deploy-multichain.js');
      if (!fs.existsSync(scriptPath)) return reject(new Error('Скрипт мультисетевого деплоя не найден: ' + scriptPath));
      
      const envVars = {
        ...process.env,
        PRIVATE_KEY: opts.privateKey
      };
      
      const p = spawn('npx', ['hardhat', 'run', scriptPath], { 
        cwd: path.join(__dirname, '..'), 
        env: envVars, 
        stdio: 'pipe' 
      });
      
      let stdout = '', stderr = '';
      p.stdout.on('data', (d) => { 
        stdout += d.toString(); 
        logger.info(`[MULTICHAIN_DEPLOY] ${d.toString().trim()}`); 
      });
      p.stderr.on('data', (d) => { 
        stderr += d.toString(); 
        logger.error(`[MULTICHAIN_DEPLOY_ERR] ${d.toString().trim()}`); 
      });
      
      p.on('close', (code) => {
        try {
          // Ищем результат в формате MULTICHAIN_DEPLOY_RESULT
          const resultMatch = stdout.match(/MULTICHAIN_DEPLOY_RESULT\s+(\[.*\])/);
          
          if (resultMatch) {
            const deployResults = JSON.parse(resultMatch[1]);
            
            // Преобразуем результат в нужный формат
            const addresses = deployResults.map(r => r.address);
            const allSame = addresses.every(addr => addr.toLowerCase() === addresses[0].toLowerCase());
            
            resolve({
              success: true,
              data: {
                dleAddress: addresses[0],
                networks: deployResults.map((r, index) => ({
                  chainId: r.chainId,
                  address: r.address,
                  success: true
                })),
                allSame
              }
            });
          } else {
            // Fallback: ищем адреса DLE в выводе по новому формату
            const dleAddressMatches = stdout.match(/\[MULTI_DBG\] chainId=\d+ DLE deployed at=(0x[a-fA-F0-9]{40})/g);
            if (!dleAddressMatches || dleAddressMatches.length === 0) {
              throw new Error('Не найдены адреса DLE в выводе');
            }
            
            const addresses = dleAddressMatches.map(match => match.match(/(0x[a-fA-F0-9]{40})/)[1]);
            const addr = addresses[0];
            const allSame = addresses.every(x => x.toLowerCase() === addr.toLowerCase());
            
            if (!allSame) {
              logger.warn('Адреса отличаются между сетями — продолжаем, сохраню по-сеточно', { addresses });
            }
            
            resolve({ 
              success: true, 
              data: { 
                dleAddress: addr, 
                networks: addresses.map((address, index) => ({ 
                  chainId: opts.chainIds[index] || index + 1,
                  address, 
                  success: true 
                })), 
                allSame 
              } 
            });
          }
        } catch (e) {
          reject(new Error(`Ошибка мультисетевого деплоя: ${e.message}\nSTDOUT:${stdout}\nSTDERR:${stderr}`));
        }
      });
      
      p.on('error', (e) => reject(e));
    });
  }

  /**
   * Извлекает результат деплоя из stdout
   * @param {string} stdout - Вывод скрипта
   * @returns {Object} - Результат деплоя
   */
  extractDeployResult(stdout) {
    // Ищем результат в формате MULTICHAIN_DEPLOY_RESULT
    const resultMatch = stdout.match(/MULTICHAIN_DEPLOY_RESULT\s+(\[.*?\])/);
    
    if (resultMatch) {
      try {
        const result = JSON.parse(resultMatch[1]);
        return result;
      } catch (e) {
        logger.error('Ошибка парсинга JSON результата:', e);
      }
    }

    // Fallback: ищем строки с адресами в выводе по новому формату
    const dleAddressMatch = stdout.match(/\[MULTI_DBG\] chainId=\d+ DLE deployed at=(0x[a-fA-F0-9]{40})/);

    if (dleAddressMatch) {
      return {
        success: true,
        data: {
          dleAddress: dleAddressMatch[1],
          version: 'v2'
        }
      };
    }

    // Если не нашли адрес, выводим весь stdout для отладки
    console.log('Полный вывод скрипта:', stdout);
    throw new Error('Не удалось извлечь адрес DLE из вывода скрипта');
  }

  /**
   * Очищает временные файлы
   * @param {string} paramsFile - Путь к файлу параметров
   * @param {string} tempParamsFile - Путь к временному файлу параметров
   */
  cleanupTempFiles(paramsFile, tempParamsFile) {
    try {
      if (fs.existsSync(paramsFile)) {
        fs.unlinkSync(paramsFile);
      }
      if (fs.existsSync(tempParamsFile)) {
        fs.unlinkSync(tempParamsFile);
      }
    } catch (error) {
      logger.warn('Не удалось очистить временные файлы:', error);
    }
  }

  /**
   * Удаляет временные файлы параметров деплоя старше заданного возраста
   * @param {number} maxAgeMs - Макс. возраст файлов в миллисекундах (по умолчанию 24ч)
   */
  pruneOldTempFiles(maxAgeMs = 24 * 60 * 60 * 1000) {
    const tempDir = path.join(__dirname, '../temp');
    try {
      if (!fs.existsSync(tempDir)) return;
      const now = Date.now();
      const files = fs.readdirSync(tempDir).filter(f => f.startsWith('dle-v2-params-') && f.endsWith('.json'));
      for (const f of files) {
        const fp = path.join(tempDir, f);
        try {
          const st = fs.statSync(fp);
          if (now - st.mtimeMs > maxAgeMs) {
            fs.unlinkSync(fp);
            logger.info(`Удалён старый временный файл: ${fp}`);
          }
        } catch (e) {
          logger.warn(`Не удалось обработать файл ${fp}: ${e.message}`);
        }
      }
    } catch (e) {
      logger.warn('Ошибка pruneOldTempFiles:', e.message);
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
      const allDles = files
        .filter(file => file.endsWith('.json') && file.includes('dle-v2-'))
        .map(file => {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(dlesDir, file), 'utf8'));
            return { ...data, _fileName: file };
          } catch (error) {
            logger.error(`Ошибка при чтении файла ${file}:`, error);
            return null;
          }
        })
        .filter(dle => dle !== null);

      // Группируем DLE по мультичейн деплоям
      const groupedDles = this.groupMultichainDLEs(allDles);
      
      return groupedDles;
    } catch (error) {
      logger.error('Ошибка при получении списка DLE v2:', error);
      return [];
    }
  }

  /**
   * Группирует DLE по мультичейн деплоям
   * @param {Array<Object>} allDles - Все DLE из файлов
   * @returns {Array<Object>} - Сгруппированные DLE
   */
  groupMultichainDLEs(allDles) {
    const groups = new Map();
    
    for (const dle of allDles) {
      // Создаем ключ для группировки на основе общих параметров
      const groupKey = this.createGroupKey(dle);
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          // Основные данные из первого DLE
          name: dle.name,
          symbol: dle.symbol,
          location: dle.location,
          coordinates: dle.coordinates,
          jurisdiction: dle.jurisdiction,
          oktmo: dle.oktmo,
          okvedCodes: dle.okvedCodes,
          kpp: dle.kpp,
          quorumPercentage: dle.quorumPercentage,
          version: dle.version || 'v2',
          deployedMultichain: true,
          // Мультичейн информация
          networks: [],
          // Модули (одинаковые во всех сетях)
          modules: dle.modules,
          // Время создания (самое раннее)
          creationTimestamp: dle.creationTimestamp,
          creationBlock: dle.creationBlock
        });
      }
      
      const group = groups.get(groupKey);
      
      // Если у DLE есть массив networks, используем его
      if (dle.networks && Array.isArray(dle.networks)) {
        for (const network of dle.networks) {
          group.networks.push({
            chainId: network.chainId,
            dleAddress: network.address || network.dleAddress,
            factoryAddress: network.factoryAddress,
            rpcUrl: network.rpcUrl || this.getRpcUrlForChain(network.chainId)
          });
        }
      } else {
        // Старый формат: добавляем информацию о сети из корня DLE
        group.networks.push({
          chainId: dle.chainId,
          dleAddress: dle.dleAddress,
          factoryAddress: dle.factoryAddress,
          rpcUrl: dle.rpcUrl || this.getRpcUrlForChain(dle.chainId)
        });
      }
      
      // Обновляем время создания на самое раннее
      if (dle.creationTimestamp && (!group.creationTimestamp || dle.creationTimestamp < group.creationTimestamp)) {
        group.creationTimestamp = dle.creationTimestamp;
      }
    }
    
    // Преобразуем группы в массив
    return Array.from(groups.values()).map(group => ({
      ...group,
      // Основной адрес DLE (из первой сети)
      dleAddress: group.networks[0]?.dleAddress,
      // Общее количество сетей
      totalNetworks: group.networks.length,
      // Поддерживаемые сети
      supportedChainIds: group.networks.map(n => n.chainId)
    }));
  }

  /**
   * Создает ключ для группировки DLE
   * @param {Object} dle - Данные DLE
   * @returns {string} - Ключ группировки
   */
  createGroupKey(dle) {
    // Группируем по основным параметрам DLE
    const keyParts = [
      dle.name,
      dle.symbol,
      dle.location,
      dle.coordinates,
      dle.jurisdiction,
      dle.oktmo,
      dle.kpp,
      dle.quorumPercentage,
      // Сортируем okvedCodes для стабильного ключа
      Array.isArray(dle.okvedCodes) ? dle.okvedCodes.sort().join(',') : '',
      // Сортируем supportedChainIds для стабильного ключа
      Array.isArray(dle.supportedChainIds) ? dle.supportedChainIds.sort().join(',') : ''
    ];
    
    return keyParts.join('|');
  }

  /**
   * Получает RPC URL для сети
   * @param {number} chainId - ID сети
   * @returns {string|null} - RPC URL
   */
  getRpcUrlForChain(chainId) {
    try {
      // Простая маппинг для основных сетей
      const rpcMap = {
        1: 'https://eth-mainnet.g.alchemy.com/v2/demo',
        11155111: 'https://eth-sepolia.nodereal.io/v1/56dec8028bae4f26b76099a42dae2b52',
        17000: 'https://ethereum-holesky.publicnode.com',
        421614: 'https://sepolia-rollup.arbitrum.io/rpc',
        84532: 'https://sepolia.base.org'
      };
      return rpcMap[chainId] || null;
    } catch (error) {
      return null;
    }
  }

  // Авто-расчёт INIT_CODE_HASH
  async computeInitCodeHash(params) {
    try {
      // Проверяем наличие обязательных параметров
      if (!params.name || !params.symbol || !params.location) {
        throw new Error('Отсутствуют обязательные параметры для вычисления INIT_CODE_HASH');
      }

      const hre = require('hardhat');
      const { ethers } = hre;
      
      // Проверяем, что контракт DLE существует
      try {
        const DLE = await hre.ethers.getContractFactory('DLE');
        if (!DLE) {
          throw new Error('Контракт DLE не найден в Hardhat');
        }
      } catch (contractError) {
        throw new Error(`Ошибка загрузки контракта DLE: ${contractError.message}`);
      }
      
      const DLE = await hre.ethers.getContractFactory('DLE');
      const dleConfig = {
        name: params.name,
        symbol: params.symbol,
        location: params.location,
        coordinates: params.coordinates || "",
        jurisdiction: params.jurisdiction || 1,
        okvedCodes: params.okvedCodes || [],
        kpp: params.kpp || 0,
        quorumPercentage: params.quorumPercentage || 51,
        initialPartners: params.initialPartners || [],
        initialAmounts: params.initialAmounts || [],
        supportedChainIds: params.supportedChainIds || [1]
      };
      // Учитываем актуальную сигнатуру конструктора: (dleConfig, currentChainId, initializer)
      const initializer = params.initializerAddress || "0x0000000000000000000000000000000000000000";
      const currentChainId = params.currentChainId || 1; // Fallback на Ethereum mainnet
      
      logger.info('Вычисление INIT_CODE_HASH с параметрами:', {
        name: dleConfig.name,
        symbol: dleConfig.symbol,
        currentChainId,
        initializer
      });
      
      // Проверяем, что метод getDeployTransaction существует
      if (typeof DLE.getDeployTransaction !== 'function') {
        throw new Error('Метод getDeployTransaction не найден в контракте DLE');
      }
      
      const deployTx = await DLE.getDeployTransaction(dleConfig, currentChainId, initializer);
      if (!deployTx || !deployTx.data) {
        throw new Error('Не удалось получить данные транзакции деплоя');
      }
      
      const initCode = deployTx.data;
      
      // Проверяем, что метод keccak256 существует
      if (typeof ethers.keccak256 !== 'function') {
        throw new Error('Метод ethers.keccak256 не найден');
      }
      
      const hash = ethers.keccak256(initCode);
      
      logger.info('INIT_CODE_HASH вычислен успешно:', hash);
      return hash;
    } catch (error) {
      logger.error('Ошибка при вычислении INIT_CODE_HASH:', error);
      // Fallback: возвращаем хеш на основе параметров
      const { ethers } = require('ethers');
      const fallbackData = JSON.stringify({
        name: params.name,
        symbol: params.symbol,
        location: params.location,
        jurisdiction: params.jurisdiction,
        supportedChainIds: params.supportedChainIds
      });
      
      // Проверяем, что методы существуют
      if (typeof ethers.toUtf8Bytes !== 'function') {
        throw new Error('Метод ethers.toUtf8Bytes не найден');
      }
      if (typeof ethers.keccak256 !== 'function') {
        throw new Error('Метод ethers.keccak256 не найден');
      }
      
      return ethers.keccak256(ethers.toUtf8Bytes(fallbackData));
    }
  }



  /**
   * Проверяет балансы в указанных сетях
   * @param {number[]} chainIds - Массив chainId для проверки
   * @param {string} privateKey - Приватный ключ
   * @returns {Promise<Object>} - Результат проверки балансов
   */
  async checkBalances(chainIds, privateKey) {
    const { getRpcUrlByChainId } = require('./rpcProviderService');
    const { ethers } = require('ethers');
    const balances = [];
    const insufficient = [];

    for (const chainId of chainIds) {
      try {
        const rpcUrl = await getRpcUrlByChainId(chainId);
        if (!rpcUrl) {
          balances.push({
            chainId,
            balanceEth: '0',
            ok: false,
            error: 'RPC URL не найден'
          });
          insufficient.push(chainId);
          continue;
        }

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        const balance = await provider.getBalance(wallet.address);
        
        if (typeof ethers.formatEther !== 'function') {
          throw new Error('Метод ethers.formatEther не найден');
        }
        const balanceEth = ethers.formatEther(balance);
        
        if (typeof ethers.parseEther !== 'function') {
          throw new Error('Метод ethers.parseEther не найден');
        }
        const minBalance = ethers.parseEther("0.001");
        const ok = balance >= minBalance;

        balances.push({
          chainId,
          address: wallet.address,
          balanceEth,
          ok
        });

        if (!ok) {
          insufficient.push(chainId);
        }

      } catch (error) {
        balances.push({
          chainId,
          balanceEth: '0',
          ok: false,
          error: error.message
        });
        insufficient.push(chainId);
      }
    }

    return {
      balances,
      insufficient,
      allSufficient: insufficient.length === 0
    };
  }

  /**
   * Авто-верификация контракта во всех выбранных сетях через Etherscan V2
   * @param {Object} args
   * @param {Object} args.deployParams
   * @param {Object} args.deployResult - { success, data: { dleAddress, networks: [{rpcUrl,address}] } }
   * @param {string} [args.apiKey]
   */
  async autoVerifyAcrossChains({ deployParams, deployResult, apiKey }) {
    if (!deployResult?.success) throw new Error('Нет результата деплоя для верификации');

    // Подхватить ключ из secrets, если аргумент не передан
    if (!apiKey) {
      try {
        const { getSecret } = require('./secretStore');
        apiKey = await getSecret('ETHERSCAN_V2_API_KEY');
      } catch (_) {}
    }

    // Получаем компилер, standard-json-input и contractName из artifacts/build-info
    const { standardJson, compilerVersion, contractName, constructorArgsHex } = await this.prepareVerificationPayload(deployParams);

    // Для каждой сети отправим верификацию, используя адрес из результата для соответствующего chainId
    const chainIds = Array.isArray(deployParams.supportedChainIds) ? deployParams.supportedChainIds : [];
    const netMap = new Map();
    if (Array.isArray(deployResult.data?.networks)) {
      for (const n of deployResult.data.networks) {
        if (n && typeof n.chainId === 'number') netMap.set(n.chainId, n.address);
      }
    }
    for (const cid of chainIds) {
      try {
        const addrForChain = netMap.get(cid);
        if (!addrForChain) {
          logger.warn(`[AutoVerify] Нет адреса для chainId=${cid} в результате деплоя, пропускаю`);
          continue;
        }
        const guid = await etherscanV2.submitVerification({
          chainId: cid,
          contractAddress: addrForChain,
          contractName,
          compilerVersion,
          standardJsonInput: standardJson,
          constructorArgsHex,
          apiKey
        });
        logger.info(`[AutoVerify] Отправлена верификация в chainId=${cid}, guid=${guid}`);
        verificationStore.updateChain(addrForChain, cid, { guid, status: 'submitted' });
      } catch (e) {
        logger.warn(`[AutoVerify] Ошибка отправки верификации для chainId=${cid}: ${e.message}`);
        const addrForChain = netMap.get(cid) || 'unknown';
        verificationStore.updateChain(addrForChain, cid, { status: `error: ${e.message}` });
      }
    }
  }

  /**
   * Формирует стандартный JSON input, compilerVersion, contractName и ABI-кодированные аргументы конструктора
   */
  async prepareVerificationPayload(params) {
    const hre = require('hardhat');
    const path = require('path');
    const fs = require('fs');

    // 1) Найти самый свежий build-info
    const buildInfoDir = path.join(__dirname, '..', 'artifacts', 'build-info');
    let latestFile = null;
    try {
      const entries = fs.readdirSync(buildInfoDir).filter(f => f.endsWith('.json'));
      let bestMtime = 0;
      for (const f of entries) {
        const fp = path.join(buildInfoDir, f);
        const st = fs.statSync(fp);
        if (st.mtimeMs > bestMtime) { bestMtime = st.mtimeMs; latestFile = fp; }
      }
    } catch (e) {
      logger.warn('Артефакты build-info не найдены:', e.message);
    }

    let standardJson = null;
    let compilerVersion = null;
    let sourcePathForDLE = 'contracts/DLE.sol';
    let contractName = 'contracts/DLE.sol:DLE';

    if (latestFile) {
      try {
        const buildInfo = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
        // input — это стандартный JSON input для solc
        standardJson = buildInfo.input || null;
        // Версия компилятора
        const long = buildInfo.solcLongVersion || buildInfo.solcVersion || hre.config.solidity?.version;
        compilerVersion = long ? (long.startsWith('v') ? long : `v${long}`) : undefined;

        // Найти путь контракта DLE
        if (buildInfo.output && buildInfo.output.contracts) {
          for (const [filePathKey, contractsMap] of Object.entries(buildInfo.output.contracts)) {
            if (contractsMap && contractsMap['DLE']) {
              sourcePathForDLE = filePathKey;
              contractName = `${filePathKey}:DLE`;
              break;
            }
          }
        }
      } catch (e) {
        logger.warn('Не удалось прочитать build-info:', e.message);
      }
    }

    // Если не нашли — fallback на config
    if (!compilerVersion) compilerVersion = `v${hre.config.solidity.compilers?.[0]?.version || hre.config.solidity.version}`;
    if (!standardJson) {
      // fallback минимальная структура
      standardJson = {
        language: 'Solidity',
        sources: { [sourcePathForDLE]: { content: '' } },
        settings: { optimizer: { enabled: true, runs: 200 } }
      };
    }

    // 2) Посчитать ABI-код аргументов конструктора через сравнение с bytecode
    // Конструктор: (dleConfig, currentChainId, initializer)
    const Factory = await hre.ethers.getContractFactory('DLE');
    const dleConfig = {
      name: params.name,
      symbol: params.symbol,
      location: params.location,
      coordinates: params.coordinates,
      jurisdiction: params.jurisdiction,
      okvedCodes: params.okvedCodes || [],
      kpp: params.kpp,
      quorumPercentage: params.quorumPercentage,
      initialPartners: params.initialPartners,
      initialAmounts: params.initialAmounts,
      supportedChainIds: params.supportedChainIds
    };
    const initializer = params.initialPartners?.[0] || "0x0000000000000000000000000000000000000000";
    const deployTx = await Factory.getDeployTransaction(dleConfig, params.currentChainId, initializer);
    const fullData = deployTx.data; // 0x + creation bytecode + encoded args
    const bytecode = Factory.bytecode; // 0x + creation bytecode
    let constructorArgsHex;
    try {
      if (fullData && bytecode && fullData.startsWith(bytecode)) {
        constructorArgsHex = '0x' + fullData.slice(bytecode.length);
      }
    } catch (e) {
      logger.warn('Не удалось выделить constructorArguments из deployTx.data:', e.message);
    }

    return { standardJson, compilerVersion, contractName, constructorArgsHex };
  }
}

module.exports = new DLEV2Service(); 