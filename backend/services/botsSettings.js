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

const db = require('../db');
const encryptedDb = require('./encryptedDatabaseService');
const logger = require('../utils/logger');

/**
 * Сервис для работы с настройками ботов
 */

/**
 * Получить настройки конкретного бота
 * @param {string} botType - Тип бота (telegram, email)
 * @returns {Promise<Object|null>}
 */
async function getBotSettings(botType) {
  try {
    let tableName;
    
    switch (botType) {
      case 'telegram':
        tableName = 'telegram_settings';
        break;
      case 'email':
        tableName = 'email_settings';
        break;
      default:
        throw new Error(`Unknown bot type: ${botType}`);
    }

    // Используем encryptedDb для автоматической расшифровки
    const settings = await encryptedDb.getData(tableName, {}, 1);

    return settings.length > 0 ? settings[0] : null;
    
  } catch (error) {
    logger.error(`[BotsSettings] Ошибка получения настроек ${botType}:`, error);
    throw error;
  }
}

/**
 * Сохранить настройки бота
 * @param {string} botType - Тип бота
 * @param {Object} settings - Настройки
 * @returns {Promise<Object>}
 */
async function saveBotSettings(botType, settings) {
  try {
    let tableName;
    
    switch (botType) {
      case 'telegram':
        tableName = 'telegram_settings';
        break;
      case 'email':
        tableName = 'email_settings';
        break;
      default:
        throw new Error(`Unknown bot type: ${botType}`);
    }

    // Простое сохранение - детали зависят от структуры таблицы
    const { rows } = await db.getQuery()(
      `INSERT INTO ${tableName} (settings, updated_at) 
       VALUES ($1, NOW()) 
       ON CONFLICT (id) DO UPDATE SET settings = $1, updated_at = NOW()
       RETURNING *`,
      [JSON.stringify(settings)]
    );

    return rows[0];
    
  } catch (error) {
    logger.error(`[BotsSettings] Ошибка сохранения настроек ${botType}:`, error);
    throw error;
  }
}

/**
 * Получить настройки всех ботов
 * @returns {Promise<Object>}
 */
async function getAllBotsSettings() {
  try {
    const settings = {
      telegram: await getBotSettings('telegram').catch(() => null),
      email: await getBotSettings('email').catch(() => null)
    };

    return settings;
    
  } catch (error) {
    logger.error('[BotsSettings] Ошибка получения всех настроек:', error);
    throw error;
  }
}

module.exports = {
  getBotSettings,
  saveBotSettings,
  getAllBotsSettings
};

