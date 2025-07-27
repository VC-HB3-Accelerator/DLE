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
const authTokenService = require('../services/authTokenService');
const aiProviderSettingsService = require('../services/aiProviderSettingsService');
const aiAssistant = require('../services/ai-assistant');
const dns = require('node:dns').promises;
const aiAssistantSettingsService = require('../services/aiAssistantSettingsService');
const aiAssistantRulesService = require('../services/aiAssistantRulesService');
const telegramBot = require('../services/telegramBot');
const EmailBotService = require('../services/emailBot');
const emailBotService = new EmailBotService();
const dbSettingsService = require('../services/dbSettingsService');

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
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }

    const rpcProvidersResult = await db.getQuery()(
      'SELECT id, chain_id, created_at, updated_at, decrypt_text(network_id_encrypted, $1) as network_id, decrypt_text(rpc_url_encrypted, $1) as rpc_url FROM rpc_providers',
      [encryptionKey]
    );
    const rpcConfigs = rpcProvidersResult.rows;
    
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
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }

    const tokensResult = await db.getQuery()(
      'SELECT id, min_balance, created_at, updated_at, decrypt_text(name_encrypted, $1) as name, decrypt_text(address_encrypted, $1) as address, decrypt_text(network_encrypted, $1) as network FROM auth_tokens',
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
    res.json({ success: true, message: 'Токены аутентификации успешно сохранены' });
  } catch (error) {
    logger.error('Ошибка при сохранении токенов аутентификации:', error);
    next(error);
  }
});

// Добавление/обновление одного токена
router.post('/auth-token', requireAdmin, async (req, res, next) => {
  try {
    const { name, address, network, minBalance } = req.body;
    if (!name || !address || !network) {
      return res.status(400).json({ success: false, error: 'name, address и network обязательны' });
    }
    await authTokenService.upsertAuthToken({ name, address, network, minBalance });
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
    const settings = await emailBotService.getSettingsFromDb();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Получить список всех email (для ассистента)
router.get('/email-settings/list', requireAdmin, async (req, res) => {
  try {
    const emails = await emailBotService.getAllEmailSettings();
    res.json({ success: true, items: emails });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Получить текущие настройки Telegram-бота (для страницы Telegram)
router.get('/telegram-settings', requireAdmin, async (req, res, next) => {
  try {
    const settings = await telegramBot.getTelegramSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Получить список всех Telegram-ботов (для ассистента)
router.get('/telegram-settings/list', requireAdmin, async (req, res, next) => {
  try {
    const bots = await telegramBot.getAllBots();
    res.json({ success: true, items: bots });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
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
router.put('/db-settings', requireAdmin, async (req, res) => {
  try {
    const { db_host, db_port, db_name, db_user, db_password } = req.body;
    const updated = await dbSettingsService.upsertSettings({ db_host, db_port, db_name, db_user, db_password });
    res.json({ success: true, settings: updated });
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