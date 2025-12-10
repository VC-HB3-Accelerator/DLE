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

/**
 * Сервис для динамического управления подключениями к базе данных
 * Позволяет изменять настройки БД без перезапуска приложения
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

class DatabaseConnectionManager {
  constructor() {
    this.currentPool = null;
    this.currentConfig = null;
    this.connectionListeners = [];
    this.isReconnecting = false;
  }

  /**
   * Инициализация с дефолтными настройками
   */
  async initialize() {
    try {
      // Загружаем текущие настройки из БД
      const dbSettingsService = require('./dbSettingsService');
      const settings = await dbSettingsService.getSettings();
      
      if (settings) {
        await this.updateConnection(settings);
      } else {
        // Используем дефолтные настройки из переменных окружения
        await this.updateConnection({
          db_host: process.env.DB_HOST || 'postgres',
          db_port: parseInt(process.env.DB_PORT) || 5432,
          db_name: process.env.DB_NAME || 'dapp_db',
          db_user: process.env.DB_USER || 'dapp_user',
          db_password: process.env.DB_PASSWORD || 'dapp_password'
        });
      }
      
      logger.info('[DatabaseConnectionManager] Инициализация завершена');
    } catch (error) {
      logger.error('[DatabaseConnectionManager] Ошибка инициализации:', error);
      throw error;
    }
  }

  /**
   * Обновление подключения к БД
   */
  async updateConnection(newConfig) {
    try {
      logger.info('[DatabaseConnectionManager] Обновление подключения к БД...');
      
      // Проверяем, изменились ли настройки
      if (this.currentConfig && this.configsEqual(this.currentConfig, newConfig)) {
        logger.info('[DatabaseConnectionManager] Настройки не изменились, обновление не требуется');
        return;
      }

      // Создаем новое подключение
      const newPool = this.createPool(newConfig);
      
      // Тестируем новое подключение
      await this.testConnection(newPool);
      
      // Закрываем старое подключение
      if (this.currentPool) {
        await this.closePool(this.currentPool);
      }
      
      // Обновляем текущие настройки
      this.currentPool = newPool;
      this.currentConfig = { ...newConfig };
      
      logger.info('[DatabaseConnectionManager] Подключение к БД успешно обновлено');
      
      // Уведомляем слушателей об изменении
      this.notifyConnectionChange();
      
    } catch (error) {
      logger.error('[DatabaseConnectionManager] Ошибка обновления подключения:', error);
      throw error;
    }
  }

  /**
   * Создание пула подключений
   */
  createPool(config) {
    return new Pool({
      host: config.db_host,
      port: config.db_port,
      database: config.db_name,
      user: config.db_user,
      password: config.db_password,
      ssl: false,
      max: 100, // Увеличиваем максимальное количество клиентов (было 10)
      min: 10, // Минимальное количество клиентов для лучшей производительности (было 0)
      idleTimeoutMillis: 180000, // Увеличиваем до 180 сек (было 30)
      connectionTimeoutMillis: 180000, // Увеличиваем таймаут подключения до 180 сек (было 2)
      maxUses: 7500,
      allowExitOnIdle: true,
      maxLifetimeSeconds: 0
    });
  }

  /**
   * Тестирование подключения
   */
  async testConnection(pool) {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      logger.info('[DatabaseConnectionManager] Тест подключения успешен');
    } finally {
      client.release();
    }
  }

  /**
   * Закрытие пула подключений
   */
  async closePool(pool) {
    try {
      await pool.end();
      logger.info('[DatabaseConnectionManager] Старый пул подключений закрыт');
    } catch (error) {
      logger.warn('[DatabaseConnectionManager] Ошибка при закрытии пула:', error);
    }
  }

  /**
   * Получение текущего пула подключений
   */
  getCurrentPool() {
    return this.currentPool;
  }

  /**
   * Получение текущих настроек
   */
  getCurrentConfig() {
    return this.currentConfig;
  }

  /**
   * Сравнение конфигураций
   */
  configsEqual(config1, config2) {
    return (
      config1.db_host === config2.db_host &&
      config1.db_port === config2.db_port &&
      config1.db_name === config2.db_name &&
      config1.db_user === config2.db_user &&
      config1.db_password === config2.db_password
    );
  }

  /**
   * Добавление слушателя изменений подключения
   */
  addConnectionChangeListener(listener) {
    this.connectionListeners.push(listener);
  }

  /**
   * Уведомление слушателей об изменении подключения
   */
  notifyConnectionChange() {
    this.connectionListeners.forEach(listener => {
      try {
        listener(this.currentConfig);
      } catch (error) {
        logger.error('[DatabaseConnectionManager] Ошибка в слушателе:', error);
      }
    });
  }

  /**
   * Принудительное переподключение
   */
  async reconnect() {
    if (this.isReconnecting) {
      logger.warn('[DatabaseConnectionManager] Переподключение уже выполняется');
      return;
    }

    this.isReconnecting = true;
    try {
      if (this.currentConfig) {
        await this.updateConnection(this.currentConfig);
      }
    } finally {
      this.isReconnecting = false;
    }
  }

  /**
   * Получение статуса подключения
   */
  getConnectionStatus() {
    return {
      isConnected: !!this.currentPool,
      config: this.currentConfig,
      isReconnecting: this.isReconnecting,
      listenersCount: this.connectionListeners.length
    };
  }
}

module.exports = new DatabaseConnectionManager();
