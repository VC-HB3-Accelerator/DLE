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
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const { ethers } = require('ethers');
const db = require('../db');
const rpcProviderService = require('../services/rpcProviderService');
const encryptedDb = require('../services/encryptedDatabaseService');

// Функция для получения информации о сети по chain_id
function getNetworkInfo(chainId) {
  const networkInfo = {
    1: { name: 'Ethereum Mainnet', description: 'Максимальная безопасность и децентрализация' },
    137: { name: 'Polygon', description: 'Низкие комиссии, быстрые транзакции' },
    42161: { name: 'Arbitrum One', description: 'Оптимистичные rollups, средние комиссии' },
    10: { name: 'Optimism', description: 'Оптимистичные rollups, низкие комиссии' },
    56: { name: 'BSC', description: 'Совместимость с экосистемой Binance' },
    43114: { name: 'Avalanche', description: 'Высокая пропускная способность' },
    11155111: { name: 'Sepolia Testnet', description: 'Тестовая сеть Ethereum' },
    80001: { name: 'Mumbai Testnet', description: 'Тестовая сеть Polygon' },
    421613: { name: 'Arbitrum Goerli', description: 'Тестовая сеть Arbitrum' },
    420: { name: 'Optimism Goerli', description: 'Тестовая сеть Optimism' },
    97: { name: 'BSC Testnet', description: 'Тестовая сеть BSC' },
    17000: { name: 'Holesky Testnet', description: 'Тестовая сеть Holesky' },
    421614: { name: 'Arbitrum Sepolia', description: 'Тестовая сеть Arbitrum Sepolia' },
    84532: { name: 'Base Sepolia', description: 'Тестовая сеть Base Sepolia' },
    80002: { name: 'Polygon Amoy', description: 'Тестовая сеть Polygon Amoy' }
  };
  
  return networkInfo[chainId] || { 
    name: `Chain ${chainId}`, 
    description: 'Блокчейн сеть' 
  };
}
const authTokenService = require('../services/authTokenService');
const aiProviderSettingsService = require('../services/aiProviderSettingsService');
const aiAssistant = require('../services/ai-assistant');
const dns = require('node:dns').promises;
const aiAssistantSettingsService = require('../services/aiAssistantSettingsService');
const aiAssistantRulesService = require('../services/aiAssistantRulesService');
const botsSettings = require('../services/botsSettings');
const dbSettingsService = require('../services/dbSettingsService');
const { broadcastAuthTokenAdded, broadcastAuthTokenDeleted, broadcastAuthTokenUpdated } = require('../wsHub');

// Логируем версию ethers для отладки
logger.info(`Ethers version: ${ethers.version || 'unknown'}`);

// Получение RPC настроек
router.get('/rpc', async (req, res, next) => {
  try {
    let isAdmin = false;
    
    // Проверяем, авторизован ли пользователь и является ли он админом
    if (req.session && req.session.authenticated) {
      if (req.session.address) {
        const authService = require('../services/auth-service');
        isAdmin = await authService.checkAdminTokens(req.session.address);
      } else {
        isAdmin = req.session.isAdmin || false;
      }
    }
    
    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    // Получаем ключ шифрования через унифицированную утилиту
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();

    const rpcProvidersResult = await db.getQuery()(
      'SELECT id, chain_id, created_at, updated_at, decrypt_text(network_id_encrypted, $1) as network_id, decrypt_text(rpc_url_encrypted, $1) as rpc_url FROM rpc_providers',
      [encryptionKey]
    );
    const rpcConfigs = rpcProvidersResult.rows.map(config => {
      // Добавляем name и description на основе chain_id
      const networkInfo = getNetworkInfo(config.chain_id);
      return {
        ...config,
        name: networkInfo.name,
        description: networkInfo.description
      };
    });
    
    if (isAdmin) {
      // Для админов возвращаем полные данные
      res.json({ success: true, data: rpcConfigs });
    } else {
      // Для обычных пользователей и гостей возвращаем ограниченные данные для ОТОБРАЖЕНИЯ,
      // но с полными данными для функциональности (тестирование RPC)
      const limitedConfigs = rpcConfigs.map(config => ({
        network_id: config.network_id,
        rpc_url: config.rpc_url, // Передаем реальный URL для функциональности
        rpc_url_display: 'Скрыто', // Для отображения в UI
        chain_id: config.chain_id,
        _isLimited: true
      }));
      res.json({ success: true, data: limitedConfigs });
    }
  } catch (error) {
    logger.error('Ошибка при получении RPC настроек:', error);
    next(error);
  }
});

// Добавление/обновление одного или нескольких RPC
router.post('/rpc', requireAdmin, async (req, res, next) => {
  try {
    // Если пришёл массив rpcConfigs — bulk-режим
    if (Array.isArray(req.body.rpcConfigs)) {
      const rpcConfigs = req.body.rpcConfigs;
      if (!rpcConfigs.length) {
        return res.status(400).json({ success: false, error: 'rpcConfigs не может быть пустым массивом' });
      }
      await rpcProviderService.saveAllRpcProviders(rpcConfigs);
      return res.json({ success: true, message: 'RPC провайдеры успешно сохранены (bulk)' });
    }
    // Иначе — одиночный режим (старый)
    const { networkId, rpcUrl, chainId } = req.body;
    if (!networkId || !rpcUrl) {
      return res.status(400).json({ success: false, error: 'networkId и rpcUrl обязательны' });
    }
    await rpcProviderService.upsertRpcProvider({ networkId, rpcUrl, chainId });
    res.json({ success: true, message: 'RPC провайдер сохранён' });
  } catch (error) {
    logger.error('Ошибка при сохранении RPC:', error);
    next(error);
  }
});

// Удаление одного RPC
router.delete('/rpc/:networkId', requireAdmin, async (req, res, next) => {
  try {
    const { networkId } = req.params;
    await rpcProviderService.deleteRpcProvider(networkId);
    res.json({ success: true, message: 'RPC провайдер удалён' });
  } catch (error) {
    logger.error('Ошибка при удалении RPC:', error);
    next(error);
  }
});

// Получение токенов для аутентификации
router.get('/auth-tokens', async (req, res, next) => {
  try {
    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    // Получаем ключ шифрования через унифицированную утилиту
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();

    const tokensResult = await db.getQuery()(
      'SELECT id, min_balance, readonly_threshold, editor_threshold, created_at, updated_at, decrypt_text(name_encrypted, $1) as name, decrypt_text(address_encrypted, $1) as address, decrypt_text(network_encrypted, $1) as network FROM auth_tokens',
      [encryptionKey]
    );
    const authTokens = tokensResult.rows;
    
    // Возвращаем полные данные для всех пользователей (включая гостевых)
    res.json({ success: true, data: authTokens });
  } catch (error) {
    logger.error('Ошибка при получении токенов аутентификации:', error);
    next(error);
  }
});

// Сохранение токенов для аутентификации
router.post('/auth-tokens', requireAdmin, async (req, res, next) => {
  try {
    const { authTokens } = req.body;
    if (!Array.isArray(authTokens)) {
      return res.status(400).json({ success: false, error: 'Неверный формат данных' });
    }
    await authTokenService.saveAllAuthTokens(authTokens);
    
    // После сохранения токенов перепроверяем баланс ВСЕХ авторизованных пользователей
    const authService = require('../services/auth-service');
    try {
      await authService.recheckAllUsersAdminStatus();
      logger.info('Балансы всех пользователей перепроверены после сохранения токенов');
    } catch (balanceError) {
      logger.error(`Ошибка при перепроверке балансов всех пользователей: ${balanceError.message}`);
    }
    
    res.json({ success: true, message: 'Токены аутентификации успешно сохранены' });
  } catch (error) {
    logger.error('Ошибка при сохранении токенов аутентификации:', error);
    next(error);
  }
});

// Добавление/обновление одного токена
router.post('/auth-token', requireAdmin, async (req, res, next) => {
  try {
    const { name, address, network, minBalance, readonlyThreshold, editorThreshold } = req.body;
    if (!name || !address || !network) {
      return res.status(400).json({ success: false, error: 'name, address и network обязательны' });
    }
    await authTokenService.upsertAuthToken({ name, address, network, minBalance, readonlyThreshold, editorThreshold });
    
    // Отправляем WebSocket уведомление о добавлении токена
    try {
      broadcastAuthTokenAdded({ name, address, network, minBalance });
      logger.info('WebSocket уведомление о добавлении токена отправлено');
    } catch (wsError) {
      logger.error(`Ошибка при отправке WebSocket уведомления: ${wsError.message}`);
    }
    
    // После добавления токена перепроверяем баланс ВСЕХ авторизованных пользователей
    const authService = require('../services/auth-service');
    try {
      await authService.recheckAllUsersAdminStatus();
      logger.info('Балансы всех пользователей перепроверены после добавления токена');
    } catch (balanceError) {
      logger.error(`Ошибка при перепроверке балансов всех пользователей: ${balanceError.message}`);
    }
    
    res.json({ success: true, message: 'Токен аутентификации сохранён' });
  } catch (error) {
    logger.error('Ошибка при сохранении токена аутентификации:', error);
    next(error);
  }
});

// Удаление одного токена
router.delete('/auth-token/:address/:network', requireAdmin, async (req, res, next) => {
  try {
    const { address, network } = req.params;
    await authTokenService.deleteAuthToken(address, network);
    
    // Отправляем WebSocket уведомление об удалении токена
    try {
      broadcastAuthTokenDeleted({ address, network });
      logger.info('WebSocket уведомление об удалении токена отправлено');
    } catch (wsError) {
      logger.error(`Ошибка при отправке WebSocket уведомления: ${wsError.message}`);
    }
    
    // После удаления токена перепроверяем баланс ВСЕХ авторизованных пользователей
    const authService = require('../services/auth-service');
    try {
      await authService.recheckAllUsersAdminStatus();
      logger.info('Балансы всех пользователей перепроверены после удаления токена');
    } catch (balanceError) {
      logger.error(`Ошибка при перепроверке балансов всех пользователей: ${balanceError.message}`);
    }
    
    res.json({ success: true, message: 'Токен аутентификации удалён' });
  } catch (error) {
    logger.error('Ошибка при удалении токена аутентификации:', error);
    next(error);
  }
});

// Тестирование RPC соединения
router.post('/rpc-test', async (req, res, next) => {
  try {
    const { rpcUrl, networkId } = req.body;
    
    if (!rpcUrl || !networkId) {
      return res.status(400).json({ success: false, error: 'Необходимо указать URL и ID сети' });
    }
    
    logger.info(`Тестирование RPC для ${networkId}: ${rpcUrl}`);
    
    try {
      // Пробуем создать провайдера и получить номер последнего блока (обновлено для ethers v6)
      let provider;
      if (rpcUrl.startsWith('ws://') || rpcUrl.startsWith('wss://')) {
        provider = new ethers.WebSocketProvider(rpcUrl);
      } else {
        provider = new ethers.JsonRpcProvider(rpcUrl);
      }
      
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

// Получить настройки AI-провайдера
router.get('/ai-settings/:provider', async (req, res, next) => {
  try {
    let isAdmin = false;
    
    // Проверяем, авторизован ли пользователь и является ли он админом
    if (req.session && req.session.authenticated) {
      if (req.session.address) {
        const authService = require('../services/auth-service');
        isAdmin = await authService.checkAdminTokens(req.session.address);
      } else {
        isAdmin = req.session.isAdmin || false;
      }
    }
    
    if (isAdmin) {
      const { provider } = req.params;
      const settings = await aiProviderSettingsService.getProviderSettings(provider);
      res.json({ success: true, settings });
    } else {
      // Для обычных пользователей и гостей возвращаем пустые настройки
      res.json({ success: true, settings: null });
    }
  } catch (error) {
    logger.error('Ошибка при получении AI-настроек:', error);
    next(error);
  }
});

// Сохранить/обновить настройки AI-провайдера
router.put('/ai-settings/:provider', requireAdmin, async (req, res, next) => {
  try {
    const { provider } = req.params;
    const { api_key, base_url, selected_model, embedding_model } = req.body;
    const updated = await aiProviderSettingsService.upsertProviderSettings({ provider, api_key, base_url, selected_model, embedding_model });
    res.json({ success: true, settings: updated });
  } catch (error) {
    logger.error('Ошибка при сохранении AI-настроек:', error);
    next(error);
  }
});

// Удалить настройки AI-провайдера
router.delete('/ai-settings/:provider', requireAdmin, async (req, res, next) => {
  try {
    const { provider } = req.params;
    await aiProviderSettingsService.deleteProviderSettings(provider);
    res.json({ success: true });
  } catch (error) {
    logger.error('Ошибка при удалении AI-настроек:', error);
    next(error);
  }
});

// Получить список моделей для провайдера
router.get('/ai-settings/:provider/models', requireAdmin, async (req, res, next) => {
  try {
    const { provider } = req.params;
    const settings = await aiProviderSettingsService.getProviderSettings(provider);
    let models = [];
    if (provider === 'ollama') {
      models = await aiAssistant.getAvailableModels();
    } else {
      models = await aiProviderSettingsService.getProviderModels(provider, settings || {});
    }
    res.json({ success: true, models });
  } catch (error) {
    logger.error('Ошибка при получении моделей AI:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Проверить валидность ключа (verify)
router.post('/ai-settings/:provider/verify', requireAdmin, async (req, res, next) => {
  try {
    const { provider } = req.params;
    const { api_key, base_url } = req.body;
    const result = await aiProviderSettingsService.verifyProviderKey(provider, { api_key, base_url });
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    logger.error('Ошибка при проверке AI-ключа:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ai-assistant', requireAdmin, async (req, res, next) => {
  try {
    const settings = await aiAssistantSettingsService.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    next(error);
  }
});

router.put('/ai-assistant', requireAdmin, async (req, res, next) => {
  try {
    let { selected_rag_tables, ...rest } = req.body;
    // Приведение к массиву чисел
    if (typeof selected_rag_tables === 'string') {
      try {
        selected_rag_tables = JSON.parse(selected_rag_tables);
      } catch {
        selected_rag_tables = [Number(selected_rag_tables)];
      }
    }
    if (!Array.isArray(selected_rag_tables)) {
      selected_rag_tables = [Number(selected_rag_tables)];
    }
    selected_rag_tables = selected_rag_tables.map(Number);

    const updated = await aiAssistantSettingsService.upsertSettings({
      ...rest,
      selected_rag_tables,
      updated_by: req.session.userId || null
    });
    res.json({ success: true, settings: updated });
  } catch (error) {
    next(error);
  }
});

// Получить все наборы правил
router.get('/ai-assistant-rules', requireAdmin, async (req, res, next) => {
  try {
    const rules = await aiAssistantRulesService.getAllRules();
    res.json({ success: true, rules });
  } catch (error) {
    next(error);
  }
});

// Получить набор правил по id
router.get('/ai-assistant-rules/:id', requireAdmin, async (req, res, next) => {
  try {
    const rule = await aiAssistantRulesService.getRuleById(req.params.id);
    res.json({ success: true, rule });
  } catch (error) {
    next(error);
  }
});

// Создать набор правил
router.post('/ai-assistant-rules', requireAdmin, async (req, res, next) => {
  try {
    const created = await aiAssistantRulesService.createRule(req.body);
    res.json({ success: true, rule: created });
  } catch (error) {
    next(error);
  }
});

// Обновить набор правил
router.put('/ai-assistant-rules/:id', requireAdmin, async (req, res, next) => {
  try {
    const updated = await aiAssistantRulesService.updateRule(req.params.id, req.body);
    res.json({ success: true, rule: updated });
  } catch (error) {
    next(error);
  }
});

// Удалить набор правил
router.delete('/ai-assistant-rules/:id', requireAdmin, async (req, res, next) => {
  try {
    await aiAssistantRulesService.deleteRule(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Получить текущие настройки Email (для страницы Email)
router.get('/email-settings', requireAdmin, async (req, res) => {
  try {
    logger.info('[Settings] Запрос getBotSettings(email)');
    const settings = await botsSettings.getBotSettings('email');
    logger.info('[Settings] getBotSettings(email) успешно:', settings);
    res.json({ success: true, settings });
  } catch (error) {
    logger.error('[Settings] Ошибка getBotSettings(email):', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Обновить настройки Email
router.put('/email-settings', requireAdmin, async (req, res, next) => {
  try {
    const { 
      imap_host, 
      imap_port, 
      imap_user, 
      imap_password, 
      smtp_host, 
      smtp_port, 
      smtp_user, 
      smtp_password, 
      from_email, 
      is_active 
    } = req.body;
    
    // Валидация обязательных полей
    if (!imap_host || !imap_port || !imap_user || !imap_password || 
        !smtp_host || !smtp_port || !smtp_user || !smtp_password || !from_email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Все поля обязательны для заполнения' 
      });
    }
    
    const settings = {
      imap_host,
      imap_port: parseInt(imap_port),
      imap_user,
      imap_password,
      smtp_host,
      smtp_port: parseInt(smtp_port),
      smtp_user,
      smtp_password,
      from_email,
      is_active: is_active !== undefined ? is_active : true,
      updated_at: new Date()
    };
    
    const result = await botsSettings.saveBotSettings('email', settings);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Ошибка при обновлении email настроек:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Тест email функциональности
router.post('/email-settings/test', requireAdmin, async (req, res, next) => {
  try {
    const { test_email } = req.body;
    
    if (!test_email) {
      return res.status(400).json({ 
        success: false, 
        error: 'test_email обязателен для тестирования' 
      });
    }
    
    // Отправляем тестовое письмо
    const result = await botsSettings.testEmailSMTP(test_email);
    
    res.json({ 
      success: true, 
      message: 'Тестовое письмо отправлено успешно',
      data: result 
    });
  } catch (error) {
    logger.error('Ошибка при тестировании email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Тест IMAP подключения
router.post('/email-settings/test-imap', requireAdmin, async (req, res, next) => {
  try {
    const result = await botsSettings.testEmailIMAP();
    res.json(result);
  } catch (error) {
    logger.error('Ошибка при тестировании IMAP подключения:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Тест SMTP подключения
router.post('/email-settings/test-smtp', requireAdmin, async (req, res, next) => {
  try {
    const result = await botsSettings.testEmailSMTP();
    res.json(result);
  } catch (error) {
    logger.error('Ошибка при тестировании SMTP подключения:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить список всех email (для ассистента)
router.get('/email-settings/list', requireAdmin, async (req, res) => {
  try {
    logger.info('[Settings] Запрос списка email');
    const emails = await encryptedDb.getData('email_settings', {}, 1000, 'id ASC');
    logger.info('[Settings] Получено email:', emails ? emails.length : 0);
    res.json({ success: true, items: emails });
  } catch (error) {
    logger.error('[Settings] Ошибка получения списка email:', error);
    logger.error('[Settings] Stack:', error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить текущие настройки Telegram-бота (для страницы Telegram)
router.get('/telegram-settings', requireAdmin, async (req, res, next) => {
  try {
    logger.info('[Settings] Запрос getBotSettings(telegram)');
    const settings = await botsSettings.getBotSettings('telegram');
    logger.info('[Settings] getBotSettings успешно:', settings);
    res.json({ success: true, settings });
  } catch (error) {
    logger.error('[Settings] Ошибка getBotSettings(telegram):', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Обновить настройки Telegram-бота
router.put('/telegram-settings', requireAdmin, async (req, res, next) => {
  try {
    const { bot_token, bot_username, webhook_url, is_active } = req.body;
    
    // Валидация обязательных полей
    if (!bot_token || !bot_username) {
      return res.status(400).json({ 
        success: false, 
        error: 'bot_token и bot_username обязательны' 
      });
    }
    
    const settings = {
      bot_token,
      bot_username,
      webhook_url: webhook_url || null,
      is_active: is_active !== undefined ? is_active : true,
      updated_at: new Date()
    };
    
    const result = await botsSettings.saveBotSettings('telegram', settings);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Ошибка при обновлении настроек Telegram:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить список всех Telegram-ботов (для ассистента)
router.get('/telegram-settings/list', requireAdmin, async (req, res, next) => {
  try {
    logger.info('[Settings] Запрос списка telegram ботов');
    const bots = await encryptedDb.getData('telegram_settings', {}, 1000, 'id ASC');
    logger.info('[Settings] Получено telegram ботов:', bots ? bots.length : 0);
    res.json({ success: true, items: bots });
  } catch (error) {
    logger.error('[Settings] Ошибка получения списка telegram:', error);
    logger.error('[Settings] Stack:', error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получение списка моделей для выбранного AI-провайдера
router.get('/ai-provider-models', requireAdmin, async (req, res, next) => {
  try {
    const provider = req.query.provider;
    if (!provider) return res.status(400).json({ error: 'provider is required' });
    const settings = await aiProviderSettingsService.getProviderSettings(provider);
    if (!settings) return res.status(404).json({ error: 'Provider not found' });
    const models = await aiProviderSettingsService.getProviderModels(provider, {
      api_key: settings.api_key,
      base_url: settings.base_url,
    });
    res.json({ models });
  } catch (error) {
    next(error);
  }
});

// Получить настройки базы данных
router.get('/db-settings', async (req, res) => {
  try {
    const settings = await dbSettingsService.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Обновить настройки базы данных
router.put('/db-settings', requireAdmin, async (req, res, next) => {
  try {
    const { db_host, db_port, db_name, db_user, db_password } = req.body;
    const updated = await dbSettingsService.upsertSettings({ db_host, db_port, db_name, db_user, db_password });
    res.json({ success: true, settings: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить статус подключения к БД
router.get('/db-settings/connection-status', requireAdmin, async (req, res, next) => {
  try {
    const status = await dbSettingsService.getConnectionStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Принудительное переподключение к БД
router.post('/db-settings/reconnect', requireAdmin, async (req, res, next) => {
  try {
    const result = await dbSettingsService.reconnect();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить все LLM-модели
router.get('/llm-models', requireAdmin, async (req, res) => {
  try {
    const models = await aiProviderSettingsService.getAllLLMModels();
    res.json({ success: true, models });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить все embedding-модели
router.get('/embedding-models', requireAdmin, async (req, res) => {
  try {
    const models = await aiProviderSettingsService.getAllEmbeddingModels();
    res.json({ success: true, models });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router; 