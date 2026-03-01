/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const express = require('express');
const router = express.Router();
const UnifiedDeploymentService = require('../services/unifiedDeploymentService');
const unifiedDeploymentService = new UnifiedDeploymentService();
const logger = require('../utils/logger');
const auth = require('../middleware/auth');
const authService = require('../services/auth-service');
// НОВАЯ СИСТЕМА РОЛЕЙ: используем shared/permissions.js
const { hasPermission, ROLES, PERMISSIONS } = require('/app/shared/permissions');
const path = require('path');
const fs = require('fs');
const ethers = require('ethers'); // Added ethers for private key validation
const deploymentTracker = require('../utils/deploymentTracker');
const create2 = require('../utils/create2');
// verificationStore удален - используем contractVerificationService
// ContractVerificationService удален - используем Hardhat verify

/**
 * Асинхронная функция для выполнения деплоя в фоне
 */
async function executeDeploymentInBackground(deploymentId, dleParams) {
  try {
    // Отправляем уведомление о начале
    deploymentTracker.updateDeployment(deploymentId, {
      status: 'in_progress',
      stage: 'initializing'
    });
    
    deploymentTracker.addLog(deploymentId, '🚀 Начинаем деплой DLE контракта', 'info');
    
    // Выполняем деплой с передачей deploymentId для WebSocket обновлений
    const result = await unifiedDeploymentService.createDLE(dleParams, deploymentId);
    
    // Завершаем успешно
    deploymentTracker.completeDeployment(deploymentId, result.data);
    
  } catch (error) {
    // Завершаем с ошибкой
    deploymentTracker.failDeployment(deploymentId, error);
  }
}

/**
 * @route   POST /api/dle-v2
 * @desc    Создать новое DLE v2 (Digital Legal Entity)
 * @access  Private (только для авторизованных пользователей с ролью admin)
 */
router.post('/', auth.requireAuth, auth.requireAdmin, async (req, res, next) => {
  try {
    const dleParams = req.body;
    logger.info('🔥 Получен запрос на асинхронный деплой DLE v2');
    
    // Если параметр initialPartners не был передан явно, используем адрес авторизованного пользователя
    if (!dleParams.initialPartners || dleParams.initialPartners.length === 0) {
      // НОВАЯ СИСТЕМА РОЛЕЙ: проверяем права через новую систему
      let userRole = ROLES.GUEST;
      if (req.user?.userAccessLevel) {
        if (req.user.userAccessLevel.level === 'readonly') {
          userRole = ROLES.READONLY;
        } else if (req.user.userAccessLevel.level === 'editor') {
          userRole = ROLES.EDITOR;
        }
      } else if (req.user?.id) {
        userRole = ROLES.USER;
      }
      
      // Проверяем права на управление настройками
      if (!hasPermission(userRole, PERMISSIONS.MANAGE_SETTINGS)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Insufficient permissions for DLE deployment' 
        });
      }
      
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
    
    // Используем deploymentId из запроса, если передан, иначе создаем новый
    const deploymentId = req.body.deploymentId || deploymentTracker.createDeployment(dleParams);
    
    // Если deploymentId был передан из запроса, создаем запись о деплое с этим ID
    if (req.body.deploymentId) {
      deploymentTracker.createDeployment(dleParams, req.body.deploymentId);
    }
    
    // Запускаем деплой в фоне (с await для правильной обработки ошибок!)
    await executeDeploymentInBackground(deploymentId, dleParams);
    
    logger.info(`📤 Деплой запущен асинхронно: ${deploymentId}`);
    
    // Сразу возвращаем ответ с ID деплоя
    res.json({
      success: true,
      message: 'Деплой запущен в фоновом режиме',
      deploymentId: deploymentId
    });
    
  } catch (error) {
    logger.error('❌ Ошибка при запуске асинхронного деплоя:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Произошла ошибка при запуске деплоя'
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
    const dles = await unifiedDeploymentService.getAllDeployments();
    
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
 * @route   DELETE /api/dle-v2/deployment/:deploymentId
 * @desc    Удалить DLE v2 по deployment ID
 * @access  Private (только для авторизованных пользователей с ролью admin)
 */
router.delete('/deployment/:deploymentId', auth.requireAuth, auth.requireAdmin, async (req, res, next) => {
  try {
    const { deploymentId } = req.params;
    logger.info(`Получен запрос на удаление DLE v2 с deployment ID: ${deploymentId}`);

    // Удаляем запись из базы данных
    const deleted = await unifiedDeploymentService.deleteDeployParams(deploymentId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `DLE v2 с deployment ID ${deploymentId} не найдено`
      });
    }

    logger.info(`DLE v2 с deployment ID ${deploymentId} успешно удалено`);

    res.json({
      success: true,
      message: `DLE v2 с deployment ID ${deploymentId} успешно удалено`
    });

  } catch (error) {
    logger.error('Ошибка при удалении DLE v2 по deployment ID:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Произошла ошибка при удалении DLE v2'
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
    const userAccessLevel = await authService.getUserAccessLevel(address);
    res.json({
      success: true,
      data: {
        userAccessLevel: userAccessLevel,
        address: address,
        message: userAccessLevel.hasAccess ? 'Админские токены найдены' : 'Админские токены не найдены'
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

/**
 * @route   GET /api/dle-v2/deployment-status/:deploymentId
 * @desc    Получить статус деплоя
 * @access  Private
 */
router.get('/deployment-status/:deploymentId', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { deploymentId } = req.params;
    
    const deployment = deploymentTracker.getDeployment(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'Деплой не найден'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: deployment.id,
        status: deployment.status,
        stage: deployment.stage,
        progress: deployment.progress,
        networks: deployment.networks,
        startedAt: deployment.startedAt,
        updatedAt: deployment.updatedAt,
        logs: deployment.logs.slice(-50), // Последние 50 логов
        error: deployment.error
      }
    });
    
  } catch (error) {
    logger.error('Ошибка при получении статуса деплоя:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Произошла ошибка при получении статуса'
    });
  }
});

/**
 * @route   GET /api/dle-v2/deployment-result/:deploymentId
 * @desc    Получить результат завершенного деплоя
 * @access  Private
 */
router.get('/deployment-result/:deploymentId', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { deploymentId } = req.params;
    
    const deployment = deploymentTracker.getDeployment(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'Деплой не найден'
      });
    }
    
    if (deployment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Деплой не завершен. Текущий статус: ${deployment.status}`,
        status: deployment.status
      });
    }
    
    res.json({
      success: true,
      data: {
        result: deployment.result,
        completedAt: deployment.completedAt,
        duration: deployment.completedAt ? deployment.completedAt - deployment.startedAt : null
      }
    });
    
  } catch (error) {
    logger.error('Ошибка при получении результата деплоя:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Произошла ошибка при получении результата'
    });
  }
});

/**
 * @route   GET /api/dle-v2/deployment-stats
 * @desc    Получить статистику деплоев
 * @access  Private
 */
router.get('/deployment-stats', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const stats = deploymentTracker.getStats();
    const activeDeployments = deploymentTracker.getActiveDeployments();
    
    res.json({
      success: true,
      data: {
        stats,
        activeDeployments: activeDeployments.map(d => ({
          id: d.id,
          stage: d.stage,
          progress: d.progress,
          startedAt: d.startedAt
        }))
      }
    });
    
  } catch (error) {
    logger.error('Ошибка при получении статистики деплоев:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Произошла ошибка при получении статистики'
    });
  }
});

module.exports = router; 

/**
 * Дополнительные маршруты (подключаются из app.js)
 */


// Сохранить GUID верификации (если нужно отдельным вызовом)
router.post('/verify/save-guid', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { address, chainId, guid } = req.body || {};
    if (!address || !chainId || !guid) return res.status(400).json({ success: false, message: 'address, chainId, guid обязательны' });
    // verificationStore удален - используем contractVerificationService
    const data = { guid, status: 'submitted' };
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Получить статусы верификации по адресу DLE
router.get('/verify/status/:address', auth.requireAuth, async (req, res) => {
  try {
    const { address } = req.params;
    // verificationStore удален - возвращаем пустые данные
    const data = {};
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Обновить статусы верификации, опросив Etherscan V2
router.post('/verify/refresh/:address', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { address } = req.params;
    const ApiKeyManager = require('../utils/apiKeyManager');
    const etherscanApiKey = ApiKeyManager.getEtherscanApiKey({}, req.body);
    // verificationStore удален - возвращаем пустые данные
    const data = {};
    if (!data || !data.chains) return res.json({ success: true, data });

    // Если guid отсутствует или ранее была ошибка chainid — попробуем автоматически переотправить верификацию (resubmit)
    const needResubmit = Object.values(data.chains).some(c => !c.guid || /Missing or unsupported chainid/i.test(c.status || ''));
    if (needResubmit && etherscanApiKey) {
      // Найти карточку DLE
        const list = unifiedDeploymentService.getAllDLEs();
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
          currentChainId: card.governanceSettings?.currentChainId || 1 // governance chain, не первая сеть
        };
        const deployResult = { success: true, data: { dleAddress: card.dleAddress, networks: card.networks || [] } };
        try {
          await unifiedDeploymentService.autoVerifyAcrossChains({ deployParams, deployResult, apiKey: etherscanApiKey });
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
        // verificationStore удален - используем contractVerificationService
      } catch (e) {
        // verificationStore удален - используем contractVerificationService
      }
    }
    // verificationStore удален - возвращаем пустые данные
    const updated = {};
    return res.json({ success: true, data: updated });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Повторно отправить верификацию на Etherscan V2 для уже созданного DLE
router.post('/verify/resubmit/:address', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { address } = req.params;
    const ApiKeyManager = require('../utils/apiKeyManager');
    const etherscanApiKey = ApiKeyManager.getEtherscanApiKey({}, req.body);
    
    if (!etherscanApiKey) {
      return res.status(400).json({ success: false, message: 'etherscanApiKey обязателен' });
    }
    // Найти карточку DLE по адресу
        const list = unifiedDeploymentService.getAllDLEs();
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
      currentChainId: card.governanceSettings?.currentChainId || 1 // governance chain, не первая сеть
    };

    // Сформировать deployResult из карточки
    const deployResult = { success: true, data: { dleAddress: card.dleAddress, networks: card.networks || [] } };

    await unifiedDeploymentService.autoVerifyAcrossChains({ deployParams, deployResult, apiKey: etherscanApiKey });
    // verificationStore удален - возвращаем пустые данные
    const updated = {};
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
    const result = await unifiedDeploymentService.checkBalances(supportedChainIds, privateKey);
    return res.json({ success: true, data: result });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

