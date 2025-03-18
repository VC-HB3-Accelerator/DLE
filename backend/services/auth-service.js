const db = require('../db');
const logger = require('../utils/logger');
const { ethers } = require('ethers');
const { processMessage } = require('./ai-assistant'); // Используем AI Assistant

// В начале файла auth-service.js
const getProvider = (network) => {
  const primaryUrl = process.env[`RPC_URL_${network.toUpperCase()}`];
  const backupUrls = {
    eth: 'https://eth-mainnet.public.blastapi.io',
    polygon: 'https://polygon-rpc.com',
    bsc: 'https://bsc-dataseed.binance.org',
    arbitrum: 'https://arb1.arbitrum.io/rpc'
  };
  
  try {
    return new ethers.JsonRpcProvider(primaryUrl);
  } catch (error) {
    logger.warn(`Failed to connect to primary URL for ${network}, using backup`);
    return new ethers.JsonRpcProvider(backupUrls[network]);
  }
};

const providers = {
  eth: getProvider('eth'),
  polygon: getProvider('polygon'),
  bsc: getProvider('bsc'),
  arbitrum: getProvider('arbitrum')
};

/**
 * Сервис для работы с аутентификацией и авторизацией
 */
class AuthService {
  /**
   * Проверяет наличие токенов на кошельке и обновляет роль
   * @param {string} walletAddress - Адрес кошелька
   * @returns {Promise<boolean>} - Имеет ли пользователь права администратора
   */
  async checkTokensAndUpdateRole(walletAddress) {
    try {
      // Получаем ID пользователя по адресу кошелька
      const userResult = await db.query(`
        SELECT u.id FROM users u
        JOIN user_identities ui ON u.id = ui.user_id
        WHERE ui.identity_type = 'wallet' AND ui.identity_value = $1
      `, [walletAddress]);
      
      if (userResult.rows.length === 0) {
        logger.warn(`User with wallet ${walletAddress} not found`);
        return false;
      }
      
      const userId = userResult.rows[0].id;
      
      // Проверяем наличие токенов на кошельке
      const isAdmin = await this.checkAdminTokens(walletAddress);
      
      // Обновляем роль в базе данных
      await this.updateUserRole(userId, isAdmin ? 'admin' : 'user');
      
      logger.info(`User ${userId} with address ${walletAddress}: admin=${isAdmin}`);
      
      return isAdmin;
    } catch (error) {
      logger.error(`Error checking tokens: ${error.message}`);
      return false;
    }
  }

  /**
   * Проверяет наличие токенов на кошельке
   * @param {string} walletAddress - Адрес кошелька
   * @returns {Promise<boolean>} - Имеет ли кошелек токены
   */
  async checkAdminTokens(walletAddress) {
    try {
      const tokenContracts = [
        { address: "0xd95a45fc46a7300e6022885afec3d618d7d3f27c", network: "eth" },     // Ethereum
        { address: "0x1d47f12ffA279BFE59Ab16d56fBb10d89AECdD5D", network: "bsc" },     // Binance Smart Chain
        { address: "0xdce769b847a0a697239777d0b1c7dd33b6012ba0", network: "arbitrum" }, // Arbitrum
        { address: "0x351f59de4fedbdf7601f5592b93db3b9330c1c1d", network: "polygon" }   // Polygon
      ];

      const MIN_BALANCE = ethers.parseUnits("1.0", 18); // 1 токен

      for (const contract of tokenContracts) {
        try {
          const provider = providers[contract.network];
          if (!provider) {
            logger.warn(`Provider not found for network: ${contract.network}`);
            continue;
          }

          // Проверка доступности провайдера
          try {
            await provider.getBlockNumber(); // Простой запрос для проверки соединения
          } catch (providerError) {
            logger.warn(`Provider for ${contract.network} is not responding: ${providerError.message}`);
            continue;
          }

          const tokenContract = new ethers.Contract(contract.address, [
            "function balanceOf(address owner) view returns (uint256)"
          ], provider);

          const balance = await tokenContract.balanceOf(walletAddress);
          logger.info(`Balance for ${walletAddress} on ${contract.network}: ${balance.toString()}`);
          
          if (balance >= MIN_BALANCE) {
            logger.info(`Admin token found on ${contract.network} for ${walletAddress}`);
            return true; // Если найден хотя бы один токен, возвращаем true
          }
        } catch (error) {
          logger.error(`Error checking balance on ${contract.network}: ${error.message}`);
        }
      }

      logger.info(`No admin tokens found for ${walletAddress}`);
      return false; // Если не найдено ни одного токена, возвращаем false
    } catch (error) {
      logger.error(`Error in checkAdminTokens: ${error.message}`);
      return false;
    }
  }

  /**
   * Обновляет роль пользователя в базе данных
   * @param {number} userId - ID пользователя
   * @param {string} role - Новая роль ('admin' или 'user')
   * @returns {Promise<boolean>} - Успешно ли обновлена роль
   */
  async updateUserRole(userId, role) {
    try {
      // Получаем ID роли
      const roleResult = await db.query('SELECT id FROM roles WHERE name = $1', [role]);
      
      if (roleResult.rows.length === 0) {
        logger.error(`Role ${role} not found`);
        return false;
      }
      
      const roleId = roleResult.rows[0].id;
      
      // Обновляем роль пользователя
      await db.query('UPDATE users SET role_id = $1 WHERE id = $2', [roleId, userId]);
      
      logger.info(`Updated role for user ${userId} to ${role}`);
      return true;
    } catch (error) {
      logger.error(`Error updating user role: ${error.message}`);
      return false;
    }
  }

  /**
   * Получает все токены доступа
   * @returns {Promise<Array>} - Список токенов доступа
   */
  async getAllTokens() {
    try {
      const result = await db.query(`
        SELECT * FROM access_tokens
        ORDER BY created_at DESC
      `);
      
      return result.rows.map(token => ({
        id: token.id,
        walletAddress: token.wallet_address,
        role: token.role,
        createdAt: token.created_at,
        expiresAt: token.expires_at,
      }));
    } catch (error) {
      logger.error(`Error getting all tokens: ${error.message}`);
      return [];
    }
  }

  /**
   * Получает ID пользователя по идентификатору
   * @param {string} identityType - Тип идентификатора ('wallet', 'email', 'telegram')
   * @param {string} identityValue - Значение идентификатора
   * @returns {Promise<number|null>} - ID пользователя или null, если пользователь не найден
   */
  async getUserIdByIdentity(identityType, identityValue) {
    try {
      // Нормализуем значение идентификатора
      const normalizedValue = identityType === 'wallet' 
        ? identityValue.toLowerCase() 
        : identityValue;
      
      // Получаем ID пользователя
      const result = await db.query(`
        SELECT u.id FROM users u
        JOIN user_identities ui ON u.id = ui.user_id
        WHERE ui.identity_type = $1 AND LOWER(ui.identity_value) = LOWER($2)
      `, [identityType, normalizedValue]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0].id;
    } catch (error) {
      logger.error(`Ошибка при получении ID пользователя по идентификатору: ${error.message}`);
      return null;
    }
  }

  /**
   * Получает все идентификаторы пользователя
   * @param {number} userId - ID пользователя
   * @returns {Promise<Array>} - Список идентификаторов
   */
  async getAllUserIdentities(userId) {
    try {
      const result = await db.query(`
        SELECT identity_type, identity_value, verified, created_at
        FROM user_identities
        WHERE user_id = $1
      `, [userId]);
      
      return result.rows;
    } catch (error) {
      logger.error(`Error getting user identities: ${error.message}`);
      return [];
    }
  }

  /**
   * Проверяет, является ли пользователь администратором
   * @param {number} userId - ID пользователя
   * @returns {Promise<boolean>} - Является ли пользователь администратором
   */
  async isAdmin(userId) {
    try {
      const result = await db.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
      
      if (result.rows.length === 0) {
        return false;
      }
      
      return result.rows[0].is_admin;
    } catch (error) {
      logger.error(`Error checking admin status: ${error.message}`);
      return false;
    }
  }

  /**
   * Обрабатывает гостевые сообщения после аутентификации
   */
  async processGuestMessages(userId, guestId) {
    try {
      logger.info(`Processing guest messages for user ${userId} with guestId ${guestId}`);

      // Сначала обновляем user_id для всех бесед с гостевыми сообщениями
      await db.query(
        `UPDATE conversations c
         SET user_id = $1
         WHERE id IN (
           SELECT DISTINCT conversation_id
           FROM messages m
           WHERE m.metadata->>'guest_id' = $2
         )`,
        [userId, guestId]
      );

      // Получаем все гостевые сообщения без ответов
      const guestMessages = await db.query(
        `SELECT m.id, m.content, m.conversation_id, m.metadata, m.created_at
         FROM messages m
         WHERE m.metadata->>'guest_id' = $1
         AND NOT EXISTS (
           SELECT 1 FROM messages 
           WHERE conversation_id = m.conversation_id 
           AND sender_type = 'assistant'
         )
         ORDER BY m.created_at ASC`,
        [guestId]
      );

      logger.info(`Found ${guestMessages.rows.length} unprocessed guest messages`);

      // Обрабатываем каждое гостевое сообщение
      for (const msg of guestMessages.rows) {
        logger.info(`Processing guest message ${msg.id}: ${msg.content}`);
        
        // Получаем язык из метаданных
        const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
        const language = metadata?.language || 'ru';

        // Используем AI Assistant для обработки сообщения
        const aiResponse = await processMessage(userId, msg.content, language);

        // Сохраняем ответ AI в ту же беседу
        await db.query(
          `INSERT INTO messages 
           (conversation_id, sender_type, content, channel, created_at)
           VALUES ($1, 'assistant', $2, 'chat', NOW())`,
          [msg.conversation_id, aiResponse]
        );

        logger.info(`Saved AI response for message ${msg.id}`);
      }

      // Обновляем метаданные сообщений, чтобы показать, что они обработаны
      await db.query(
        `UPDATE messages m
         SET metadata = jsonb_set(
           CASE 
             WHEN m.metadata IS NULL THEN '{}'::jsonb
             ELSE m.metadata::jsonb
           END,
           '{processed}',
           'true'
         )
         WHERE m.metadata->>'guest_id' = $1`,
        [guestId]
      );

      logger.info(`Successfully processed all guest messages for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error processing guest messages:', error);
      return false;
    }
  }

  async disconnect() {
    try {
      // Очищаем состояние аутентификации
      this.isAuthenticated = false;
      this.userId = null;
      this.address = null;
      this.isAdmin = false;
      this.authType = null;

      // Очищаем сессию
      localStorage.removeItem('auth');
      
      // Очищаем guestId
      localStorage.removeItem('guestId');

      return true;
    } catch (error) {
      logger.error('Error during disconnect:', error);
      return false;
    }
  }
}

module.exports = new AuthService();