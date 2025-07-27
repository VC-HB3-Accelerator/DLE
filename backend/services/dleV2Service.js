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
const { getRpcUrlByNetworkId } = require('./rpcProviderService');

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

      // Получаем rpc_url из базы по выбранной сети
      const rpcUrl = await getRpcUrlByNetworkId(deployParams.network);
      if (!rpcUrl) {
        throw new Error(`RPC URL для сети ${deployParams.network} не найден в базе данных`);
      }
      if (!dleParams.privateKey) {
        throw new Error('Приватный ключ для деплоя не передан');
      }

      // Запускаем скрипт деплоя с нужными переменными окружения
      const result = await this.runDeployScript(paramsFile, {
        rpcUrl,
        privateKey: dleParams.privateKey,
        networkId: deployParams.network,
        envNetworkKey: deployParams.network.toUpperCase()
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

    if (!params.partners || !Array.isArray(params.partners)) {
      throw new Error('Партнеры должны быть массивом');
    }

    if (!params.amounts || !Array.isArray(params.amounts)) {
      throw new Error('Суммы должны быть массивом');
    }

    if (params.partners.length !== params.amounts.length) {
      throw new Error('Количество партнеров должно соответствовать количеству сумм распределения');
    }

    if (params.partners.length === 0) {
      throw new Error('Должен быть указан хотя бы один партнер');
    }

    if (params.quorumPercentage > 100) {
      throw new Error('Процент кворума не может превышать 100%');
    }

    // Проверяем адреса партнеров
    for (let i = 0; i < params.partners.length; i++) {
      if (!ethers.isAddress(params.partners[i])) {
        throw new Error(`Неверный адрес партнера ${i + 1}: ${params.partners[i]}`);
      }
    }
  }

  /**
   * Подготавливает параметры для деплоя
   * @param {Object} params - Параметры DLE
   * @returns {Object} - Подготовленные параметры
   */
  prepareDeployParams(params) {
    // Создаем копию объекта, чтобы не изменять исходный
    const deployParams = { ...params };

    // Преобразуем суммы из строк или чисел в BigNumber, если нужно
    deployParams.amounts = params.amounts.map(amount => {
      if (typeof amount === 'string' && !amount.startsWith('0x')) {
        return ethers.parseEther(amount).toString();
      }
      return amount.toString();
    });

    // Преобразуем параметры голосования
    deployParams.votingDelay = params.votingDelay || 1;
    deployParams.votingPeriod = params.votingPeriod || 45818; // ~1 неделя
    deployParams.proposalThreshold = params.proposalThreshold || ethers.parseEther("100000").toString();
    deployParams.quorumPercentage = params.quorumPercentage || 4;
    deployParams.minTimelockDelay = params.minTimelockDelay || 2;

    // Убеждаемся, что isicCodes - это массив
    if (!Array.isArray(deployParams.isicCodes)) {
      deployParams.isicCodes = [];
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

      // Формируем универсальные переменные окружения
      const envVars = {
        ...process.env,
        [`${extraEnv.envNetworkKey}_RPC_URL`]: extraEnv.rpcUrl,
        [`${extraEnv.envNetworkKey}_PRIVATE_KEY`]: extraEnv.privateKey
      };

      // Запускаем скрипт с нужной сетью
      const hardhatProcess = spawn('npx', ['hardhat', 'run', scriptPath, '--network', extraEnv.networkId], {
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
        if (code === 0) {
          try {
            // Пытаемся извлечь результат из stdout
            const result = this.extractDeployResult(stdout);
            resolve(result);
          } catch (error) {
            logger.error('Ошибка при извлечении результатов деплоя DLE v2:', error);
            reject(new Error('Не удалось найти информацию о созданном DLE v2'));
          }
        } else {
          reject(new Error(`Скрипт деплоя DLE v2 завершился с кодом ${code}: ${stderr}`));
        }
      });

      hardhatProcess.on('error', (error) => {
        logger.error('Ошибка запуска скрипта деплоя DLE v2:', error);
        reject(error);
      });
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
    const timelockAddressMatch = stdout.match(/Таймлок создан по адресу: (0x[a-fA-F0-9]{40})/);

    if (dleAddressMatch && timelockAddressMatch) {
      return {
        success: true,
        data: {
          dleAddress: dleAddressMatch[1],
          timelockAddress: timelockAddressMatch[1],
          version: 'v2'
        }
      };
    }

    throw new Error('Не удалось извлечь адреса из вывода скрипта');
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
}

module.exports = new DLEV2Service(); 