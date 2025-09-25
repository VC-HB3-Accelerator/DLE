/**
 * Сервис для работы с параметрами деплоя DLE
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');
const encryptedDb = require('./encryptedDatabaseService');

class DeployParamsService {
  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || 'dapp_user',
      host: process.env.DB_HOST || 'dapp-postgres',
      database: process.env.DB_NAME || 'dapp_db',
      password: process.env.DB_PASSWORD || 'dapp_password',
      port: process.env.DB_PORT || 5432,
    });
    // Используем глобальный экземпляр encryptedDb
  }

  /**
   * Сохраняет параметры деплоя в базу данных
   * @param {string} deploymentId - Идентификатор деплоя
   * @param {Object} params - Параметры деплоя
   * @param {string} status - Статус деплоя
   * @returns {Promise<Object>} - Сохраненные параметры
   */
  async saveDeployParams(deploymentId, params, status = 'pending') {
    try {
      logger.info(`💾 Сохранение параметров деплоя в БД: ${deploymentId}`);
      
      const dataToSave = {
        deployment_id: deploymentId,
        name: params.name,
        symbol: params.symbol,
        location: params.location,
        coordinates: params.coordinates,
        jurisdiction: params.jurisdiction,
        oktmo: params.oktmo,
        okved_codes: JSON.stringify(params.okvedCodes || []),
        kpp: params.kpp,
        quorum_percentage: params.quorumPercentage,
        initial_partners: JSON.stringify(params.initialPartners || []),
        initial_amounts: JSON.stringify(params.initialAmounts || []),
        supported_chain_ids: JSON.stringify(params.supportedChainIds || []),
        current_chain_id: params.currentChainId,
        logo_uri: params.logoURI,
        private_key: params.privateKey, // Будет автоматически зашифрован
        etherscan_api_key: params.etherscanApiKey,
        auto_verify_after_deploy: params.autoVerifyAfterDeploy || false,
        create2_salt: params.CREATE2_SALT,
        rpc_urls: JSON.stringify(params.rpcUrls ? (Array.isArray(params.rpcUrls) ? params.rpcUrls : Object.values(params.rpcUrls)) : []),
        initializer: params.initializer,
        dle_address: params.dleAddress,
        modules_to_deploy: JSON.stringify(params.modulesToDeploy || []),
        deployment_status: status
      };

      // Используем encryptedDb для автоматического шифрования
      // Проверяем, существует ли уже запись с таким deployment_id
      const existing = await this.getDeployParams(deploymentId);
      const result = existing 
        ? await encryptedDb.saveData('deploy_params', dataToSave, { deployment_id: deploymentId })
        : await encryptedDb.saveData('deploy_params', dataToSave);
      
      logger.info(`✅ Параметры деплоя сохранены в БД (с шифрованием): ${deploymentId}`);
      
      return result;
    } catch (error) {
      logger.error(`❌ Ошибка при сохранении параметров деплоя: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает параметры деплоя по идентификатору
   * @param {string} deploymentId - Идентификатор деплоя
   * @returns {Promise<Object|null>} - Параметры деплоя или null
   */
  async getDeployParams(deploymentId) {
    try {
      logger.info(`📖 Получение параметров деплоя из БД: ${deploymentId}`);
      
      // Используем encryptedDb для автоматического расшифрования
      const result = await encryptedDb.getData('deploy_params', {
        deployment_id: deploymentId
      });
      
      if (!result || result.length === 0) {
        logger.warn(`⚠️ Параметры деплоя не найдены: ${deploymentId}`);
        return null;
      }

      const params = result[0];
      
      // PostgreSQL автоматически преобразует JSONB в объекты JavaScript
      return {
        ...params,
        okvedCodes: params.okved_codes || [],
        initialPartners: params.initial_partners || [],
        initialAmounts: params.initial_amounts || [],
        supportedChainIds: params.supported_chain_ids || [],
        rpcUrls: params.rpc_urls || [],
        modulesToDeploy: params.modules_to_deploy || [],
        CREATE2_SALT: params.create2_salt,
        create2_salt: params.create2_salt, // Дублируем для совместимости
        logoURI: params.logo_uri,
        privateKey: params.private_key, // Автоматически расшифрован
        etherscanApiKey: params.etherscan_api_key,
        autoVerifyAfterDeploy: params.auto_verify_after_deploy,
        dleAddress: params.dle_address,
        deploymentStatus: params.deployment_status
      };
    } catch (error) {
      logger.error(`❌ Ошибка при получении параметров деплоя: ${error.message}`);
      throw error;
    }
  }

  /**
   * Обновляет статус деплоя
   * @param {string} deploymentId - Идентификатор деплоя
   * @param {string} status - Новый статус
   * @param {string} dleAddress - Адрес задеплоенного контракта
   * @returns {Promise<Object>} - Обновленные параметры
   */
  async updateDeploymentStatus(deploymentId, status, dleAddress = null) {
    try {
      logger.info(`🔄 Обновление статуса деплоя: ${deploymentId} -> ${status}`);
      
      const query = `
        UPDATE deploy_params 
        SET deployment_status = $2, dle_address = $3, updated_at = CURRENT_TIMESTAMP
        WHERE deployment_id = $1
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [deploymentId, status, dleAddress]);
      
      if (result.rows.length === 0) {
        throw new Error(`Параметры деплоя не найдены: ${deploymentId}`);
      }
      
      logger.info(`✅ Статус деплоя обновлен: ${deploymentId} -> ${status}`);
      return result.rows[0];
    } catch (error) {
      logger.error(`❌ Ошибка при обновлении статуса деплоя: ${error.message}`);
      throw error;
    }
  }

  /**
   * Получает последние параметры деплоя
   * @param {number} limit - Количество записей
   * @returns {Promise<Array>} - Список параметров деплоя
   */
  async getLatestDeployParams(limit = 10) {
    try {
      logger.info(`📋 Получение последних параметров деплоя (лимит: ${limit})`);
      
      // Используем encryptedDb для автоматического расшифрования
      const result = await encryptedDb.getData('deploy_params', {}, limit, 'created_at DESC');
      
      // PostgreSQL автоматически преобразует JSONB в объекты JavaScript
      return result.map(row => ({
        ...row,
        okvedCodes: row.okved_codes || [],
        initialPartners: row.initial_partners || [],
        initialAmounts: row.initial_amounts || [],
        supportedChainIds: row.supported_chain_ids || [],
        rpcUrls: row.rpc_urls || [],
        modulesToDeploy: row.modules_to_deploy || [],
        CREATE2_SALT: row.create2_salt,
        create2_salt: row.create2_salt, // Дублируем для совместимости
        logoURI: row.logo_uri,
        privateKey: row.private_key, // Автоматически расшифрован
        etherscanApiKey: row.etherscan_api_key,
        autoVerifyAfterDeploy: row.auto_verify_after_deploy,
        dleAddress: row.dle_address,
        deploymentStatus: row.deployment_status
      }));
    } catch (error) {
      logger.error(`❌ Ошибка при получении последних параметров деплоя: ${error.message}`);
      throw error;
    }
  }

  /**
   * Удаляет параметры деплоя по deployment_id (только для отладки)
   * @param {string} deploymentId - Идентификатор деплоя
   * @returns {Promise<boolean>} - Результат удаления
   */
  async deleteDeployParams(deploymentId) {
    try {
      logger.info(`🗑️ Удаление параметров деплоя: ${deploymentId}`);
      
      const query = 'DELETE FROM deploy_params WHERE deployment_id = $1';
      const result = await this.pool.query(query, [deploymentId]);
      
      const deleted = result.rowCount > 0;
      if (deleted) {
        logger.info(`✅ Параметры деплоя удалены: ${deploymentId}`);
      } else {
        logger.warn(`⚠️ Параметры деплоя не найдены: ${deploymentId}`);
      }
      
      return deleted;
    } catch (error) {
      logger.error(`❌ Ошибка при удалении параметров деплоя: ${error.message}`);
      throw error;
    }
  }

  /**
   * Закрывает соединение с базой данных
   */
  async close() {
    try {
      await this.pool.end();
      logger.info('🔌 Соединение с базой данных закрыто');
    } catch (error) {
      logger.error(`❌ Ошибка при закрытии соединения с БД: ${error.message}`);
    }
  }
}

module.exports = DeployParamsService;
