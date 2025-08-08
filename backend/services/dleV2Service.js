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
    try {
      logger.info('Начало создания DLE v2 с параметрами:', dleParams);

      // Валидация входных данных
      this.validateDLEParams(dleParams);

      // Подготовка параметров для деплоя
      const deployParams = this.prepareDeployParams(dleParams);

      // Сохраняем параметры во временный файл
      const paramsFile = this.saveParamsToFile(deployParams);

      // Копируем параметры во временный файл с предсказуемым именем
      const tempParamsFile = path.join(__dirname, '../scripts/deploy/current-params.json');
      const deployDir = path.dirname(tempParamsFile);
      if (!fs.existsSync(deployDir)) {
        fs.mkdirSync(deployDir, { recursive: true });
      }
      fs.copyFileSync(paramsFile, tempParamsFile);
      logger.info(`Файл параметров скопирован успешно`);

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

      // Лёгкая проверка баланса в первой сети
      {
        const { ethers } = require('ethers');
        const provider = new ethers.JsonRpcProvider(rpcUrls[0]);
        const walletAddress = dleParams.privateKey ? new ethers.Wallet(dleParams.privateKey, provider).address : null;
        if (walletAddress) {
          const balance = await provider.getBalance(walletAddress);
          const minBalance = ethers.parseEther("0.00001");
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
      const initCodeHash = await this.computeInitCodeHash(deployParams);

      // Собираем адреса фабрик по сетям (если есть)
      const factoryAddresses = deployParams.supportedChainIds.map(cid => process.env[`FACTORY_ADDRESS_${cid}`] || '').join(',');

      // Мультисетевой деплой одним вызовом
      const result = await this.runDeployMultichain(paramsFile, {
        rpcUrls: rpcUrls.join(','),
        privateKey: dleParams.privateKey,
        salt: process.env.CREATE2_SALT,
        initCodeHash,
        factories: factoryAddresses
      });

      // Очищаем временные файлы
      this.cleanupTempFiles(paramsFile, tempParamsFile);

      return result;

    } catch (error) {
      logger.error('Ошибка при создании DLE v2:', error);
      throw error;
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
      if (!ethers.isAddress(params.initialPartners[i])) {
        throw new Error(`Неверный адрес партнера ${i + 1}: ${params.initialPartners[i]}`);
      }
    }

    // Проверяем, что выбраны сети
    if (!params.supportedChainIds || !Array.isArray(params.supportedChainIds) || params.supportedChainIds.length === 0) {
      throw new Error('Должна быть выбрана хотя бы одна сеть для деплоя');
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
      deployParams.initialAmounts = deployParams.initialAmounts.map(amount => {
        if (typeof amount === 'string' && !amount.startsWith('0x')) {
          return ethers.parseEther(amount).toString();
        }
        return amount.toString();
      });
    }

    // Убеждаемся, что okvedCodes - это массив
    if (!Array.isArray(deployParams.okvedCodes)) {
      deployParams.okvedCodes = [];
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
      const scriptPath = path.join(__dirname, '../scripts/deploy/create-dle-v2.js');
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
      if (!fs.existsSync(scriptPath)) return reject(new Error('Скрипт мультисетевого деплоя не найден'));
      const envVars = {
        ...process.env,
        PRIVATE_KEY: opts.privateKey,
        CREATE2_SALT: opts.salt,
        INIT_CODE_HASH: opts.initCodeHash,
        MULTICHAIN_RPC_URLS: opts.rpcUrls,
        MULTICHAIN_FACTORY_ADDRESSES: opts.factories || ''
      };
      const p = spawn('npx', ['hardhat', 'run', scriptPath], { cwd: path.join(__dirname, '..'), env: envVars, stdio: 'pipe' });
      let stdout = '', stderr = '';
      p.stdout.on('data', (d) => { stdout += d.toString(); logger.info(`[MULTI] ${d.toString().trim()}`); });
      p.stderr.on('data', (d) => { stderr += d.toString(); logger.error(`[MULTI_ERR] ${d.toString().trim()}`); });
      p.on('close', () => {
        try {
          const m = stdout.match(/MULTICHAIN_DEPLOY_RESULT\s*(\[.*\])/s);
          if (!m) throw new Error('Результат не найден');
          const arr = JSON.parse(m[1]);
          const addr = arr[0].address;
          const allSame = arr.every(x => x.address.toLowerCase() === addr.toLowerCase());
          if (!allSame) throw new Error('Адреса отличаются между сетями');
          resolve({ success: true, data: { dleAddress: addr, networks: arr } });
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
    // Ищем строки с адресами в выводе
    const dleAddressMatch = stdout.match(/DLE v2 задеплоен по адресу: (0x[a-fA-F0-9]{40})/);

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
      return files
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
    } catch (error) {
      logger.error('Ошибка при получении списка DLE v2:', error);
      return [];
    }
  }

  // Авто-расчёт INIT_CODE_HASH
  async computeInitCodeHash(params) {
    const hre = require('hardhat');
    const { ethers } = hre;
    const DLE = await hre.ethers.getContractFactory('DLE');
    const dleConfig = {
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
      supportedChainIds: params.supportedChainIds
    };
    const deployTx = await DLE.getDeployTransaction(dleConfig, params.currentChainId);
    const initCode = deployTx.data;
    return ethers.keccak256(initCode);
  }
}

module.exports = new DLEV2Service(); 