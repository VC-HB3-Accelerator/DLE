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

const encryptedDb = require('./encryptedDatabaseService');
const logger = require('../utils/logger');

class DbSettingsService {
  constructor() {
    this.connectionManager = null;
    this.initialized = false;
  }

  /**
   * Инициализация сервиса
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Динамически импортируем менеджер подключений
      this.connectionManager = require('./databaseConnectionManager');
      await this.connectionManager.initialize();
      this.initialized = true;
      logger.info('[DbSettingsService] Сервис инициализирован');
    } catch (error) {
      logger.error('[DbSettingsService] Ошибка инициализации:', error);
      // Не прерываем выполнение, сервис будет работать без динамического обновления
    }
  }

  async getSettings() {
    const rows = await encryptedDb.getData('db_settings', { id: 1 }, 1);
    return rows[0];
  }

  async upsertSettings({ db_host, db_port, db_name, db_user, db_password }) {
    try {
      const data = {
        id: 1,
        db_host,
        db_port,
        db_name,
        db_user,
        db_password,
        updated_at: new Date()
      };

      // Пытаемся обновить существующую запись
      const existing = await this.getSettings();
      let result;
      
      if (existing) {
        result = await encryptedDb.saveData('db_settings', data, { id: 1 });
      } else {
        result = await encryptedDb.saveData('db_settings', data);
      }

      // После успешного сохранения обновляем подключение к БД
      if (this.connectionManager && this.initialized) {
        try {
          await this.connectionManager.updateConnection({
            db_host,
            db_port,
            db_name,
            db_user,
            db_password
          });
          
          logger.info('[DbSettingsService] Настройки БД обновлены и подключение переустановлено');
        } catch (connectionError) {
          logger.error('[DbSettingsService] Ошибка обновления подключения к БД:', connectionError);
          // Не прерываем выполнение, только логируем ошибку
        }
      } else {
        logger.warn('[DbSettingsService] Менеджер подключений не инициализирован, перезапустите приложение для применения изменений');
      }

      return result;
    } catch (error) {
      logger.error('[DbSettingsService] Ошибка сохранения настроек БД:', error);
      throw error;
    }
  }

  /**
   * Получить статус шифрования
   */
  getEncryptionStatus() {
    return encryptedDb.getEncryptionStatus();
  }

  /**
   * Получить статус подключения к БД
   */
  getConnectionStatus() {
    if (this.connectionManager && this.initialized) {
      return this.connectionManager.getConnectionStatus();
    }
    return {
      isConnected: false,
      config: null,
      isReconnecting: false,
      listenersCount: 0,
      error: 'Менеджер подключений не инициализирован'
    };
  }

  /**
   * Принудительное переподключение к БД
   */
  async reconnect() {
    if (!this.connectionManager || !this.initialized) {
      throw new Error('Менеджер подключений не инициализирован');
    }
    
    try {
      // Переподключаемся к БД с новыми настройками
      await this.connectionManager.reconnect();
      
      // logger.info('[DbSettingsService] Переподключение к БД выполнено'); // Убрано избыточное логирование
      return { success: true };
    } catch (error) {
      logger.error('[DbSettingsService] Ошибка переподключения к БД:', error);
      throw error;
    }
  }
}

module.exports = new DbSettingsService(); 