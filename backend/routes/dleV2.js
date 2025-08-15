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
const dleV2Service = require('../services/dleV2Service');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const ethers = require('ethers'); // Added ethers for private key validation
const create2 = require('../utils/create2');
const verificationStore = require('../services/verificationStore');
const etherscanV2 = require('../services/etherscanV2VerificationService');

/**
 * @route   POST /api/dle-v2
 * @desc    Создать новое DLE v2 (Digital Legal Entity)
 * @access  Private (только для авторизованных пользователей с ролью admin)
 */
router.post('/', auth.requireAuth, auth.requireAdmin, async (req, res, next) => {
  try {
    const dleParams = req.body;
    logger.info('Получен запрос на создание DLE v2:', dleParams);
    
    // Если параметр initialPartners не был передан явно, используем адрес авторизованного пользователя
    if (!dleParams.initialPartners || dleParams.initialPartners.length === 0) {
      // Проверяем, есть ли в сессии адрес кошелька пользователя
      if (!req.user || !req.user.walletAddress) {
        return res.status(400).json({ 
          success: false, 
          message: 'Не указан адрес кошелька пользователя или партнеров для распределения токенов' 
        });
      }
      
      // Используем адрес авторизованного пользователя
      dleParams.initialPartners = [req.user.address || req.user.walletAddress];
      
      // Если суммы не указаны, используем значение по умолчанию (100% токенов)
      if (!dleParams.initialAmounts || dleParams.initialAmounts.length === 0) {
        dleParams.initialAmounts = ['1000000000000000000000000']; // 1,000,000 токенов
      }
    }
    
    // Создаем DLE v2
    const result = await dleV2Service.createDLE(dleParams);
    
    logger.info('DLE v2 успешно создано:', result);
    
    res.json({
      success: true,
      message: 'DLE v2 успешно создано',
      data: result.data
    });
    
  } catch (error) {
    logger.error('Ошибка при создании DLE v2:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Произошла ошибка при создании DLE v2'
    });
  }
});

/**
 * @route   GET /api/dle-v2
 * @desc    Получить список всех DLE v2
 * @access  Public (доступно всем пользователям)
 */
router.get('/', async (req, res, next) => {
  try {
    const dles = dleV2Service.getAllDLEs();
    
    res.json({
      success: true,
      data: dles
    });
    
  } catch (error) {
    logger.error('Ошибка при получении списка DLE v2:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Произошла ошибка при получении списка DLE v2'
    });
  }
});

/**
 * @route   POST /api/dle-v2/manual-card
 * @desc    Ручное сохранение карточки DLE по адресу (если деплой уже был)
 * @access  Private (admin)
 */
router.post('/manual-card', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { dleAddress, name, symbol, location, coordinates, jurisdiction, oktmo, okvedCodes, kpp, quorumPercentage, initialPartners, initialAmounts, supportedChainIds, networks } = req.body || {};
    if (!dleAddress) {
      return res.status(400).json({ success: false, message: 'dleAddress обязателен' });
    }
    const data = {
      name: name || '',
      symbol: symbol || '',
      location: location || '',
      coordinates: coordinates || '',
      jurisdiction: jurisdiction ?? 1,
      oktmo: oktmo ?? null,
      okvedCodes: Array.isArray(okvedCodes) ? okvedCodes : [],
      kpp: kpp ?? null,
      quorumPercentage: quorumPercentage ?? 51,
      initialPartners: Array.isArray(initialPartners) ? initialPartners : [],
      initialAmounts: Array.isArray(initialAmounts) ? initialAmounts : [],
      governanceSettings: {
        quorumPercentage: quorumPercentage ?? 51,
        supportedChainIds: Array.isArray(supportedChainIds) ? supportedChainIds : [],
        currentChainId: Array.isArray(supportedChainIds) && supportedChainIds.length ? supportedChainIds[0] : 1
      },
      dleAddress,
      version: 'v2',
      networks: Array.isArray(networks) ? networks : [],
      createdAt: new Date().toISOString()
    };
    const savedPath = dleV2Service.saveDLEData(data);
    return res.json({ success: true, data: { file: savedPath } });
  } catch (e) {
    logger.error('manual-card error', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * @route   GET /api/dle-v2/default-params
 * @desc    Получить параметры по умолчанию для создания DLE v2
 * @access  Private
 */
router.get('/default-params', auth.requireAuth, async (req, res, next) => {
  try {
    const defaultParams = {
      name: '',
      symbol: '',
      location: '',
      coordinates: '',
      jurisdiction: 1,
      oktmo: 45000000000,
      okvedCodes: [],
      kpp: 770101001,
      quorumPercentage: 51,
      initialPartners: [],
      initialAmounts: [],
      supportedChainIds: [1, 137, 56, 42161],
      currentChainId: 1
    };
    
    res.json({
      success: true,
      data: defaultParams
    });
    
  } catch (error) {
    logger.error('Ошибка при получении параметров по умолчанию:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Произошла ошибка при получении параметров по умолчанию'
    });
  }
});

/**
 * @route   DELETE /api/dle-v2/:dleAddress
 * @desc    Удалить DLE v2 по адресу
 * @access  Private (только для авторизованных пользователей с ролью admin)
 */
router.delete('/:dleAddress', auth.requireAuth, auth.requireAdmin, async (req, res, next) => {
  try {
    const { dleAddress } = req.params;
    logger.info(`Получен запрос на удаление DLE v2 с адресом: ${dleAddress}`);
    
    // Проверяем существование DLE v2 в директории contracts-data/dles
    const dlesDir = path.join(__dirname, '../contracts-data/dles');
    const files = fs.readdirSync(dlesDir);
    
    let fileToDelete = null;
    
    // Находим файл, содержащий указанный адрес DLE
    for (const file of files) {
      if (file.includes('dle-v2-') && file.endsWith('.json')) {
        const filePath = path.join(dlesDir, file);
        if (fs.statSync(filePath).isFile()) {
          try {
            const dleData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (dleData.dleAddress && dleData.dleAddress.toLowerCase() === dleAddress.toLowerCase()) {
              fileToDelete = filePath;
              break;
            }
          } catch (err) {
            logger.error(`Ошибка при чтении файла ${file}:`, err);
          }
        }
      }
    }
    
    if (!fileToDelete) {
      return res.status(404).json({
        success: false,
        message: `DLE v2 с адресом ${dleAddress} не найдено`
      });
    }
    
    // Удаляем файл
    fs.unlinkSync(fileToDelete);
    
    logger.info(`DLE v2 с адресом ${dleAddress} успешно удалено`);
    
    res.json({
      success: true,
      message: `DLE v2 с адресом ${dleAddress} успешно удалено`
    });
    
  } catch (error) {
    logger.error('Ошибка при удалении DLE v2:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Произошла ошибка при удалении DLE v2'
    });
  }
});

/**
 * @route   GET /api/dle-v2/check-admin-tokens
 * @desc    Проверить баланс админских токенов для адреса
 * @access  Public
 */
router.get('/check-admin-tokens', async (req, res, next) => {
  try {
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Адрес кошелька не передан'
      });
    }

    // Проверяем баланс токенов
    const { checkAdminRole } = require('../services/admin-role');
    const isAdmin = await checkAdminRole(address);
    
    res.json({
      success: true,
      data: {
        isAdmin: isAdmin,
        address: address,
        message: isAdmin ? 'Админские токены найдены' : 'Админские токены не найдены'
      }
    });
    
  } catch (error) {
    logger.error('Ошибка при проверке админских токенов:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Произошла ошибка при проверке админских токенов'
    });
  }
});

/**
 * @route   POST /api/dle-v2/validate-private-key
 * @desc    Валидировать приватный ключ и получить адрес кошелька
 * @access  Public
 */
router.post('/validate-private-key', async (req, res, next) => {
  try {
    const { privateKey } = req.body;
    
    if (!privateKey) {
      return res.status(400).json({
        success: false,
        message: 'Приватный ключ не передан'
      });
    }
    
    // Логируем входящий ключ (только для отладки)
    logger.info('Получен приватный ключ для валидации:', privateKey);
    logger.info('Длина входящего ключа:', privateKey.length);
    logger.info('Тип входящего ключа:', typeof privateKey);
    logger.info('Полный объект запроса:', JSON.stringify(req.body));
    
    try {
      // Очищаем ключ от префикса 0x если есть
      const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      
      // Логируем очищенный ключ (только для отладки)
      logger.info('Очищенный ключ:', cleanKey);
      logger.info('Длина очищенного ключа:', cleanKey.length);
      
      // Проверяем длину и формат (64 символа в hex)
      if (cleanKey.length !== 64 || !/^[a-fA-F0-9]+$/.test(cleanKey)) {
        logger.error('Некорректный формат ключа. Длина:', cleanKey.length, 'Формат:', /^[a-fA-F0-9]+$/.test(cleanKey));
        return res.status(400).json({
          success: false,
          message: 'Некорректный формат приватного ключа'
        });
      }
      
      // Генерируем адрес из приватного ключа
      const wallet = new ethers.Wallet('0x' + cleanKey);
      const address = wallet.address;
      
      // Логируем сгенерированный адрес
      logger.info('Сгенерированный адрес из приватного ключа:', address);
      
      res.json({
        success: true,
        data: {
          isValid: true,
          address: address,
          error: null
        }
      });
      
    } catch (error) {
      logger.error('Ошибка при генерации адреса из приватного ключа:', error);
      res.status(400).json({
        success: false,
        message: 'Некорректный приватный ключ'
      });
    }
    
  } catch (error) {
    logger.error('Ошибка при валидации приватного ключа:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Произошла ошибка при валидации приватного ключа'
    });
  }
});

module.exports = router; 

/**
 * Дополнительные маршруты (подключаются из app.js)
 */

// Предсказание адресов по выбранным сетям с использованием CREATE2
router.post('/predict-addresses', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { name, symbol, selectedNetworks } = req.body || {};
    if (!selectedNetworks || !Array.isArray(selectedNetworks) || selectedNetworks.length === 0) {
      return res.status(400).json({ success: false, message: 'Не переданы сети' });
    }

    // Используем служебные секреты для фабрики и SALT
    // Ожидаем, что на сервере настроены переменные окружения или конфиги на сеть
    const result = {};
    for (const chainId of selectedNetworks) {
      const factory = process.env[`FACTORY_ADDRESS_${chainId}`] || process.env.FACTORY_ADDRESS;
      const saltHex = process.env[`CREATE2_SALT_${chainId}`] || process.env.CREATE2_SALT;
      const initCodeHash = process.env[`INIT_CODE_HASH_${chainId}`] || process.env.INIT_CODE_HASH;
      if (!factory || !saltHex || !initCodeHash) continue;
      result[chainId] = create2.computeCreate2Address(factory, saltHex, initCodeHash);
    }

    return res.json({ success: true, data: result });
  } catch (e) {
    logger.error('predict-addresses error', e);
    return res.status(500).json({ success: false, message: 'Ошибка расчета адресов' });
  }
});

// Сохранить GUID верификации (если нужно отдельным вызовом)
router.post('/verify/save-guid', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { address, chainId, guid } = req.body || {};
    if (!address || !chainId || !guid) return res.status(400).json({ success: false, message: 'address, chainId, guid обязательны' });
    const data = verificationStore.updateChain(address, chainId, { guid, status: 'submitted' });
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Получить статусы верификации по адресу DLE
router.get('/verify/status/:address', auth.requireAuth, async (req, res) => {
  try {
    const { address } = req.params;
    const data = verificationStore.read(address);
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Обновить статусы верификации, опросив Etherscan V2
router.post('/verify/refresh/:address', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { address } = req.params;
    let { etherscanApiKey } = req.body || {};
    if (!etherscanApiKey) {
      try {
        const { getSecret } = require('../services/secretStore');
        etherscanApiKey = await getSecret('ETHERSCAN_V2_API_KEY');
      } catch(_) {}
    }
    const data = verificationStore.read(address);
    if (!data || !data.chains) return res.json({ success: true, data });

    // Если guid отсутствует или ранее была ошибка chainid — попробуем автоматически переотправить верификацию (resubmit)
    const needResubmit = Object.values(data.chains).some(c => !c.guid || /Missing or unsupported chainid/i.test(c.status || ''));
    if (needResubmit && etherscanApiKey) {
      // Найти карточку DLE
      const list = dleV2Service.getAllDLEs();
      const card = list.find(x => x?.dleAddress && x.dleAddress.toLowerCase() === address.toLowerCase());
      if (card) {
        const deployParams = {
          name: card.name,
          symbol: card.symbol,
          location: card.location,
          coordinates: card.coordinates,
          jurisdiction: card.jurisdiction,
          oktmo: card.oktmo,
          okvedCodes: Array.isArray(card.okvedCodes) ? card.okvedCodes : [],
          kpp: card.kpp,
          quorumPercentage: card.quorumPercentage,
          initialPartners: Array.isArray(card.initialPartners) ? card.initialPartners : [],
          initialAmounts: Array.isArray(card.initialAmounts) ? card.initialAmounts : [],
          supportedChainIds: Array.isArray(card.networks) ? card.networks.map(n => n.chainId).filter(Boolean) : (card.governanceSettings?.supportedChainIds || []),
          currentChainId: card.governanceSettings?.currentChainId || (Array.isArray(card.networks) && card.networks[0]?.chainId) || 1
        };
        const deployResult = { success: true, data: { dleAddress: card.dleAddress, networks: card.networks || [] } };
        try {
          await dleV2Service.autoVerifyAcrossChains({ deployParams, deployResult, apiKey: etherscanApiKey });
        } catch (_) {}
      }
    }

    // Далее — обычный опрос по имеющимся guid
    const latest = verificationStore.read(address);
    const chains = Object.values(latest.chains);
    for (const c of chains) {
      if (!c.guid || !c.chainId) continue;
      try {
        const st = await etherscanV2.checkStatus(c.chainId, c.guid, etherscanApiKey);
        verificationStore.updateChain(address, c.chainId, { status: st?.result || st?.message || 'unknown' });
      } catch (e) {
        verificationStore.updateChain(address, c.chainId, { status: `error: ${e.message}` });
      }
    }
    const updated = verificationStore.read(address);
    return res.json({ success: true, data: updated });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Повторно отправить верификацию на Etherscan V2 для уже созданного DLE
router.post('/verify/resubmit/:address', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { address } = req.params;
    const { etherscanApiKey } = req.body || {};
    if (!etherscanApiKey && !process.env.ETHERSCAN_API_KEY) {
      return res.status(400).json({ success: false, message: 'etherscanApiKey обязателен' });
    }
    // Найти карточку DLE по адресу
    const list = dleV2Service.getAllDLEs();
    const card = list.find(x => x?.dleAddress && x.dleAddress.toLowerCase() === address.toLowerCase());
    if (!card) return res.status(404).json({ success: false, message: 'Карточка DLE не найдена' });

    // Сформировать deployParams из карточки
    const deployParams = {
      name: card.name,
      symbol: card.symbol,
      location: card.location,
      coordinates: card.coordinates,
      jurisdiction: card.jurisdiction,
      oktmo: card.oktmo,
      okvedCodes: Array.isArray(card.okvedCodes) ? card.okvedCodes : [],
      kpp: card.kpp,
      quorumPercentage: card.quorumPercentage,
      initialPartners: Array.isArray(card.initialPartners) ? card.initialPartners : [],
      initialAmounts: Array.isArray(card.initialAmounts) ? card.initialAmounts : [],
      supportedChainIds: Array.isArray(card.networks) ? card.networks.map(n => n.chainId).filter(Boolean) : (card.governanceSettings?.supportedChainIds || []),
      currentChainId: card.governanceSettings?.currentChainId || (Array.isArray(card.networks) && card.networks[0]?.chainId) || 1
    };

    // Сформировать deployResult из карточки
    const deployResult = { success: true, data: { dleAddress: card.dleAddress, networks: card.networks || [] } };

    await dleV2Service.autoVerifyAcrossChains({ deployParams, deployResult, apiKey: etherscanApiKey });
    const updated = verificationStore.read(address);
    return res.json({ success: true, data: updated });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Предварительная проверка балансов во всех выбранных сетях
router.post('/precheck', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { supportedChainIds, privateKey } = req.body || {};
    if (!privateKey) return res.status(400).json({ success: false, message: 'Приватный ключ не передан' });
    if (!Array.isArray(supportedChainIds) || supportedChainIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Не переданы сети для проверки' });
    }
    const result = await dleV2Service.checkBalances(supportedChainIds, privateKey);
    return res.json({ success: true, data: result });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});