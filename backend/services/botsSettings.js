/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
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

    const dataToSave = {
      ...settings,
      updated_at: new Date()
    };

    // Проверяем, существуют ли записи в таблице
    const existing = await encryptedDb.getData(tableName, {}, 1);

    if (existing.length > 0) {
      // Обновляем первую запись (ожидаем, что таблица хранит единственную конфигурацию)
      return await encryptedDb.saveData(tableName, dataToSave, { id: existing[0].id });
    }

    // Если записей нет, создаем новую
    return await encryptedDb.saveData(tableName, {
      ...dataToSave,
      created_at: new Date()
    });
    
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

/**
 * Удалить настройки бота
 * @param {string} botType - Тип бота (telegram, email)
 * @returns {Promise<void>}
 */
async function deleteBotSettings(botType) {
  try {
    let tableName;
    let foreignKeyColumn;
    
    switch (botType) {
      case 'telegram':
        tableName = 'telegram_settings';
        foreignKeyColumn = 'telegram_settings_id';
        break;
      case 'email':
        tableName = 'email_settings';
        foreignKeyColumn = 'email_settings_id';
        break;
      default:
        throw new Error(`Unknown bot type: ${botType}`);
    }

    // Сначала обновляем связанные записи, устанавливая foreign key в NULL
    await db.getQuery()(`
      UPDATE ai_assistant_settings 
      SET ${foreignKeyColumn} = NULL 
      WHERE ${foreignKeyColumn} IS NOT NULL
    `);
    
    logger.info(`[BotsSettings] Обновлены связанные записи для ${botType}`);
    
    // Затем удаляем все записи из таблицы настроек
    await db.getQuery()(`DELETE FROM ${tableName}`);
    
    logger.info(`[BotsSettings] Настройки ${botType} успешно удалены`);
    
  } catch (error) {
    logger.error(`[BotsSettings] Ошибка удаления настроек ${botType}:`, error);
    throw error;
  }
}

module.exports = {
  getBotSettings,
  saveBotSettings,
  getAllBotsSettings,
  deleteBotSettings
};

