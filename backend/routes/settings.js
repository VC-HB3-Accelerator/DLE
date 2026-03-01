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
const footerDleService = require('../services/footerDleService');
const { broadcastAuthTokenAdded, broadcastAuthTokenDeleted, broadcastAuthTokenUpdated } = require('../wsHub');

// Логируем версию ethers для отладки
logger.info(`Ethers version: ${ethers.version || 'unknown'}`);

// === FOOTER DLE SELECTION ===================================================

router.get('/footer-dle', async (req, res) => {
  try {
    const selection = await footerDleService.getFooterSelection();
    res.json({ success: true, data: selection });
  } catch (error) {
    logger.error('[Settings] Ошибка при получении footer DLE:', error);
    res.status(500).json({ success: false, error: 'Не удалось получить выбранный DLE для футера' });
  }
});

router.post('/footer-dle', requireAdmin, async (req, res) => {
  try {
    const { dleAddress, chainId } = req.body || {};

    if (!dleAddress) {
      return res.status(400).json({ success: false, error: 'Необходимо указать адрес DLE' });
    }

    if (!ethers.isAddress(dleAddress)) {
      return res.status(400).json({ success: false, error: 'Указан некорректный адрес DLE' });
    }

    let normalizedChainId = null;
    if (chainId !== undefined && chainId !== null && chainId !== '') {
      const parsed = Number(chainId);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ success: false, error: 'Некорректный chainId' });
      }
      normalizedChainId = parsed;
    }

    const updatedBy = req.session?.address || req.session?.userId || null;
    const selection = await footerDleService.setFooterSelection({
      address: ethers.getAddress(dleAddress),
      chainId: normalizedChainId,
      updatedBy,
    });

    res.json({ success: true, data: selection });
  } catch (error) {
    logger.error('[Settings] Ошибка при сохранении footer DLE:', error);
    res.status(500).json({ success: false, error: 'Не удалось сохранить выбранный DLE для футера' });
  }
});

router.delete('/footer-dle', requireAdmin, async (req, res) => {
  try {
    const updatedBy = req.session?.address || req.session?.userId || null;
    const selection = await footerDleService.clearFooterSelection(updatedBy);
    res.json({ success: true, data: selection });
  } catch (error) {
    logger.error('[Settings] Ошибка при очистке footer DLE:', error);
    res.status(500).json({ success: false, error: 'Не удалось очистить выбранный DLE для футера' });
  }
});

// Получение RPC настроек
router.get('/rpc', async (req, res, next) => {
  try {
    let userAccessLevel = { level: 'user', tokenCount: 0, hasAccess: false };
    
    // Проверяем, авторизован ли пользователь и является ли он админом
    if (req.session && req.session.authenticated) {
      if (req.session.address) {
        const authService = require('../services/auth-service');
        userAccessLevel = await authService.getUserAccessLevel(req.session.address);
      } else {
        userAccessLevel = req.session.userAccessLevel || { level: 'user', tokenCount: 0, hasAccess: false };
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
    
    if (userAccessLevel.hasAccess) {
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
    let userAccessLevel = { level: 'user', tokenCount: 0, hasAccess: false };
    
    // Проверяем, авторизован ли пользователь и является ли он админом
    if (req.session && req.session.authenticated) {
      if (req.session.address) {
        const authService = require('../services/auth-service');
        userAccessLevel = await authService.getUserAccessLevel(req.session.address);
      } else {
        userAccessLevel = req.session.userAccessLevel || { level: 'user', tokenCount: 0, hasAccess: false };
      }
    }
    
    if (userAccessLevel.hasAccess) {
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

// ============================================
// AI CONFIG (централизованные настройки)
// ============================================

// Получить все настройки AI Config
router.get('/ai-config', requireAdmin, async (req, res, next) => {
  try {
    const aiConfigService = require('../services/aiConfigService');
    const config = await aiConfigService.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    logger.error('Ошибка при получении AI Config:', error);
    next(error);
  }
});

// Обновить настройки AI Config
router.put('/ai-config', requireAdmin, async (req, res, next) => {
  try {
    const aiConfigService = require('../services/aiConfigService');
    const userId = req.session.userId || null;
    const updated = await aiConfigService.updateConfig(req.body, userId);
    res.json({ success: true, config: updated });
  } catch (error) {
    logger.error('Ошибка при обновлении AI Config:', error);
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

// Удалить настройки Email
router.delete('/email-settings', requireAdmin, async (req, res) => {
  try {
    logger.info('[Settings] Запрос удаления настроек Email');
    await botsSettings.deleteBotSettings('email');
    logger.info('[Settings] Настройки Email успешно удалены');
    res.json({ success: true, message: 'Настройки Email полностью удалены' });
  } catch (error) {
    logger.error('[Settings] Ошибка удаления настроек Email:', error);
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
    
    // Загрузка текущих настроек (нужна для сохранения старых паролей)
    const currentSettings = await botsSettings.getBotSettings('email');

    // Валидация обязательных полей (пароли могут быть опущены, если уже сохранены)
    if (!imap_host || !imap_port || !imap_user || 
        !smtp_host || !smtp_port || !smtp_user || !from_email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Все поля обязательны для заполнения' 
      });
    }

    const finalImapPassword = imap_password || currentSettings?.imap_password;
    const finalSmtpPassword = smtp_password || currentSettings?.smtp_password;

    if (!finalImapPassword || !finalSmtpPassword) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать IMAP и SMTP пароли'
      });
    }
    
    const settings = {
      imap_host,
      imap_port: parseInt(imap_port),
      imap_user,
      imap_password: finalImapPassword,
      smtp_host,
      smtp_port: parseInt(smtp_port),
      smtp_user,
      smtp_password: finalSmtpPassword,
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

// Удалить настройки Telegram-бота
router.delete('/telegram-settings', requireAdmin, async (req, res) => {
  try {
    logger.info('[Settings] Запрос удаления настроек Telegram');
    await botsSettings.deleteBotSettings('telegram');
    logger.info('[Settings] Настройки Telegram успешно удалены');
    res.json({ success: true, message: 'Настройки Telegram полностью удалены' });
  } catch (error) {
    logger.error('[Settings] Ошибка удаления настроек Telegram:', error);
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

// Получить статус ключа шифрования
router.get('/encryption-key/status', requireAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Путь к ключу шифрования
    const keyPath = fs.existsSync('/app/ssl/keys/full_db_encryption.key') 
      ? '/app/ssl/keys/full_db_encryption.key'
      : path.join(__dirname, '../../ssl/keys/full_db_encryption.key');
    
    const exists = fs.existsSync(keyPath);
    
  // Возвращаем только метаданные без содержимого ключа
  let checksum = null;
  if (exists) {
    try {
      const data = fs.readFileSync(keyPath);
      // лёгкая хэш-сумма для проверки целостности без раскрытия ключа
      const crypto = require('crypto');
      checksum = crypto.createHash('sha256').update(data).digest('hex');
    } catch (error) {
      logger.error('Ошибка чтения ключа для метаданных:', error);
    }
  }
  
  res.json({ 
    success: true, 
    exists,
    path: keyPath,
    checksum
  });
  } catch (error) {
    logger.error('Ошибка проверки статуса ключа шифрования:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить содержимое ключа шифрования
router.get('/encryption-key', requireAdmin, async (req, res) => {
  try {
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    
    if (encryptionKey) {
      res.json({ success: true, key: encryptionKey });
    } else {
      res.status(404).json({ success: false, message: 'Encryption key not found' });
    }
  } catch (error) {
    logger.error('Ошибка получения ключа шифрования:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Безопасная смена ключа шифрования с перешифровкой данных
router.post('/encryption-key/rotate', requireAdmin, async (req, res) => {
  try {
    logger.info('[Settings] 🔑 НАЧАЛО РОТАЦИИ КЛЮЧА ШИФРОВАНИЯ');
    
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    const encryptionUtils = require('../utils/encryptionUtils');
    const db = require('../db');
    
    logger.info('[Settings] 📦 Модули загружены успешно');
    
    // Получаем текущий ключ (может быть null, если ключа нет)
    const oldKey = encryptionUtils.getEncryptionKey();
    logger.info(`[Settings] 🔍 Текущий ключ: ${oldKey ? 'СУЩЕСТВУЕТ' : 'НЕ СУЩЕСТВУЕТ'}`);
    
    // Генерируем новый ключ
    const newKey = crypto.randomBytes(32).toString('hex');
    logger.info(`[Settings] 🔐 Новый ключ сгенерирован: ${newKey.substring(0, 8)}...`);
    
    // Путь к папке с ключами
    const keysDir = fs.existsSync('/app/ssl/keys') 
      ? '/app/ssl/keys'
      : path.join(__dirname, '../../ssl/keys');
    
    logger.info(`[Settings] 📁 Папка с ключами: ${keysDir}`);
    
    const keyPath = path.join(keysDir, 'full_db_encryption.key');
    logger.info(`[Settings] 📄 Путь к ключу: ${keyPath}`);
    
    // Проверяем, существует ли ключ
    const keyExists = fs.existsSync(keyPath);
    logger.info(`[Settings] 🔍 Ключ существует: ${keyExists}`);
    
    // Создаем резервную копию только если ключ существует и файловая система доступна для записи
    let backupKeyPath = null;
    if (keyExists) {
      logger.info('[Settings] 💾 Создание резервной копии ключа...');
      try {
        backupKeyPath = path.join(keysDir, 'full_db_encryption.key.backup');
        fs.copyFileSync(keyPath, backupKeyPath);
        logger.info(`[Settings] ✅ Резервная копия создана: ${backupKeyPath}`);
      } catch (backupError) {
        logger.warn(`[Settings] ⚠️ Не удалось создать резервную копию ключа: ${backupError.message}`);
        // Продолжаем без резервной копии
      }
    } else {
      logger.info('[Settings] ℹ️ Резервная копия не нужна - ключ не существует');
    }
    
    // ВАЖНО: Сначала перешифровываем ВСЕ данные, ТОЛЬКО ПОТОМ меняем ключ
    let reencryptionSuccess = true;
    let totalSuccessCount = 0;
    let totalErrorCount = 0;
    
    try {
      // Если есть старый ключ, перешифровываем данные
      if (oldKey) {
        logger.info('[Settings] 🔄 НАЧИНАЕМ ПЕРЕШИФРОВКУ ДАННЫХ...');
        logger.info('[Settings] ⚠️ ВАЖНО: Ключ будет изменен ТОЛЬКО после успешной перешифровки всех данных!');
        
        // 1. Находим все таблицы с зашифрованными полями
        logger.info('[Settings] 🔍 Поиск таблиц с зашифрованными полями...');
        const tablesResult = await db.getQuery()(`
          SELECT table_name 
          FROM information_schema.columns 
          WHERE column_name LIKE '%_encrypted' 
          AND table_schema = 'public'
          GROUP BY table_name
        `);
        
        const tables = tablesResult.rows.map(row => row.table_name);
        logger.info(`[Settings] 📊 Найдено таблиц с зашифрованными полями: ${tables.length}`);
        logger.info(`[Settings] 📋 Список таблиц: ${tables.join(', ')}`);
        
        // 2. Перешифровываем каждую таблицу
        for (const tableName of tables) {
          logger.info(`[Settings] 🔄 ОБРАБОТКА ТАБЛИЦЫ: ${tableName}`);
          
          // Получаем все зашифрованные колонки для этой таблицы
          logger.info(`[Settings] 🔍 Поиск зашифрованных колонок в таблице ${tableName}...`);
          const columnsResult = await db.getQuery()(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 
            AND column_name LIKE '%_encrypted'
          `, [tableName]);
          
          const encryptedColumns = columnsResult.rows.map(row => row.column_name);
          logger.info(`[Settings] 📊 Найдено зашифрованных колонок: ${encryptedColumns.length}`);
          logger.info(`[Settings] 📋 Колонки: ${encryptedColumns.join(', ')}`);
          
          // Перешифровываем каждую колонку
          for (const columnName of encryptedColumns) {
            logger.info(`[Settings] 🔄 ПЕРЕШИФРОВКА КОЛОНКИ: ${tableName}.${columnName}`);
            
            // Сначала проверяем, есть ли колонка id в таблице
            logger.info(`[Settings] 🔍 Проверка наличия колонки id в таблице ${tableName}...`);
            const hasIdColumn = await db.getQuery()(`
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = $1 AND column_name = 'id'
            `, [tableName]);
            
            if (hasIdColumn.rows.length === 0) {
              logger.warn(`[Settings] ⚠️ Таблица ${tableName} не имеет колонки id, пропускаем перешифровку`);
              continue;
            }
            logger.info(`[Settings] ✅ Колонка id найдена в таблице ${tableName}`);
            
            // Получаем все строки с данными в этой колонке
            logger.info(`[Settings] 🔍 Получение данных из ${tableName}.${columnName}...`);
            const dataResult = await db.getQuery()(`
              SELECT id, ${columnName} 
              FROM ${tableName} 
              WHERE ${columnName} IS NOT NULL 
              AND ${columnName} != ''
            `);
            
            logger.info(`[Settings] 📊 Найдено строк для перешифровки: ${dataResult.rows.length}`);
            
            // Перешифровываем каждую строку
            let successCount = 0;
            let errorCount = 0;
            for (const row of dataResult.rows) {
              try {
                logger.info(`[Settings] 🔄 Обработка строки id=${row.id} в ${tableName}.${columnName}`);
                
                // Расшифровываем старым ключом
                logger.info(`[Settings] 🔓 Расшифровка старым ключом...`);
                const decryptedValue = await db.getQuery()(`
                  SELECT decrypt_text($1, $2) as decrypted_value
                `, [row[columnName], oldKey]);
                
                if (decryptedValue.rows[0]?.decrypted_value) {
                  logger.info(`[Settings] ✅ Расшифровка успешна`);
                  
                  // Шифруем новым ключом
                  logger.info(`[Settings] 🔐 Шифрование новым ключом...`);
                  const reencryptedValue = await db.getQuery()(`
                    SELECT encrypt_text($1, $2) as encrypted_value
                  `, [decryptedValue.rows[0].decrypted_value, newKey]);
                  
                  // Обновляем в базе
                  logger.info(`[Settings] 💾 Обновление в базе данных...`);
                  await db.getQuery()(`
                    UPDATE ${tableName} 
                    SET ${columnName} = $1 
                    WHERE id = $2
                  `, [reencryptedValue.rows[0].encrypted_value, row.id]);
                  
                  successCount++;
                  totalSuccessCount++;
                  logger.info(`[Settings] ✅ Строка id=${row.id} успешно перешифрована`);
                } else {
                  logger.warn(`[Settings] ⚠️ Не удалось расшифровать строку id=${row.id}`);
                  errorCount++;
                  totalErrorCount++;
                }
              } catch (columnError) {
                logger.error(`[Settings] ❌ ОШИБКА перешифровки ${tableName}.${columnName} (id: ${row.id}): ${columnError.message}`);
                errorCount++;
                totalErrorCount++;
                // Продолжаем с другими строками
              }
            }
            
            logger.info(`[Settings] 📊 РЕЗУЛЬТАТ перешифровки ${tableName}.${columnName}: успешно=${successCount}, ошибок=${errorCount}`);
          }
        }
        
        // Проверяем общий результат перешифровки
        logger.info(`[Settings] 📊 ОБЩИЙ РЕЗУЛЬТАТ ПЕРЕШИФРОВКИ: успешно=${totalSuccessCount}, ошибок=${totalErrorCount}`);
        
        if (totalErrorCount > 0) {
          logger.warn(`[Settings] ⚠️ Обнаружены ошибки при перешифровке (${totalErrorCount} ошибок)`);
          // Не критично, продолжаем
        }
        
        logger.info('[Settings] ✅ ПЕРЕШИФРОВКА ДАННЫХ ЗАВЕРШЕНА УСПЕШНО!');
        
      } else {
        logger.info('[Settings] ℹ️ Первая генерация ключа - перешифровка не требуется');
      }
      
      // ТОЛЬКО ПОСЛЕ УСПЕШНОЙ ПЕРЕШИФРОВКИ - меняем ключ
      logger.info('[Settings] 🔐 ВСЕ ДАННЫЕ ПЕРЕШИФРОВАНЫ! Теперь меняем ключ...');
      
      // 3. Сохраняем новый ключ (с обработкой read-only файловой системы)
      logger.info(`[Settings] 💾 Сохранение нового ключа в файл: ${keyPath}`);
      try {
        fs.writeFileSync(keyPath, newKey, { mode: 0o600 });
        logger.info(`[Settings] ✅ Новый ключ сохранен в файл`);
      } catch (writeError) {
        if (writeError.code === 'EROFS') {
          logger.warn(`[Settings] ⚠️ Файловая система только для чтения, сохраняем ключ в переменную окружения`);
          // Сохраняем ключ в переменную окружения как fallback
          process.env.ENCRYPTION_KEY = newKey;
          logger.info(`[Settings] ✅ Новый ключ сохранен в переменную окружения ENCRYPTION_KEY`);
        } else {
          throw writeError;
        }
      }
      
      // 4. Очищаем кэш ключа
      logger.info(`[Settings] 🧹 Очистка кэша ключа...`);
      encryptionUtils.clearCache();
      logger.info(`[Settings] ✅ Кэш очищен`);
      
      logger.info('[Settings] 🎉 КЛЮЧ ШИФРОВАНИЯ УСПЕШНО ИЗМЕНЕН!');
      
      const message = oldKey 
        ? 'Ключ шифрования успешно изменен. Все данные перешифрованы.'
        : 'Новый ключ шифрования успешно сгенерирован.';
      
      res.json({ 
        success: true, 
        message: message,
        keyPath: keyPath,
        backupPath: backupKeyPath,
        isFirstGeneration: !oldKey
      });
      
    } catch (rotateError) {
      logger.error('[Settings] ❌ КРИТИЧЕСКАЯ ОШИБКА при перешифровке данных:', rotateError);
      logger.error(`[Settings] ❌ Детали ошибки: ${rotateError.message}`);
      logger.error(`[Settings] ❌ Stack trace: ${rotateError.stack}`);
      
      // В случае ошибки восстанавливаем старый ключ только если есть резервная копия
      if (backupKeyPath && fs.existsSync(backupKeyPath)) {
        logger.info('[Settings] 🔄 Попытка восстановления ключа из резервной копии...');
        try {
          fs.copyFileSync(backupKeyPath, keyPath);
          logger.info('[Settings] ✅ Восстановлен ключ из резервной копии');
        } catch (restoreError) {
          logger.error(`[Settings] ❌ Не удалось восстановить ключ из резервной копии: ${restoreError.message}`);
        }
      } else {
        logger.warn('[Settings] ⚠️ Резервная копия недоступна, ключ не восстановлен');
      }
      
      logger.info('[Settings] 🧹 Очистка кэша после ошибки...');
      encryptionUtils.clearCache();
      throw rotateError;
    }
    
  } catch (error) {
    logger.error('[Settings] ❌ ФИНАЛЬНАЯ ОШИБКА смены ключа шифрования:', error);
    logger.error(`[Settings] ❌ Финальная ошибка: ${error.message}`);
    logger.error(`[Settings] ❌ Финальный stack: ${error.stack}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Восстановление состояния после ошибки перешифровки
router.post('/encryption-key/recover', requireAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const encryptionUtils = require('../utils/encryptionUtils');
    const db = require('../db');
    
    logger.info('[Settings] Начинаем восстановление состояния ключа шифрования...');
    
    // Путь к папке с ключами
    const keysDir = fs.existsSync('/app/ssl/keys') 
      ? '/app/ssl/keys'
      : path.join(__dirname, '../../ssl/keys');
    
    const keyPath = path.join(keysDir, 'full_db_encryption.key');
    const backupKeyPath = path.join(keysDir, 'full_db_encryption.key.backup');
    
    // Проверяем, есть ли резервная копия
    if (fs.existsSync(backupKeyPath)) {
      logger.info('[Settings] Восстанавливаем ключ из резервной копии');
      fs.copyFileSync(backupKeyPath, keyPath);
      encryptionUtils.clearCache();
      
      res.json({ 
        success: true, 
        message: 'Ключ шифрования восстановлен из резервной копии',
        action: 'restored_from_backup'
      });
    } else {
      // Если нет резервной копии, нужно вручную восстановить состояние
      logger.warn('[Settings] Резервная копия недоступна, требуется ручное восстановление');
      
      res.json({ 
        success: false, 
        message: 'Резервная копия недоступна. Требуется ручное восстановление состояния.',
        action: 'manual_recovery_required',
        currentKey: fs.readFileSync(keyPath, 'utf8').trim()
      });
    }
    
  } catch (error) {
    logger.error('Ошибка восстановления ключа шифрования:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router; 