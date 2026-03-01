/**
 * Сервис для работы с параметрами деплоя DLE
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
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
      max: 100, // Увеличиваем максимальное количество клиентов
      min: 10, // Минимальное количество клиентов
      idleTimeoutMillis: 180000, // Время жизни неактивного клиента (180 сек)
      connectionTimeoutMillis: 180000, // Таймаут подключения (180 сек)
      maxUses: 7500,
      allowExitOnIdle: true,
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
        okved_codes: JSON.stringify(params.okved_codes || []),
        kpp: params.kpp,
        quorum_percentage: params.quorum_percentage,
        initial_partners: JSON.stringify(params.initial_partners || []),
        // initialAmounts в человекочитаемом формате, умножение на 1e18 происходит при деплое
        initial_amounts: JSON.stringify(params.initial_amounts || []),
        supported_chain_ids: JSON.stringify(params.supported_chain_ids || []),
        current_chain_id: params.current_chain_id || 1, // По умолчанию Ethereum
        logo_uri: params.logo_uri,
        private_key: params.private_key, // Будет автоматически зашифрован
        etherscan_api_key: params.etherscan_api_key,
        auto_verify_after_deploy: params.auto_verify_after_deploy || false,
        create2_salt: params.create2_salt,
        rpc_urls: JSON.stringify(params.rpc_urls ? (Array.isArray(params.rpc_urls) ? params.rpc_urls : Object.values(params.rpc_urls)) : []),
        initializer: params.initializer,
        dle_address: params.dle_address,
        modules_to_deploy: JSON.stringify(params.modules_to_deploy || []),
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
        logger.warn(`🔍 Тип deploymentId: ${typeof deploymentId}`);
        logger.warn(`🔍 Значение deploymentId: "${deploymentId}"`);
        
        // Попробуем найти все записи для отладки
        const allRecords = await encryptedDb.getData('deploy_params', {});
        logger.warn(`🔍 Всего записей в deploy_params: ${allRecords?.length || 0}`);
        if (allRecords && allRecords.length > 0) {
          logger.warn(`🔍 Последние deployment_id: ${allRecords.map(r => r.deployment_id).slice(-3).join(', ')}`);
        }
        
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
   * Получает параметры деплоя по адресу DLE
   * @param {string} dleAddress - Адрес DLE контракта
   * @returns {Promise<Object|null>} - Параметры деплоя или null
   */
  async getDeployParamsByDleAddress(dleAddress) {
    try {
      logger.info(`📖 Поиск параметров деплоя по адресу DLE: ${dleAddress}`);
      
      // Используем encryptedDb для поиска по адресу DLE
      const result = await encryptedDb.getData('deploy_params', {
        dle_address: dleAddress
      });
      
      if (!result || result.length === 0) {
        logger.warn(`⚠️ Параметры деплоя не найдены для адреса: ${dleAddress}`);
        return null;
      }

      // Возвращаем первый найденный результат
      return result[0];
    } catch (error) {
      logger.error(`❌ Ошибка при поиске параметров деплоя по адресу: ${error.message}`);
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
  async updateDeploymentStatus(deploymentId, status, result = null) {
    try {
      logger.info(`🔄 Обновление статуса деплоя: ${deploymentId} -> ${status}`);
      
      // Подготавливаем данные для обновления
      let dleAddress = null;
      let deployResult = null;
      
      if (result) {
        logger.info(`🔍 [DEBUG] updateDeploymentStatus получил result:`, JSON.stringify(result, null, 2));
        
         // Извлекаем адреса из результата деплоя
         if (result.data && result.data.networks && result.data.networks.length > 0) {
           // Берем первый адрес для обратной совместимости
           dleAddress = result.data.networks[0].address;
           logger.info(`✅ [DEBUG] Найден адрес в result.data.networks[0].address: ${dleAddress}`);
         } else if (result.networks && result.networks.length > 0) {
           // Берем первый адрес для обратной совместимости
           dleAddress = result.networks[0].address;
           logger.info(`✅ [DEBUG] Найден адрес в result.networks[0].address: ${dleAddress}`);
         } else if (result.output) {
           // Ищем адрес в тексте output - сначала пробуем найти JSON массив с адресами
           const jsonArrayMatch = result.output.match(/\[[\s\S]*?"address":\s*"(0x[a-fA-F0-9]{40})"[\s\S]*?\]/);
           if (jsonArrayMatch) {
             dleAddress = jsonArrayMatch[1];
             logger.info(`✅ [DEBUG] Найден адрес в JSON массиве result.output: ${dleAddress}`);
           } else {
             // Fallback: ищем адрес в тексте output (формат: "📍 Адрес: 0x...")
             const addressMatch = result.output.match(/📍 Адрес: (0x[a-fA-F0-9]{40})/);
             if (addressMatch) {
               dleAddress = addressMatch[1];
               logger.info(`✅ [DEBUG] Найден адрес в тексте result.output: ${dleAddress}`);
             }
           }
         } else {
           logger.warn(`⚠️ [DEBUG] Адрес не найден в результате деплоя`);
         }
        
        // Сохраняем полный результат деплоя (включая все адреса всех сетей)
        deployResult = JSON.stringify(result);
      }
      
      const query = `
        UPDATE deploy_params 
        SET deployment_status = $2, dle_address = $3, deploy_result = $4, updated_at = CURRENT_TIMESTAMP
        WHERE deployment_id = $1
        RETURNING *
      `;
      
      const queryResult = await this.pool.query(query, [deploymentId, status, dleAddress, deployResult]);
      
      if (queryResult.rows.length === 0) {
        throw new Error(`Параметры деплоя не найдены: ${deploymentId}`);
      }
      
      logger.info(`✅ Статус деплоя обновлен: ${deploymentId} -> ${status}`);
      if (dleAddress) {
        logger.info(`📍 Адрес DLE контракта: ${dleAddress}`);
      }
      return queryResult.rows[0];
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
   * Получить контракты по chainId
   */
  async getContractsByChainId(chainId) {
    try {
      console.log(`[DeployParamsService] Ищем контракты с current_chain_id: ${chainId}`);
      
      const query = `
        SELECT 
          deployment_id,
          name,
          dle_address,
          current_chain_id,
          supported_chain_ids,
          created_at
        FROM deploy_params 
        WHERE current_chain_id = $1 AND dle_address IS NOT NULL
        ORDER BY created_at DESC
      `;
      
      const result = await this.pool.query(query, [chainId]);
      
      console.log(`[DeployParamsService] Найдено контрактов: ${result.rows.length}`);
      
      return result.rows.map(row => ({
        deploymentId: row.deployment_id,
        name: row.name,
        dleAddress: row.dle_address,
        currentChainId: row.current_chain_id,
        supportedChainIds: row.supported_chain_ids,
        createdAt: row.created_at
      }));
      
    } catch (error) {
      console.error(`[DeployParamsService] Ошибка поиска контрактов по chainId:`, error);
      throw error;
    }
  }

  /**
   * Получает все деплои
   * @param {number} limit - Количество записей
   * @returns {Promise<Array>} - Список всех деплоев
   */
  async getAllDeployments(limit = 50) {
    try {
      logger.info(`📋 Получение всех деплоев (лимит: ${limit})`);
      
      // Используем encryptedDb для автоматического расшифрования
      const result = await encryptedDb.getData('deploy_params', {}, limit, 'created_at DESC');
      
      return result.map(row => {
        // Парсим deployResult для извлечения адресов всех сетей
        let deployedNetworks = [];
        console.log(`🔍 [DEBUG] Processing deployment ${row.deployment_id}, deploy_result exists:`, !!row.deploy_result);
        console.log(`🔍 [DEBUG] deploy_result type:`, typeof row.deploy_result);
        if (row.deploy_result) {
          try {
            const deployResult = typeof row.deploy_result === 'string' 
              ? JSON.parse(row.deploy_result) 
              : row.deploy_result;
            
            console.log(`🔍 [DEBUG] deployResult keys:`, Object.keys(deployResult));
            console.log(`🔍 [DEBUG] deployResult.output exists:`, !!deployResult.output);
            console.log(`🔍 [DEBUG] deployResult.data exists:`, !!deployResult.data);
            console.log(`🔍 [DEBUG] deployResult.networks exists:`, !!deployResult.networks);
            if (deployResult.error) {
              console.log(`🔍 [DEBUG] deployResult.error:`, deployResult.error);
            }
            
            // Функция для получения правильного названия сети
            const getNetworkName = (chainId) => {
              const networkNames = {
                1: 'Ethereum Mainnet',
                11155111: 'Sepolia',
                17000: 'Holesky',
                421614: 'Arbitrum Sepolia',
                84532: 'Base Sepolia',
                137: 'Polygon',
                56: 'BSC',
                42161: 'Arbitrum One'
              };
              return networkNames[chainId] || `Chain ${chainId}`;
            };

            // Функция для загрузки ABI для конкретной сети
            const loadABIForNetwork = (chainId) => {
              try {
                const fs = require('fs');
                const path = require('path');
                const abiPath = path.join(__dirname, '../../../frontend/src/utils/dle-abi.js');
                
                if (fs.existsSync(abiPath)) {
                  const abiContent = fs.readFileSync(abiPath, 'utf8');
                  // Используем более простое регулярное выражение
                  const abiMatch = abiContent.match(/export const DLE_ABI = (\[[\s\S]*?\]);/);
                  if (abiMatch) {
                    // Попробуем исправить JSON, заменив проблемные символы
                    let abiText = abiMatch[1];
                    // Убираем лишние запятые в конце
                    abiText = abiText.replace(/,(\s*[}\]])/g, '$1');
                    try {
                      return JSON.parse(abiText);
                    } catch (parseError) {
                      console.warn(`⚠️ Ошибка парсинга ABI JSON для сети ${chainId}:`, parseError.message);
                      // Возвращаем пустой массив как fallback
                      return [];
                    }
                  }
                }
              } catch (abiError) {
                console.warn(`⚠️ Ошибка загрузки ABI для сети ${chainId}:`, abiError.message);
              }
              return null;
            };
            
            // Извлекаем адреса из результата деплоя
            if (deployResult.data && deployResult.data.networks) {
              deployedNetworks = deployResult.data.networks.map(network => ({
                chainId: network.chainId,
                address: network.address,
                networkName: network.networkName || getNetworkName(network.chainId),
                abi: loadABIForNetwork(network.chainId) // ABI для каждой сети отдельно
              }));
            } else if (deployResult.networks) {
              deployedNetworks = deployResult.networks.map(network => ({
                chainId: network.chainId,
                address: network.address,
                networkName: network.networkName || getNetworkName(network.chainId),
                abi: loadABIForNetwork(network.chainId) // ABI для каждой сети отдельно
              }));
            } else if (deployResult.output) {
              console.log(`🔍 [DEBUG] Processing deployResult.output`);
              // Извлекаем адреса из текста output
              const output = deployResult.output;
              const addressMatches = output.match(/📍 Адрес: (0x[a-fA-F0-9]{40})/g);
              const chainIdMatches = output.match(/chainId: (\d+)/g);
              
              // Альтернативный поиск по названиям сетей
              const networkMatches = output.match(/🔍 Верификация в сети (\w+) \(chainId: (\d+)\)/g);
              
              console.log(`🔍 [DEBUG] addressMatches:`, addressMatches);
              console.log(`🔍 [DEBUG] chainIdMatches:`, chainIdMatches);
              console.log(`🔍 [DEBUG] networkMatches:`, networkMatches);
              
              if (networkMatches && networkMatches.length > 0) {
                // Используем networkMatches для более точного парсинга
                deployedNetworks = networkMatches.map((match) => {
                  const [, networkName, chainIdStr] = match.match(/🔍 Верификация в сети (\w+) \(chainId: (\d+)\)/);
                  const chainId = parseInt(chainIdStr);
                  
                  // Ищем адрес для этой сети в output
                  const addressRegex = new RegExp(`🔍 Верификация в сети ${networkName} \\(chainId: ${chainId}\\)\\n📍 Адрес: (0x[a-fA-F0-9]{40})`);
                  const addressMatch = output.match(addressRegex);
                  const address = addressMatch ? addressMatch[1] : '0x0000000000000000000000000000000000000000';
                  
                  return {
                    chainId: chainId,
                    address: address,
                    networkName: getNetworkName(chainId),
                    abi: loadABIForNetwork(chainId)
                  };
                });
                console.log(`🔍 [DEBUG] deployedNetworks created from networkMatches:`, deployedNetworks);
              } else if (addressMatches && chainIdMatches) {
                deployedNetworks = addressMatches.map((match, index) => {
                  const address = match.match(/📍 Адрес: (0x[a-fA-F0-9]{40})/)[1];
                  const chainId = chainIdMatches[index] ? parseInt(chainIdMatches[index].match(/chainId: (\d+)/)[1]) : null;
                  
                  return {
                    chainId: chainId,
                    address: address,
                    networkName: chainId ? getNetworkName(chainId) : `Network ${index + 1}`,
                    abi: loadABIForNetwork(chainId) // ABI для каждой сети отдельно
                  };
                });
                console.log(`🔍 [DEBUG] deployedNetworks created:`, deployedNetworks);
              } else {
                console.log(`🔍 [DEBUG] No matches found - addressMatches:`, !!addressMatches, 'chainIdMatches:', !!chainIdMatches);
              }
            }
          } catch (error) {
            logger.warn(`⚠️ Ошибка парсинга deployResult для ${row.deployment_id}: ${error.message}`);
          }
        }
        
        return {
          deploymentId: row.deployment_id,
          name: row.name,
          symbol: row.symbol,
          location: row.location,
          coordinates: row.coordinates,
          jurisdiction: row.jurisdiction,
          oktmo: row.oktmo,
          okvedCodes: row.okved_codes || [],
          kpp: row.kpp,
          quorumPercentage: row.quorum_percentage,
          initialPartners: row.initial_partners || [],
          initialAmounts: row.initial_amounts || [],
          supportedChainIds: row.supported_chain_ids || [],
          currentChainId: row.current_chain_id,
          logoURI: row.logo_uri,
          etherscanApiKey: row.etherscan_api_key,
          autoVerifyAfterDeploy: row.auto_verify_after_deploy,
          create2Salt: row.create2_salt,
          rpcUrls: row.rpc_urls || [],
          initializer: row.initializer,
          dleAddress: row.dle_address,
          modulesToDeploy: row.modules_to_deploy || [],
          deploymentStatus: row.deployment_status,
          deployResult: row.deploy_result,
          deployedNetworks: deployedNetworks, // Добавляем адреса всех сетей
          networks: deployedNetworks, // Добавляем networks для фронтенда (алиас deployedNetworks)
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      });
      
    } catch (error) {
      logger.error(`❌ Ошибка при получении всех деплоев: ${error.message}`);
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
