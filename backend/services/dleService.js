const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { getRpcUrlByNetworkId } = require('./rpcProviderService');

/**
 * Сервис для управления DLE (Digital Legal Entity)
 */
class DLEService {
  /**
   * Создает новое DLE с заданными параметрами
   * @param {Object} dleParams - Параметры DLE
   * @returns {Promise<Object>} - Результат создания DLE
   */
  async createDLE(dleParams) {
    try {
      logger.info('Начало создания DLE с параметрами:', dleParams);

      // Валидация входных данных
      this.validateDLEParams(dleParams);

      // Подготовка параметров для деплоя
      const deployParams = this.prepareDeployParams(dleParams);

      // Сохраняем параметры во временный файл
      const paramsFile = this.saveParamsToFile(deployParams);

      // Копируем параметры во временный файл с предсказуемым именем
      const tempParamsFile = path.join(__dirname, '../scripts/deploy/current-params.json');
      logger.info(`Копирование параметров из ${paramsFile} в ${tempParamsFile}`);
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

      logger.info('DLE успешно создано:', result);
      return result;
    } catch (error) {
      logger.error('Ошибка при создании DLE:', error);
      throw error;
    }
  }

  /**
   * Валидирует параметры DLE
   * @param {Object} params - Параметры DLE
   */
  validateDLEParams(params) {
    const requiredFields = [
      'name', 'symbol', 'location', 'isicCodes', 
      'partners', 'amounts', 'minTimelockDelay',
      'votingDelay', 'votingPeriod', 'proposalThreshold', 'quorumPercentage'
    ];

    for (const field of requiredFields) {
      if (params[field] === undefined) {
        throw new Error(`Отсутствует обязательный параметр: ${field}`);
      }
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

    // Преобразуем proposalThreshold в BigNumber, если нужно
    if (typeof deployParams.proposalThreshold === 'string' && !deployParams.proposalThreshold.startsWith('0x')) {
      deployParams.proposalThreshold = ethers.parseEther(deployParams.proposalThreshold).toString();
    } else {
      deployParams.proposalThreshold = deployParams.proposalThreshold.toString();
    }

    return deployParams;
  }

  /**
   * Сохраняет параметры деплоя во временный файл
   * @param {Object} params - Параметры деплоя
   * @returns {string} - Путь к файлу с параметрами
   */
  saveParamsToFile(params) {
    const tempDir = path.join(__dirname, '../temp');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const fileName = `dle-params-${Date.now()}.json`;
    const filePath = path.join(tempDir, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(params, null, 2));
    
    return filePath;
  }

  /**
   * Запускает скрипт деплоя DLE
   * @param {string} paramsFile - Путь к файлу с параметрами
   * @returns {Promise<Object>} - Результат деплоя
   */
  runDeployScript(paramsFile, extraEnv = {}) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../scripts/deploy/create-dle-manual.js');
      if (!fs.existsSync(scriptPath)) {
        reject(new Error('Скрипт деплоя не найден: ' + scriptPath));
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
        const output = data.toString();
        stdout += output;
        logger.debug(`[Hardhat] ${output}`);
      });

      hardhatProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        logger.error(`[Hardhat Error] ${output}`);
      });

      hardhatProcess.on('close', (code) => {
        if (code !== 0) {
          logger.error(`Скрипт деплоя завершился с кодом: ${code}`);
          reject(new Error(`Ошибка деплоя: ${stderr}`));
          return;
        }

        // Пытаемся извлечь адреса контрактов из вывода
        try {
          const tokenAddressMatch = stdout.match(/Адрес токена: (0x[a-fA-F0-9]{40})/);
          const timelockAddressMatch = stdout.match(/Адрес таймлока: (0x[a-fA-F0-9]{40})/);
          const governorAddressMatch = stdout.match(/Адрес контракта Governor: (0x[a-fA-F0-9]{40})/);

          if (tokenAddressMatch && timelockAddressMatch && governorAddressMatch) {
            resolve({
              tokenAddress: tokenAddressMatch[1],
              timelockAddress: timelockAddressMatch[1],
              governorAddress: governorAddressMatch[1],
              success: true
            });
          } else {
            // Если не удалось извлечь адреса, ищем файл с результатами
            const dlesDir = path.join(__dirname, '../contracts-data/dles');
            if (fs.existsSync(dlesDir)) {
              const files = fs.readdirSync(dlesDir);
              if (files.length > 0) {
                // Берем самый свежий файл
                const latestFile = files
                  .map(f => ({ name: f, time: fs.statSync(path.join(dlesDir, f)).mtime.getTime() }))
                  .sort((a, b) => b.time - a.time)[0].name;
                  
                const dleData = JSON.parse(fs.readFileSync(path.join(dlesDir, latestFile), 'utf8'));
                resolve({
                  ...dleData,
                  success: true
                });
              } else {
                reject(new Error('Не удалось найти информацию о созданном DLE'));
              }
            } else {
              reject(new Error('Не удалось найти директорию с результатами создания DLE'));
            }
          }
        } catch (error) {
          logger.error('Ошибка при извлечении результатов деплоя:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Получает список всех созданных DLE
   * @returns {Array<Object>} - Список DLE
   */
  getAllDLEs() {
    try {
      const dlesDir = path.join(__dirname, '../contracts-data/dles');
      
      if (!fs.existsSync(dlesDir)) {
        return [];
      }
      
      const files = fs.readdirSync(dlesDir);
      return files
        .filter(file => file.endsWith('.json') && file !== 'test.json' && file !== 'node-test.json')
        .map(file => {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(dlesDir, file), 'utf8'));
            // Добавляем имя файла к данным DLE для возможности удаления пустых DLE
            return { ...data, _fileName: file };
          } catch (error) {
            logger.error(`Ошибка при чтении файла ${file}:`, error);
            // Для поврежденных файлов возвращаем минимальную информацию
            return { 
              _fileName: file,
              _corrupted: true
            };
          }
        });
    } catch (error) {
      logger.error('Ошибка при получении списка DLE:', error);
      throw error;
    }
  }
}

module.exports = new DLEService(); 