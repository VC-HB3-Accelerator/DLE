const express = require('express');
const router = express.Router();
const dleService = require('../services/dleService');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

/**
 * @route   POST /api/dle
 * @desc    Создать новое DLE (Digital Legal Entity)
 * @access  Private (только для авторизованных пользователей с ролью admin)
 */
router.post('/', auth.requireAuth, auth.requireAdmin, async (req, res, next) => {
  try {
    const dleParams = req.body;
    logger.info('Получен запрос на создание DLE:', dleParams);
    
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
    
    const result = await dleService.createDLE(dleParams);
    
    res.status(201).json({
      success: true,
      message: 'DLE успешно создано',
      data: result
    });
  } catch (error) {
    logger.error('Ошибка при создании DLE:', error);
    next(error);
  }
});

/**
 * @route   GET /api/dle
 * @desc    Получить список всех DLE
 * @access  Public (доступно всем пользователям, включая гостевых)
 */
router.get('/', async (req, res, next) => {
  try {
    const dles = await dleService.getAllDLEs();
    res.json({
      success: true,
      data: dles
    });
  } catch (error) {
    logger.error('Ошибка при получении списка DLE:', error);
    next(error);
  }
});

/**
 * @route   GET /api/dle/settings
 * @desc    Получить настройки для деплоя DLE по умолчанию
 * @access  Private (только для авторизованных пользователей)
 */
router.get('/settings', auth.requireAuth, (req, res) => {
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
 * @route   DELETE /api/dle/:tokenAddress
 * @desc    Удалить DLE по адресу токена
 * @access  Private (только для авторизованных пользователей с ролью admin)
 */
router.delete('/:tokenAddress', auth.requireAuth, auth.requireAdmin, async (req, res, next) => {
  try {
    const { tokenAddress } = req.params;
    logger.info(`Получен запрос на удаление DLE с адресом токена: ${tokenAddress}`);
    
    // Проверяем существование DLE в директории contracts-data/dles
    const dlesDir = path.join(__dirname, '../contracts-data/dles');
    const files = fs.readdirSync(dlesDir);
    
    let fileToDelete = null;
    
    // Находим файл, содержащий указанный адрес токена
    for (const file of files) {
      const filePath = path.join(dlesDir, file);
      if (fs.statSync(filePath).isFile() && file.endsWith('.json')) {
        try {
          const dleData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (dleData.tokenAddress && dleData.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()) {
            fileToDelete = filePath;
            break;
          }
        } catch (err) {
          logger.error(`Ошибка при чтении файла ${file}:`, err);
        }
      }
    }
    
    if (!fileToDelete) {
      return res.status(404).json({
        success: false,
        message: `DLE с адресом токена ${tokenAddress} не найдено`
      });
    }
    
    // Удаляем файл
    fs.unlinkSync(fileToDelete);
    
    res.json({
      success: true,
      message: `DLE с адресом токена ${tokenAddress} успешно удалено`
    });
  } catch (error) {
    logger.error('Ошибка при удалении DLE:', error);
    next(error);
  }
});

/**
 * @route   DELETE /api/dle/empty/:fileName
 * @desc    Удалить пустое DLE по имени файла
 * @access  Private (только для авторизованных пользователей с ролью admin)
 */
router.delete('/empty/:fileName', auth.requireAuth, auth.requireAdmin, async (req, res, next) => {
  try {
    const { fileName } = req.params;
    logger.info(`Получен запрос на удаление пустого DLE с именем файла: ${fileName}`);
    
    // Проверяем существование файла в директории contracts-data/dles
    const dlesDir = path.join(__dirname, '../contracts-data/dles');
    const filePath = path.join(dlesDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: `Файл ${fileName} не найден`
      });
    }
    
    // Удаляем файл
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      message: `Пустое DLE с именем файла ${fileName} успешно удалено`
    });
  } catch (error) {
    logger.error('Ошибка при удалении пустого DLE:', error);
    next(error);
  }
});

module.exports = router; 