const db = require('../db');
const logger = require('../utils/logger');
const { ethers } = require('ethers');
const crypto = require('crypto');
const { processMessage } = require('./ai-assistant'); // Используем AI Assistant

class AuthService {
  constructor() {
    // Инициализация провайдеров для разных сетей
    this.providers = {
      eth: new ethers.JsonRpcProvider(process.env.RPC_URL_ETH),
      polygon: new ethers.JsonRpcProvider(process.env.RPC_URL_POLYGON),
      bsc: new ethers.JsonRpcProvider(process.env.RPC_URL_BSC),
      arbitrum: new ethers.JsonRpcProvider(process.env.RPC_URL_ARBITRUM)
    };

    // Конфигурация токенов для разных сетей
    this.tokenContracts = [
      { address: "0xd95a45fc46a7300e6022885afec3d618d7d3f27c", network: "eth" },     // Ethereum
      { address: "0x1d47f12ffA279BFE59Ab16d56fBb10d89AECdD5D", network: "bsc" },     // Binance Smart Chain
      { address: "0xdce769b847a0a697239777d0b1c7dd33b6012ba0", network: "arbitrum" }, // Arbitrum
      { address: "0x351f59de4fedbdf7601f5592b93db3b9330c1c1d", network: "polygon" }   // Polygon
    ];

    this.MIN_BALANCE = ethers.parseUnits("1000000.0", 18); // 1,000,000 токенов для роли админа
  }

  // Проверка подписи
  async verifySignature(message, signature, address) {
    try {
      logger.info('Verifying signature:', {
        message: message.substring(0, 100) + '...',
        signature: signature.substring(0, 10) + '...',
        address
      });

      if (!message || !signature || !address) {
        logger.error('Missing parameters for signature verification');
        return false;
      }

      try {
        // Восстанавливаем адрес из подписи через ethers
        const recoveredAddress = ethers.verifyMessage(message, signature);
        return ethers.getAddress(recoveredAddress) === ethers.getAddress(address);
      } catch (error) {
        logger.error('Error in signature verification:', error);
        return false;
      }
    } catch (error) {
      logger.error('Error in verifySignature:', error);
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
      for (const contract of this.tokenContracts) {
        try {
          const provider = this.providers[contract.network];
          const tokenContract = new ethers.Contract(
            contract.address,
            ['function balanceOf(address) view returns (uint256)'],
            provider
          );

          const balance = await tokenContract.balanceOf(walletAddress);
          logger.info(`Balance for ${walletAddress} on ${contract.network}: ${balance}`);

          if (balance >= this.MIN_BALANCE) {
            logger.info(`Admin token found on ${contract.network} for ${walletAddress}`);
            return true;
          }
        } catch (error) {
          logger.error(`Error checking balance on ${contract.network}:`, error);
        }
      }

      logger.info(`No admin tokens found for ${walletAddress}`);
      return false;
    } catch (error) {
      logger.error('Error in checkAdminTokens:', error);
      return false;
    }
  }

  /**
   * Проверяет баланс токенов и обновляет роль пользователя
   * @param {string} address - Адрес кошелька
   * @returns {Promise<boolean>} - Является ли пользователь админом
   */
  async checkTokensAndUpdateRole(address) {
    try {
      const isAdmin = await this.checkAdminTokens(address);
      
      // Обновляем роль в базе данных
      await this.updateUserRole(address, isAdmin);

      logger.info(`Updated role for user with address ${address}: admin=${isAdmin}`);
      return isAdmin;
    } catch (error) {
      logger.error('Error in checkTokensAndUpdateRole:', error);
      return false;
    }
  }

  /**
   * Находит или создает пользователя по адресу кошелька
   * @param {string} address - Адрес кошелька
   * @returns {Promise<{userId: number, isAdmin: boolean}>}
   */
  async findOrCreateUser(address) {
    try {
      const existingUser = await db.query(
        `SELECT u.id, 
        (u.role = 'admin') as is_admin
        FROM users u
        JOIN user_identities ui ON u.id = ui.user_id
        WHERE ui.provider = 'wallet' 
        AND LOWER(ui.provider_id) = LOWER($1)`,
        [address]
      );

      if (existingUser.rows.length > 0) {
        return existingUser.rows[0];
      }

      // Если пользователь не найден, создаем нового
      const result = await db.query(
        'INSERT INTO users DEFAULT VALUES RETURNING id',
        []
      );
      const userId = result.rows[0].id;

      // Добавляем wallet identity
      await db.query(
        `INSERT INTO user_identities 
         (user_id, provider, provider_id, identity_type, identity_value) 
         VALUES ($1, 'wallet', $2, 'wallet', $2)`,
        [userId, address.toLowerCase()]
      );

      // Проверяем роль админа
      const isAdmin = await this.checkAdminRole(userId);

      return {
        userId,
        isAdmin
      };
    } catch (error) {
      console.error('Error in findOrCreateUser:', error);
      throw error;
    }
  }

  /**
   * Обновляет роль пользователя и связанные данные
   */
  async updateUserRole(address, isAdmin) {
    try {
      const result = await db.query(`
        UPDATE users u
        SET 
          role = $2::user_role
        FROM user_identities ui
        WHERE u.id = ui.user_id
        AND ui.provider = 'wallet'
        AND LOWER(ui.provider_id) = LOWER($1)
        RETURNING u.id
      `, [
        address,
        isAdmin ? 'admin' : 'user'
      ]);

      if (result.rows.length > 0) {
        logger.info(`Updated role for user ${result.rows[0].id} to ${isAdmin ? 'admin' : 'user'}`);
      }
    } catch (error) {
      logger.error('Error updating user role:', error);
    }
  }

  // Связывание идентификаторов (из identity-linker.js)
  async linkIdentity(userId, type, value) {
    try {
      // Проверяем, не связан ли идентификатор с другим пользователем
      const existingResult = await db.query(
        `SELECT user_id 
         FROM user_identities 
         WHERE identity_type = $1 
         AND LOWER(identity_value) = LOWER($2)`,
        [type, value]
      );

      if (existingResult.rows.length > 0 && existingResult.rows[0].user_id !== userId) {
        throw new Error('Identity already linked to another user');
      }

      // Добавляем или обновляем идентификатор
      await db.query(
        `INSERT INTO user_identities 
         (user_id, identity_type, identity_value, verified, created_at)
         VALUES ($1, $2, $3, true, NOW())
         ON CONFLICT (identity_type, identity_value) 
         DO UPDATE SET user_id = $1, verified = true`,
        [userId, type, value]
      );

      // Если это кошелек, проверяем права админа
      if (type === 'wallet') {
        await this.checkTokensAndUpdateRole(value);
      }

      return true;
    } catch (error) {
      logger.error('Error linking identity:', error);
      throw error;
    }
  }

  // Получение всех идентификаторов пользователя
  async getUserIdentities(userId) {
    try {
      const result = await db.query(
        `SELECT identity_type, identity_value, verified, created_at
         FROM user_identities
         WHERE user_id = $1`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error getting user identities:', error);
      return [];
    }
  }

  // Проверка роли админа
  async isAdmin(userId) {
    try {
      const result = await db.query(
        'SELECT is_admin FROM users WHERE id = $1',
        [userId]
      );
      return result.rows.length > 0 && result.rows[0].is_admin;
    } catch (error) {
      logger.error('Error checking admin status:', error);
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

  async createSession(req, userData) {
    // Сохраняем существующие данные сессии
    const existingData = { ...req.session };
    
    req.session.userId = userData.userId;
    req.session.address = userData.address;
    req.session.isAdmin = userData.isAdmin;
    req.session.authenticated = true;
    req.session.authType = userData.authType;
    
    // Если есть гостевые сообщения в существующей сессии
    if (existingData.guestId) {
      req.session.guestId = existingData.guestId;
      // Связываем сообщения сразу здесь
      await this.linkGuestMessages(req, {
        userId: userData.userId,
        guestId: existingData.guestId
      });
    }

    return new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async linkGuestMessages(req, userData) {
    if (!userData.guestId) return;

    const { rows } = await db.query(
      'SELECT EXISTS(SELECT 1 FROM guest_messages WHERE guest_id = $1)',
      [userData.guestId]
    );
    
    if (rows[0].exists) {
      // Сначала связываем сообщения
      await db.query('SELECT link_guest_messages($1, $2)', 
        [userData.userId, userData.guestId]
      );
      // Только после успешного связывания удаляем guestId
      delete req.session.guestId;
    }
  }

  async checkAdminRole(userId) {
    try {
      // Получаем все идентификаторы пользователя
      const identities = await db.query(
        `SELECT provider, provider_id 
         FROM user_identities 
         WHERE user_id = $1`,
        [userId]
      );

      // Ищем wallet среди идентификаторов
      const wallet = identities.rows.find(i => i.provider === 'wallet');
      if (!wallet) return false;

      // Проверяем баланс токенов
      const hasTokens = await this.checkAdminTokens(wallet.provider_id);
      if (!hasTokens) return false;

      // Обновляем роль пользователя
      await db.query(
        `UPDATE users SET role = 'admin' WHERE id = $1`,
        [userId]
      );

      return true;
    } catch (error) {
      console.error('Error checking admin role:', error);
      return false;
    }
  }

  // Проверка при каждой аутентификации
  async verifyIdentity(type, value) {
    const userId = await this.getUserIdByIdentity(type, value);
    if (!userId) return false;

    // Проверяем роль только если есть связанный кошелек
    await this.checkAdminRole(userId);
    return true;
  }
}

// Создаем и экспортируем единственный экземпляр
const authService = new AuthService();
module.exports = authService;