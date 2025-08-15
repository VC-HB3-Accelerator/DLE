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

      // Сохраняем параметры во временный файл
      paramsFile = this.saveParamsToFile(deployParams);

      // Копируем параметры во временный файл с предсказуемым именем
      tempParamsFile = path.join(__dirname, '../scripts/deploy/current-params.json');
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
        if (dleParams.privateKey) {
          const pk = dleParams.privateKey.startsWith('0x') ? dleParams.privateKey : `0x${dleParams.privateKey}`;
          const walletAddress = new ethers.Wallet(pk, provider).address;
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
      // Генерируем одноразовый CREATE2_SALT и сохраняем его с уникальным ключом в secrets
      const { createAndStoreNewCreate2Salt } = require('./secretStore');
      const { salt: create2Salt, key: saltKey } = await createAndStoreNewCreate2Salt({ label: deployParams.name || 'DLEv2' });
      logger.info(`CREATE2_SALT создан и сохранён: key=${saltKey}`);

      const result = await this.runDeployMultichain(paramsFile, {
        rpcUrls: rpcUrls.join(','),
        privateKey: dleParams.privateKey?.startsWith('0x') ? dleParams.privateKey : `0x${dleParams.privateKey}`,
        salt: create2Salt,
        initCodeHash,
        factories: factoryAddresses
      });

      // Сохраняем информацию о созданном DLE для отображения на странице управления
      try {
        const firstNet = Array.isArray(result?.data?.networks) && result.data.networks.length > 0 ? result.data.networks[0] : null;
        const dleData = {
          name: deployParams.name,
          symbol: deployParams.symbol,
          location: deployParams.location,
          coordinates: deployParams.coordinates,
          jurisdiction: deployParams.jurisdiction,
          oktmo: deployParams.oktmo,
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
          dleAddress: (result?.data?.dleAddress) || (firstNet?.address) || null,
          version: 'v2',
          networks: result?.data?.networks || [],
          createdAt: new Date().toISOString()
        };
        if (dleData.dleAddress) {
          this.saveDLEData(dleData);
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
            return ethers.parseUnits(rawAmount.toString(), 18).toString();
          }
          if (typeof rawAmount === 'string') {
            const a = rawAmount.trim();
            if (a.startsWith('0x')) {
              // Уже base units (hex BigNumber) — оставляем как есть
              return BigInt(a).toString();
            }
            // Десятичная строка — конвертируем в base units
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
          if (!Array.isArray(arr) || arr.length === 0) throw new Error('Пустой результат деплоя');
          const addr = arr[0].address;
          const allSame = arr.every(x => x.address && x.address.toLowerCase() === addr.toLowerCase());
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

  /**
   * Проверяет баланс деплоера во всех выбранных сетях
   * @param {number[]} chainIds
   * @param {string} privateKey
   * @returns {Promise<{balances: Array<{chainId:number, balanceEth:string, ok:boolean, rpcUrl:string}>, insufficient:number[]}>}
   */
  async checkBalances(chainIds, privateKey) {
    const { ethers } = require('ethers');
    const results = [];
    const insufficient = [];
    const normalizedPk = privateKey?.startsWith('0x') ? privateKey : `0x${privateKey}`;
    for (const cid of chainIds || []) {
      const rpcUrl = await getRpcUrlByChainId(cid);
      if (!rpcUrl) {
        results.push({ chainId: cid, balanceEth: '0', ok: false, rpcUrl: null });
        insufficient.push(cid);
        continue;
      }
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(normalizedPk, provider);
        const bal = await provider.getBalance(wallet.address);
        // Минимум для деплоя; можно скорректировать
        const min = ethers.parseEther('0.002');
        const ok = bal >= min;
        results.push({ chainId: cid, balanceEth: ethers.formatEther(bal), ok, rpcUrl });
        if (!ok) insufficient.push(cid);
      } catch (e) {
        results.push({ chainId: cid, balanceEth: '0', ok: false, rpcUrl });
        insufficient.push(cid);
      }
    }
    return { balances: results, insufficient };
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
    // Конструктор: (dleConfig, currentChainId)
    const Factory = await hre.ethers.getContractFactory('DLE');
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
    const deployTx = await Factory.getDeployTransaction(dleConfig, params.currentChainId);
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