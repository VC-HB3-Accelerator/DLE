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

const encryptedDb = require('./encryptedDatabaseService');
const db = require('../db');
const TABLE = 'ai_assistant_settings';
const logger = require('../utils/logger');

async function getSettings() {
  try {
    logger.info('[aiAssistantSettingsService] getSettings called');
    
    const settings = await encryptedDb.getData(TABLE, {}, 1, 'id');
    logger.info(`[aiAssistantSettingsService] Raw settings from DB:`, settings);
    
    const setting = settings[0] || null;
    if (!setting) {
      logger.warn('[aiAssistantSettingsService] No settings found in DB');
      return null;
    }

    // Обрабатываем selected_rag_tables
    if (setting.selected_rag_tables) {
      try {
        // Если это строка JSON, парсим её
        if (typeof setting.selected_rag_tables === 'string') {
          setting.selected_rag_tables = JSON.parse(setting.selected_rag_tables);
        }
        
        // Убеждаемся, что это массив
        if (!Array.isArray(setting.selected_rag_tables)) {
          setting.selected_rag_tables = [setting.selected_rag_tables];
        }
        
        logger.info(`[aiAssistantSettingsService] Processed selected_rag_tables:`, setting.selected_rag_tables);
      } catch (parseError) {
        logger.error('[aiAssistantSettingsService] Error parsing selected_rag_tables:', parseError);
        setting.selected_rag_tables = [];
      }
    } else {
      setting.selected_rag_tables = [];
    }

    // Обрабатываем rules_id
    if (setting.rules_id && typeof setting.rules_id === 'string') {
      try {
        setting.rules_id = parseInt(setting.rules_id);
      } catch (parseError) {
        logger.error('[aiAssistantSettingsService] Error parsing rules_id:', parseError);
        setting.rules_id = null;
      }
    }

    const defaultChannelState = { web: true, telegram: true, email: true };
    let enabledChannels = setting.enabled_channels;
    if (typeof enabledChannels === 'string') {
      try {
        enabledChannels = JSON.parse(enabledChannels);
      } catch (parseError) {
        logger.error('[aiAssistantSettingsService] Error parsing enabled_channels:', parseError);
        enabledChannels = null;
      }
    }
    if (!enabledChannels || typeof enabledChannels !== 'object') {
      enabledChannels = { ...defaultChannelState };
    } else {
      enabledChannels = {
        ...defaultChannelState,
        ...Object.keys(enabledChannels).reduce((acc, key) => {
          acc[key] = Boolean(enabledChannels[key]);
          return acc;
        }, {})
      };
    }
    setting.enabled_channels = enabledChannels;

    logger.info(`[aiAssistantSettingsService] Final settings result:`, {
      id: setting.id,
      selected_rag_tables: setting.selected_rag_tables,
      rules_id: setting.rules_id,
      hasSupportEmail: setting.hasSupportEmail,
      hasTelegramBot: setting.hasTelegramBot,
      timestamp: setting.timestamp,
      enabled_channels: setting.enabled_channels
    });

    return setting;
  } catch (error) {
    logger.error('[aiAssistantSettingsService] Error in getSettings:', error);
    throw error;
  }
}

async function upsertSettings({
  system_prompt,
  selected_rag_tables,
  model,
  embedding_model,
  rules,
  updated_by,
  telegram_settings_id,
  email_settings_id,
  system_message,
  enabled_channels
}) {
  const defaultChannelState = { web: true, telegram: true, email: true };
  let channelsPayload = enabled_channels;
  if (!channelsPayload || typeof channelsPayload !== 'object') {
    channelsPayload = { ...defaultChannelState };
  } else {
    channelsPayload = {
      ...defaultChannelState,
      ...Object.keys(channelsPayload).reduce((acc, key) => {
        acc[key] = Boolean(channelsPayload[key]);
        return acc;
      }, {})
    };
  }

  const data = {
    id: 1,
    system_prompt,
    selected_rag_tables,
    languages: ['ru'],
    model,
    embedding_model,
    rules,
    updated_at: new Date(),
    updated_by,
    telegram_settings_id,
    email_settings_id,
    system_message,
    enabled_channels: channelsPayload
  };

  const existing = await encryptedDb.getData(TABLE, { id: 1 }, 1);

  if (existing.length > 0) {
    return await encryptedDb.saveData(TABLE, data, { id: 1 });
  } else {
    return await encryptedDb.saveData(TABLE, data);
  }
}

module.exports = { getSettings, upsertSettings }; 