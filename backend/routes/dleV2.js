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

/**
 * @route   POST /api/dle-v2
 * @desc    Создать новое DLE v2 (Digital Legal Entity)
 * @access  Private (только для авторизованных пользователей с ролью admin)
 */
router.post('/', auth.requireAuth, auth.requireAdmin, async (req, res, next) => {
  try {
    const dleParams = req.body;
    logger.info('Получен запрос на создание DLE v2:', dleParams);
    
    // Если параметр partners не был передан явно, используем адрес авторизованного пользователя
    if (!dleParams.partners || dleParams.partners.length === 0) {
      // Проверяем, есть ли в сессии адрес кошелька пользователя
      if (!req.user || !req.user.walletAddress) {
        return res.status(400).json({ 
          success: false, 
          message: 'Не указан адрес кошелька пользователя или партнеров для распределения токенов' 
        });
      }
      
      // Используем адрес авторизованного пользователя
      dleParams.partners = [req.user.address || req.user.walletAddress];
      
      // Если суммы не указаны, используем значение по умолчанию (100% токенов)
      if (!dleParams.amounts || dleParams.amounts.length === 0) {
        dleParams.amounts = ['1000000'];
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
 * @access  Private (только для авторизованных пользователей)
 */
router.get('/', auth.requireAuth, async (req, res, next) => {
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
 * @route   GET /api/dle-v2/defaults
 * @desc    Получить настройки по умолчанию для DLE v2
 * @access  Private (только для авторизованных пользователей)
 */
router.get('/defaults', auth.requireAuth, async (req, res, next) => {
  // Возвращаем настройки по умолчанию, которые будут использоваться 
  // при заполнении формы на фронтенде
  res.json({
    success: true,
    data: {
      votingDelay: 1, // 1 блок задержки перед началом голосования
      votingPeriod: 45818, // ~1 неделя в блоках (при 13 секундах на блок)
      proposalThreshold: '100000', // 100,000 токенов
      quorumPercentage: 4, // 4% от общего количества токенов
      minTimelockDelay: 2 // 2 дня
    }
  });
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

module.exports = router; 