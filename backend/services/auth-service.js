const db = require('../db');
const logger = require('../utils/logger');
const { ethers } = require('ethers');
const crypto = require('crypto');
const { processMessage } = require('./ai-assistant'); // Используем AI Assistant
const verificationService = require('./verification-service'); // Используем сервис верификации

const ADMIN_CONTRACTS = [
  { address: "0xd95a45fc46a7300e6022885afec3d618d7d3f27c", network: "eth" },
  { address: "0x1d47f12ffA279BFE59Ab16d56fBb10d89AECdD5D", network: "bsc" },
  { address: "0xdce769b847a0a697239777d0b1c7dd33b6012ba0", network: "arbitrum" },
  { address: "0x351f59de4fedbdf7601f5592b93db3b9330c1c1d", network: "polygon" }
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

class AuthService {
  constructor() {
    this.providers = {
      eth: new ethers.JsonRpcProvider(process.env.RPC_URL_ETH),
      polygon: new ethers.JsonRpcProvider(process.env.RPC_URL_POLYGON),
      bsc: new ethers.JsonRpcProvider(process.env.RPC_URL_BSC),
      arbitrum: new ethers.JsonRpcProvider(process.env.RPC_URL_ARBITRUM)
    };
  }

  // Проверка подписи
  async verifySignature(message, signature, address) {
    try {
      if (!message || !signature || !address) return false;
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return ethers.getAddress(recoveredAddress) === ethers.getAddress(address);
    } catch (error) {
      logger.error('Error in signature verification:', error);
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
      // Нормализуем адрес
      address = ethers.getAddress(address);
      
      // Ищем пользователя по адресу в таблице user_identities
      const userResult = await db.query(`
        SELECT u.* FROM users u 
        JOIN user_identities ui ON u.id = ui.user_id 
        WHERE ui.provider = 'wallet' AND ui.provider_id = $1
      `, [address]);
      
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        return { 
          userId: user.id, 
          isAdmin: user.role === 'admin' 
        };
      }
      
      // Если пользователь не найден, создаем нового
      const newUserResult = await db.query(
        'INSERT INTO users (role) VALUES ($1) RETURNING id',
        ['user']
      );
      
      const userId = newUserResult.rows[0].id;
      
      // Добавляем идентификатор кошелька
      await db.query(
        'INSERT INTO user_identities (user_id, provider, provider_id) VALUES ($1, $2, $3)',
        [userId, 'wallet', address]
      );
      
      return { userId, isAdmin: false };
    } catch (error) {
      console.error('Error finding or creating user:', error);
      throw error;
    }
  }

  /**
   * Основной метод проверки роли админа
   * @param {string} address - Адрес кошелька
   * @returns {Promise<boolean>} - Является ли пользователь админом
   */
  async checkAdminRole(address) {
    if (!address) return false;
    
    logger.info(`Checking admin role for address: ${address}`);
    let foundTokens = false;
    const balances = {};
    
    // Создаем массив промисов для параллельной проверки балансов
    const checkPromises = ADMIN_CONTRACTS.map(async (contract) => {
      try {
        const provider = this.providers[contract.network];
        if (!provider) return null;
        
        const tokenContract = new ethers.Contract(
          contract.address,
          ERC20_ABI,
          provider
        );
        
        // Создаем промис с таймаутом
        const balancePromise = tokenContract.balanceOf(address);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        );
        
        // Ждем первый выполненный промис
        const balance = await Promise.race([balancePromise, timeoutPromise]);
        const formattedBalance = ethers.formatUnits(balance, 18);
        balances[contract.network] = formattedBalance;
        
        logger.info(`Token balance on ${contract.network}:`, {
          address,
          contract: contract.address,
          balance: formattedBalance,
          hasTokens: balance > 0
        });

        if (balance > 0) {
          logger.info(`Found admin tokens on ${contract.network}`);
          foundTokens = true;
        }
        
        return { network: contract.network, balance: formattedBalance };
      } catch (error) {
        logger.error(`Error checking balance in ${contract.network}:`, {
          address,
          contract: contract.address,
          error: error.message
        });
        balances[contract.network] = 'Error';
        return null;
      }
    });
    
    // Ждем выполнения всех проверок
    await Promise.all(checkPromises);
    
    if (foundTokens) {
      logger.info(`Admin role summary for ${address}:`, {
        networks: Object.keys(balances).filter(net => balances[net] > 0),
        balances
      });
      logger.info(`Admin role granted for ${address}`);
      return true;
    }
    
    logger.info(`Admin role denied - no tokens found for ${address}`);
    return false;
  }

  /**
   * Получение балансов токенов для адреса
   * @param {string} address - Адрес кошелька
   * @returns {Promise<Object>} - Объект с балансами токенов
   */
  async getTokenBalances(address) {
    if (!address) {
      logger.error('No address provided for getTokenBalances');
      return {
        eth: '0',
        bsc: '0',
        arbitrum: '0',
        polygon: '0'
      };
    }

    const balances = {};
    const timeout = 3000; // 3 секунды таймаут
    
    for (const contract of ADMIN_CONTRACTS) {
      try {
        const provider = this.providers[contract.network];
        if (!provider) {
          logger.error(`No provider for network ${contract.network}`);
          balances[contract.network] = '0';
          continue;
        }

        const tokenContract = new ethers.Contract(
          contract.address,
          ERC20_ABI,
          provider
        );

        // Создаем промис с таймаутом
        const balancePromise = tokenContract.balanceOf(address);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        );

        // Ждем первый выполненный промис
        const balance = await Promise.race([balancePromise, timeoutPromise]);
        const formattedBalance = ethers.formatUnits(balance, 18);
        
        logger.info(`Token balance for ${address} on ${contract.network}:`, {
          contract: contract.address,
          balance: formattedBalance,
          timestamp: new Date().toISOString()
        });

        balances[contract.network] = formattedBalance;
      } catch (error) {
        logger.error(`Error getting balance for ${contract.network}:`, {
          address,
          contract: contract.address,
          error: error.message || 'Unknown error',
          timestamp: new Date().toISOString()
        });
        balances[contract.network] = '0';
      }
    }
    
    logger.info(`Token balances fetched for ${address}:`, {
      ...balances,
      timestamp: new Date().toISOString()
    });
    
    return balances;
  }

  // Создание сессии с проверкой роли
  async createSession(session, { userId, authenticated, authType, guestId, address }) {
    try {
      // Обновляем данные сессии
      session.userId = userId;
      session.authenticated = authenticated;
      session.authType = authType;
      session.guestId = guestId;
      if (address) {
        session.address = address;
      }
      
      // Сохраняем сессию в БД
      const result = await db.query(
        `UPDATE session 
         SET sess = $1 
         WHERE sid = $2`,
        [JSON.stringify({
          userId,
          authenticated,
          authType,
          guestId,
          address,
          cookie: session.cookie
        }), session.id]
      );
      
      return true;
    } catch (error) {
      logger.error('Error creating session:', error);
      return false;
    }
  }

  async getSession(sessionId) {
    try {
      const result = await db.query('SELECT * FROM session WHERE sid = $1', [sessionId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  }

  // Получение связанного кошелька
  async getLinkedWallet(userId) {
    const result = await db.query(
      `SELECT provider_id as address 
       FROM user_identities 
       WHERE user_id = $1 AND provider = 'wallet'`,
      [userId]
    );
    return result.rows[0]?.address;
  }

  /**
   * Проверяет роль пользователя Telegram
   * @param {number} userId - ID пользователя
   * @returns {Promise<string>} - Роль пользователя
   */
  async checkUserRole(userId) {
    try {
      // Проверяем наличие связанного кошелька
      const wallet = await this.getLinkedWallet(userId);
      
      // Если кошелек не привязан, пользователь получает роль user
      // с базовым доступом к чату и истории сообщений
      if (!wallet) {
        logger.info(`No wallet linked for user ${userId}, assigning basic user role`);
        return 'user';
      }
      
      // Если есть кошелек, проверяем админские токены
      const isAdmin = await this.checkAdminRole(wallet);
      logger.info(`Role check for user ${userId} with wallet ${wallet}: ${isAdmin ? 'admin' : 'user'}`);
      return isAdmin ? 'admin' : 'user';
    } catch (error) {
      logger.error('Error checking user role:', error);
      return 'user';
    }
  }

  // Проверка верификации Email
  async checkEmailVerification(code) {
    try {
      // Проверяем код через сервис верификации
      const result = await verificationService.verifyCode(code, 'email', null);
      
      if (!result.success) {
        return { verified: false };
      }
      
      const userId = result.userId;
      const email = result.providerId;
      
      // Проверяем, существует ли пользователь с таким email
      const userResult = await db.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return { verified: false };
      }

      // Проверяем наличие кошелька и определяем роль
      const wallet = await this.getLinkedWallet(userId);
      let role = 'user'; // Базовая роль для доступа к чату
      
      if (wallet) {
        // Если есть кошелек, проверяем баланс токенов
        const isAdmin = await this.checkAdminRole(wallet);
        role = isAdmin ? 'admin' : 'user';
        logger.info(`User ${userId} has wallet ${wallet}, role set to ${role}`);
      } else {
        logger.info(`User ${userId} has no wallet, using basic user role`);
      }
      
      return {
        verified: true,
        userId,
        email,
        role,
        wallet: wallet || null
      };
    } catch (error) {
      logger.error('Error checking email verification:', error);
      return { verified: false };
    }
  }

  /**
   * Проверка Telegram аутентификации
   */
  async verifyTelegramAuth(telegramId, verificationCode) {
    try {
      logger.info(`Verifying Telegram auth for ID: ${telegramId} with code: ${verificationCode}`);
      
      // Находим или создаем пользователя
      const userResult = await db.query(
        `SELECT u.* FROM users u 
         JOIN user_identities ui ON u.id = ui.user_id 
         WHERE ui.provider = 'telegram' AND ui.provider_id = $1`,
        [telegramId]
      );
      
      let userId;
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
        logger.info(`Found existing user ${userId} for Telegram ID ${telegramId}`);
      } else {
        // Создаем нового пользователя с ролью user
        const newUserResult = await db.query(
          'INSERT INTO users (role) VALUES ($1) RETURNING id',
          ['user']
        );
        userId = newUserResult.rows[0].id;
        
        // Добавляем Telegram идентификатор
        await db.query(
          'INSERT INTO user_identities (user_id, provider, provider_id) VALUES ($1, $2, $3)',
          [userId, 'telegram', telegramId]
        );
        logger.info(`Created new user ${userId} for Telegram ID ${telegramId}`);
      }
      
      // Проверяем наличие кошелька и определяем роль
      const wallet = await this.getLinkedWallet(userId);
      let role = 'user'; // Базовая роль для доступа к чату
      
      if (wallet) {
        // Если есть кошелек, проверяем баланс токенов
        const isAdmin = await this.checkAdminRole(wallet);
        role = isAdmin ? 'admin' : 'user';
        logger.info(`User ${userId} has wallet ${wallet}, role set to ${role}`);
      } else {
        logger.info(`User ${userId} has no wallet, using basic user role`);
      }
      
      return {
        success: true,
        userId,
        role,
        telegramId,
        wallet: wallet || null
      };
    } catch (error) {
      logger.error('Error in Telegram auth verification:', error);
      throw error;
    }
  }

  // Добавляем псевдоним функции checkAdminRole для обратной совместимости
  async checkAdminTokens(address) {
    if (!address) return false;
    
    console.log(`Checking admin tokens for address: ${address}`);
    const isAdmin = await this.checkAdminRole(address);
    console.log(`Admin token check result for ${address}: ${isAdmin}`);
    
    // Обновляем роль пользователя в базе данных, если есть админские токены
    if (isAdmin) {
      try {
        // Находим userId по адресу
        const userResult = await db.query(`
          SELECT u.id FROM users u 
          JOIN user_identities ui ON u.id = ui.user_id 
          WHERE ui.provider = 'wallet' AND ui.provider_id = $1`,
          [address.toLowerCase()]
        );
        
        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].id;
          // Обновляем роль пользователя
          await db.query(
            'UPDATE users SET role = $1 WHERE id = $2',
            ['admin', userId]
          );
          console.log(`Updated user ${userId} role to admin based on token holdings`);
        }
      } catch (error) {
        console.error('Error updating user role:', error);
      }
    }
    
    return isAdmin;
  }

  /**
   * Очистка старых гостевых идентификаторов
   * @param {number} userId - ID пользователя
   * @returns {Promise<void>}
   */
  async cleanupGuestIdentities(userId) {
    try {
      // Получаем все идентификаторы пользователя
      const identities = await this.getUserIdentities(userId);
      
      // Фильтруем только гостевые идентификаторы
      const guestIdentities = identities.filter(id => id.identity_type === 'guest');
      
      // Если гостевых идентификаторов больше 3, удаляем старые
      if (guestIdentities.length > 3) {
        // Сортируем по дате создания (новые первые)
        guestIdentities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Оставляем только 3 последних идентификатора
        const identitiesToDelete = guestIdentities.slice(3);
        
        // Удаляем старые идентификаторы
        for (const identity of identitiesToDelete) {
          await db.query(
            'DELETE FROM user_identities WHERE id = $1',
            [identity.id]
          );
          logger.info(`Deleted old guest identity: ${identity.identity_value}`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up guest identities:', error);
    }
  }

  /**
   * Получение всех идентификаторов пользователя
   * @param {number} userId - ID пользователя
   * @returns {Promise<Array>} - Массив идентификаторов
   */
  async getUserIdentities(userId) {
    try {
      const result = await db.query(
        'SELECT * FROM user_identities WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return result.rows;
    } catch (error) {
      logger.error('[getUserIdentities] Error:', error);
      throw error;
    }
  }

  /**
   * Проверка баланса токенов в сети Arbitrum с оптимизированным таймаутом
   * @param {string} address - Адрес кошелька
   * @returns {Promise<Object>} - Результат проверки баланса
   */
  async checkArbitrumBalance(address) {
    const timeout = 2000; // Уменьшаем таймаут до 2 секунд
    try {
      const balance = await Promise.race([
        this.getTokenBalance(address, ADMIN_CONTRACTS.ARBITRUM),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT')), timeout)
        )
      ]);
      return { balance, hasTokens: balance > 0 };
    } catch (error) {
      logger.warn(`[checkArbitrumBalance] Timeout or error for ${address}:`, error);
      return { balance: 0, hasTokens: false, error: error.message };
    }
  }

  /**
   * Обработка гостевых сообщений после аутентификации
   */
  async linkGuestMessagesAfterAuth(userId, currentGuestId, previousGuestId) {
    try {
      logger.info(`[linkGuestMessagesAfterAuth] Starting for user ${userId} with guestId=${currentGuestId}`);
      
      // Проверяем, есть ли идентификатор для обработки
      if (!currentGuestId) {
        logger.debug('[linkGuestMessagesAfterAuth] No guest ID to process');
        return { success: true, message: 'No guest ID to process' };
      }

      // Получаем все гостевые сообщения для этого ID
      const guestMessagesResult = await db.query(
        'SELECT * FROM guest_messages WHERE guest_id = $1 ORDER BY created_at ASC',
        [currentGuestId]
      );

      if (guestMessagesResult.rows.length === 0) {
        logger.info(`[linkGuestMessagesAfterAuth] No messages found for guest ID ${currentGuestId}`);
        return { success: true, message: 'No messages found' };
      }

      const guestMessages = guestMessagesResult.rows;
      logger.info(`[linkGuestMessagesAfterAuth] Found ${guestMessages.length} messages for guest ID ${currentGuestId}`);

      // Создаем одну беседу для всех сообщений этого гостевого ID
      const firstMessage = guestMessages[0];
      const title = firstMessage.content.length > 30 
        ? `${firstMessage.content.substring(0, 30)}...` 
        : firstMessage.content;

      const newConversationResult = await db.query(
        'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
        [userId, title]
      );

      const conversation = newConversationResult.rows[0];
      logger.info(`[linkGuestMessagesAfterAuth] Created conversation ${conversation.id} for user ${userId}`);

      // Переносим все сообщения в новую беседу
      for (const guestMessage of guestMessages) {
        await db.query(
          `INSERT INTO messages 
            (conversation_id, content, sender_type, role, channel, guest_message_id, created_at) 
           VALUES 
            ($1, $2, $3, $4, $5, $6, $7)`,
          [
            conversation.id,
            guestMessage.content,
            guestMessage.is_ai ? 'assistant' : 'user',
            guestMessage.is_ai ? 'assistant' : 'user',
            'web',
            guestMessage.id,
            guestMessage.created_at
          ]
        );
      }

      // Удаляем гостевой идентификатор после успешной привязки
      await db.query(
        'DELETE FROM user_identities WHERE user_id = $1 AND identity_type = $2 AND identity_value = $3',
        [userId, 'guest', currentGuestId]
      );
      logger.info(`[linkGuestMessagesAfterAuth] Deleted guest identity ${currentGuestId}`);

      return {
        success: true,
        result: {
          conversationId: conversation.id,
          message: `Processed ${guestMessages.length} guest messages`,
          success: true
        }
      };
    } catch (error) {
      logger.error('[linkGuestMessagesAfterAuth] Error:', error);
      throw error;
    }
  }
}

// Создаем и экспортируем единственный экземпляр
const authService = new AuthService();
module.exports = authService;