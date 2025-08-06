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