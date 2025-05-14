const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Логируем версию ethers для отладки
logger.info(`Ethers version: ${ethers.version || 'unknown'}`);

// Путь к файлу с настройками
const RPC_CONFIG_PATH = path.join(__dirname, '../config/rpc-settings.json');
const AUTH_TOKENS_PATH = path.join(__dirname, '../config/auth-tokens.json');

// Вспомогательная функция для чтения настроек из файла
const readSettingsFile = (filePath, defaultValue = []) => {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    return defaultValue;
  } catch (error) {
    logger.error(`Ошибка при чтении файла настроек ${filePath}:`, error);
    return defaultValue;
  }
};

// Вспомогательная функция для записи настроек в файл
const writeSettingsFile = async (filePath, data) => {
  try {
    // Создаем директорию, если не существует
    const dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
    
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    logger.error(`Ошибка при записи файла настроек ${filePath}:`, error);
    return false;
  }
};

// Получение RPC настроек
router.get('/rpc', requireAdmin, async (req, res) => {
  try {
    const rpcConfigs = readSettingsFile(RPC_CONFIG_PATH);
    res.json({ success: true, data: rpcConfigs });
  } catch (error) {
    logger.error('Ошибка при получении RPC настроек:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера при получении настроек RPC' });
  }
});

// Сохранение RPC настроек
router.post('/rpc', requireAdmin, async (req, res) => {
  try {
    const { rpcConfigs } = req.body;
    
    if (!Array.isArray(rpcConfigs)) {
      return res.status(400).json({ success: false, error: 'Неверный формат данных' });
    }
    
    const success = await writeSettingsFile(RPC_CONFIG_PATH, rpcConfigs);
    
    if (success) {
      res.json({ success: true, message: 'RPC настройки успешно сохранены' });
    } else {
      res.status(500).json({ success: false, error: 'Ошибка при сохранении RPC настроек' });
    }
  } catch (error) {
    logger.error('Ошибка при сохранении RPC настроек:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера при сохранении настроек RPC' });
  }
});

// Получение токенов для аутентификации
router.get('/auth-tokens', requireAdmin, async (req, res) => {
  try {
    const authTokens = readSettingsFile(AUTH_TOKENS_PATH);
    res.json({ success: true, data: authTokens });
  } catch (error) {
    logger.error('Ошибка при получении токенов аутентификации:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера при получении токенов аутентификации' });
  }
});

// Сохранение токенов для аутентификации
router.post('/auth-tokens', requireAdmin, async (req, res) => {
  try {
    const { authTokens } = req.body;
    
    if (!Array.isArray(authTokens)) {
      return res.status(400).json({ success: false, error: 'Неверный формат данных' });
    }
    
    const success = await writeSettingsFile(AUTH_TOKENS_PATH, authTokens);
    
    if (success) {
      res.json({ success: true, message: 'Токены аутентификации успешно сохранены' });
    } else {
      res.status(500).json({ success: false, error: 'Ошибка при сохранении токенов аутентификации' });
    }
  } catch (error) {
    logger.error('Ошибка при сохранении токенов аутентификации:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера при сохранении токенов аутентификации' });
  }
});

// Тестирование RPC соединения
router.post('/rpc-test', requireAdmin, async (req, res) => {
  try {
    const { rpcUrl, networkId } = req.body;
    
    if (!rpcUrl || !networkId) {
      return res.status(400).json({ success: false, error: 'Необходимо указать URL и ID сети' });
    }
    
    logger.info(`Тестирование RPC для ${networkId}: ${rpcUrl}`);
    
    try {
      // Пробуем создать провайдера и получить номер последнего блока (обновлено для ethers v6)
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Устанавливаем таймаут для соединения
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Таймаут соединения')), 10000)
      );
      
      // Пробуем получить номер последнего блока с таймаутом
      const blockNumber = await Promise.race([
        provider.getBlockNumber(),
        timeoutPromise
      ]);
  
      logger.info(`Успешное тестирование RPC для ${networkId}: ${rpcUrl}, номер блока: ${blockNumber}`);
      
      res.json({ 
        success: true, 
        message: `Успешное соединение с ${networkId}`, 
        blockNumber 
      });
    } catch (providerError) {
      logger.error(`Ошибка провайдера при тестировании RPC для ${networkId}: ${providerError.message}`);
      res.status(500).json({ 
        success: false, 
        error: providerError.message || 'Не удалось подключиться к RPC провайдеру'
      });
    }
  } catch (error) {
    logger.error(`Неожиданная ошибка при тестировании RPC: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Неизвестная ошибка сервера'
    });
  }
});

module.exports = router; 