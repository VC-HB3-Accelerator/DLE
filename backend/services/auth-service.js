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
const db = require('../db');
const logger = require('../utils/logger');
const { ethers } = require('ethers');
const crypto = require('crypto');
const { processMessage } = require('./ai-assistant'); // Используем AI Assistant
const verificationService = require('./verification-service'); // Используем сервис верификации
const identityService = require('./identity-service'); // <-- ДОБАВЛЕН ИМПОРТ
const authTokenService = require('./authTokenService');
const rpcProviderService = require('./rpcProviderService');
const tokenBalanceService = require('./tokenBalanceService');
const { getLinkedWallet } = require('./wallet-service');
const { checkAdminRole } = require('./admin-role');
const { broadcastContactsUpdate } = require('../wsHub');

const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)'];

class AuthService {
  constructor() {}

  // Проверка подписи
  async verifySignature(message, signature, address) {
    try {
      if (!message || !signature || !address) return false;

      // Нормализуем входящий адрес
      const normalizedAddress = ethers.getAddress(address);

      // Восстанавливаем адрес из подписи
      const recoveredAddress = ethers.verifyMessage(message, signature);

      // Логируем для отладки
      logger.info(`[verifySignature] Message: ${message}`);
      logger.info(`[verifySignature] Signature: ${signature}`);
      logger.info(`[verifySignature] Expected address: ${normalizedAddress}`);
      logger.info(`[verifySignature] Recovered address: ${recoveredAddress}`);
      logger.info(`[verifySignature] Addresses match: ${ethers.getAddress(recoveredAddress) === normalizedAddress}`);

      // Сравниваем нормализованные адреса
      return ethers.getAddress(recoveredAddress) === normalizedAddress;
    } catch (error) {
      logger.error('Error in signature verification:', error);
      return false;
    }
  }

  /**
   * Находит или создает пользователя по адресу кошелька
   * @param {string} address - Адрес кошелька
   * @param {boolean} isAdmin - Предварительно проверенный статус админа
   * @returns {Promise<{userId: number, isAdmin: boolean}>}
   */
  async findOrCreateUser(address, isAdmin = null) {
    try {
      // Нормализуем адрес - всегда приводим к нижнему регистру
      const normalizedAddress = ethers.getAddress(address).toLowerCase();

      // Ищем пользователя по адресу в таблице user_identities
      const identities = await encryptedDb.getData('user_identities', {
        provider: 'wallet',
        provider_id: normalizedAddress
      }, 1);

      if (identities.length > 0) {
        const user = await encryptedDb.getData('users', { id: identities[0].user_id }, 1);
        if (user.length === 0) {
          throw new Error('User not found');
        }
        const userData = user[0];

        // Используем предварительно проверенный статус админа или проверяем заново
        const adminStatus = isAdmin !== null ? isAdmin : await checkAdminRole(normalizedAddress);

        // Если статус админа изменился, обновляем роль в базе данных
        if (userData.role === 'admin' && !adminStatus) {
          await db.getQuery()('UPDATE users SET role = $1 WHERE id = $2', ['user', userData.id]);
          logger.info(`Updated user ${userData.id} role to user (admin tokens no longer present)`);
          return { userId: userData.id, isAdmin: false };
        } else if (userData.role !== 'admin' && adminStatus) {
          await db.getQuery()('UPDATE users SET role = $1 WHERE id = $2', ['admin', userData.id]);
          logger.info(`Updated user ${userData.id} role to admin (admin tokens found)`);
          return { userId: userData.id, isAdmin: true };
        }

        return {
          userId: userData.id,
          isAdmin: userData.role === 'admin',
        };
      }

      // Если пользователь не найден, создаем нового с правильной ролью
      const adminStatus = isAdmin !== null ? isAdmin : await checkAdminRole(normalizedAddress);
      const initialRole = adminStatus ? 'admin' : 'user';
      
      const newUserResult = await db.getQuery()('INSERT INTO users (role) VALUES ($1) RETURNING id', [initialRole]);
      const userId = newUserResult.rows[0].id;

      // Добавляем идентификатор кошелька (всегда в нижнем регистре)
      await encryptedDb.saveData('user_identities', {
        user_id: userId,
        provider: 'wallet',
        provider_id: normalizedAddress
      });

      logger.info(`New user ${userId} created with role: ${initialRole} for wallet ${normalizedAddress}`);

      broadcastContactsUpdate();

      return { userId, isAdmin: adminStatus };
    } catch (error) {
      logger.error('Error finding or creating user:', error);
      throw error;
    }
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
        ethereum: '0',
        bsc: '0',
        arbitrum: '0',
        polygon: '0',
        sepolia: '0',
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

        // Проверяем доступность провайдера
        try {
          // Проверка доступности сети с таймаутом
          const networkCheckPromise = provider.getNetwork();
          const networkTimeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network check timeout')), timeout)
          );

          await Promise.race([networkCheckPromise, networkTimeoutPromise]);
        } catch (networkError) {
          logger.error(
            `Provider for ${contract.network} is not available: ${networkError.message}`
          );
          balances[contract.network] = '0';
          continue;
        }

        const tokenContract = new ethers.Contract(contract.address, ERC20_ABI, provider);

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
          timestamp: new Date().toISOString(),
        });

        balances[contract.network] = formattedBalance;
      } catch (error) {
        logger.error(`Error getting balance for ${contract.network}:`, {
          address,
          contract: contract.address,
          error: error.message || 'Unknown error',
          timestamp: new Date().toISOString(),
        });
        balances[contract.network] = '0';
      }
    }

    logger.info(`Token balances fetched for ${address}:`, {
      ...balances,
      timestamp: new Date().toISOString(),
    });

    return balances;
  }

  // Создание сессии с проверкой роли
  async createSession(session, { userId, authenticated, authType, guestId, address, isAdmin }) {
    try {
      // Если пользователь аутентифицирован, обрабатываем гостевые сообщения
      if (authenticated && guestId) {
        await this.processAndCleanupGuestData(userId, guestId, session);
      }

      // Обновляем данные сессии
      session.userId = userId;
      session.authenticated = authenticated;
      session.authType = authType;
      session.isAdmin = isAdmin || false;

      // Сохраняем адрес кошелька если есть
      if (address) {
        session.address = address;
      }

      // Сохраняем сессию в БД
      const result = await db.getQuery()(
        `UPDATE session 
         SET sess = $1 
         WHERE sid = $2`,
        [
          JSON.stringify({
            userId,
            authenticated,
            authType,
            address,
            isAdmin: isAdmin || false,
            cookie: session.cookie,
          }),
          session.id,
        ]
      );

      return true;
    } catch (error) {
      logger.error('Error creating session:', error);
      return false;
    }
  }

  /**
   * Обработка и очистка гостевых данных после авторизации
   * @param {number} userId - ID пользователя
   * @param {string} guestId - Гостевой ID
   * @param {Object} session - Объект сессии
   */
  async processAndCleanupGuestData(userId, guestId, session) {
    try {
      // Обрабатываем гостевые сообщения
      const guestMessageService = require('./guestMessageService');
      await guestMessageService.processGuestMessages(userId, guestId);

      // Очищаем гостевой ID из сессии
      delete session.guestId;
      if (session.previousGuestId) {
        delete session.previousGuestId;
      }

      logger.info(`Cleaned up guest data for user ${userId}, guest ID ${guestId}`);
    } catch (error) {
      logger.error('Error processing and cleaning up guest data:', error);
      throw error;
    }
  }

  async getSession(sessionId) {
    try {
      const result = await db.getQuery()('SELECT * FROM session WHERE sid = $1', [sessionId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  }

  /**
   * Проверяет роль пользователя Telegram
   * @param {number} userId - ID пользователя
   * @returns {Promise<string>} - Роль пользователя
   */
  async checkUserRole(userId) {
    try {
      // Проверяем наличие связанного кошелька
      const wallet = await getLinkedWallet(userId);

      // Если кошелек не привязан, пользователь получает роль user
      // с базовым доступом к чату и истории сообщений
      if (!wallet) {
        logger.info(`No wallet linked for user ${userId}, assigning basic user role`);
        return 'user';
      }

      // Если есть кошелек, проверяем админские токены
      const isAdmin = await checkAdminRole(wallet);
      logger.info(
        `Role check for user ${userId} with wallet ${wallet}: ${isAdmin ? 'admin' : 'user'}`
      );
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
      const userResult = await db.getQuery()('SELECT id, role, created_at, updated_at, is_blocked, blocked_at, preferred_language FROM users WHERE id = $1', [userId]);

      if (userResult.rows.length === 0) {
        return { verified: false };
      }

      // Проверяем наличие кошелька и определяем роль
      const wallet = await getLinkedWallet(userId);
      let role = 'user'; // Базовая роль для доступа к чату

      if (wallet) {
        // Если есть кошелек, проверяем баланс токенов
        const isAdmin = await checkAdminRole(wallet);
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
        wallet: wallet || null,
      };
    } catch (error) {
      logger.error('Error checking email verification:', error);
      return { verified: false };
    }
  }

  /**
   * Проверка Telegram аутентификации
   */
  async verifyTelegramAuth(telegramId, verificationCode, session) {
    try {
      logger.info(`[verifyTelegramAuth] Starting for telegramId: ${telegramId}`);

      let userId;
      let isNewUser = false;

      // Проверяем наличие аутентифицированного пользователя в сессии
      if (session && session.authenticated && session.userId) {
        // Если есть авторизованный пользователь в сессии, связываем Telegram с ним
        userId = session.userId;
        logger.info(
          `[verifyTelegramAuth] Using existing authenticated user ${userId} from session`
        );

        // Связываем Telegram с текущим пользователем
        await this.linkIdentity(userId, 'telegram', telegramId);

        return {
          success: true,
          userId,
          role: session.isAdmin ? 'admin' : 'user',
          telegramId,
          isNewUser: false,
        };
      }

      // Если в сессии нет авторизованного пользователя, проверяем существующие идентификаторы
      // Проверяем, существует ли уже пользователь с таким Telegram ID
      const existingUserResult = await db.getQuery()(
        `SELECT u.*, decrypt_text(ui.provider_encrypted, $2) as provider, decrypt_text(ui.provider_id_encrypted, $2) as provider_id 
         FROM users u 
         JOIN user_identities ui ON u.id = ui.user_id 
         WHERE ui.provider_encrypted = encrypt_text('telegram', $2) AND ui.provider_id_encrypted = encrypt_text($1, $2)`,
        [telegramId, encryptionKey]
      );

      // Если пользователь существует с таким telegramId, используем его
      if (existingUserResult.rows.length > 0) {
        const existingUser = existingUserResult.rows[0];
        userId = existingUser.id;
        logger.info(
          `[verifyTelegramAuth] Found existing user ${userId} for Telegram ID ${telegramId}`
        );
      } else {
        // Создаем нового пользователя для нового telegramId
        const newUserResult = await db.getQuery()('INSERT INTO users (role) VALUES ($1) RETURNING id', [
          'user',
        ]);
        userId = newUserResult.rows[0].id;
        isNewUser = true;

        // Добавляем Telegram идентификатор
        await encryptedDb.saveData('user_identities', {
          user_id: userId,
          provider: 'telegram',
          provider_id: telegramId
        });

        logger.info(
          `[verifyTelegramAuth] Created new user ${userId} for Telegram ID ${telegramId}`
        );
      }

      // Если есть гостевой ID в сессии, сохраняем его для нового пользователя
      if (session.guestId && isNewUser) {
        // Получаем ключ шифрования через унифицированную утилиту
        const encryptionUtils = require('../utils/encryptionUtils');
        const encryptionKey = encryptionUtils.getEncryptionKey();

        await db.getQuery()(
          'INSERT INTO guest_user_mapping (user_id, guest_id_encrypted) VALUES ($1, encrypt_text($2, $3)) ON CONFLICT (guest_id_encrypted) DO UPDATE SET user_id = $1',
          [userId, session.guestId, encryptionKey]
        );
        logger.info(`[verifyTelegramAuth] Saved guest ID ${session.guestId} for user ${userId}`);
      }

      return {
        success: true,
        userId,
        role: 'user',
        telegramId,
        isNewUser,
      };
    } catch (error) {
      logger.error('[verifyTelegramAuth] Error:', error);
      throw error;
    }
  }

  /**
   * Определяет уровень доступа пользователя на основе количества токенов
   * @param {string} address - Адрес кошелька
   * @returns {Promise<{level: string, tokenCount: number, hasAccess: boolean}>}
   */
  async getUserAccessLevel(address) {
    if (!address) {
      return { level: 'user', tokenCount: 0, hasAccess: false };
    }

    logger.info(`Checking access level for address: ${address}`);

    try {
      // Получаем токены из базы данных напрямую (как в checkAdminRole)
      const fs = require('fs');
      const path = require('path');
      let encryptionKey = 'default-key';

      try {
        const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
        if (fs.existsSync(keyPath)) {
          encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
        }
      } catch (keyError) {
        console.error('Error reading encryption key:', keyError);
      }

      // Получаем токены из базы с расшифровкой
      const tokensResult = await db.getQuery()(
        'SELECT id, min_balance, readonly_threshold, editor_threshold, created_at, updated_at, decrypt_text(name_encrypted, $1) as name, decrypt_text(address_encrypted, $1) as address, decrypt_text(network_encrypted, $1) as network FROM auth_tokens',
        [encryptionKey]
      );
      const tokens = tokensResult.rows;

      // Получаем RPC провайдеры
      const rpcProvidersResult = await db.getQuery()(
        'SELECT id, chain_id, created_at, updated_at, decrypt_text(network_id_encrypted, $1) as network_id, decrypt_text(rpc_url_encrypted, $1) as rpc_url FROM rpc_providers',
        [encryptionKey]
      );
      const rpcProviders = rpcProvidersResult.rows;
      
      const rpcMap = {};
      for (const rpc of rpcProviders) {
        rpcMap[rpc.network_id] = rpc.rpc_url;
      }

      // Получаем балансы токенов из блокчейна
      const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)'];
      const tokenBalances = [];

      for (const token of tokens) {
        const rpcUrl = rpcMap[token.network];
        if (!rpcUrl) continue;
        
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
          
          // Получаем баланс с таймаутом
          const balancePromise = tokenContract.balanceOf(address);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 5000) // Увеличиваем таймаут до 5 секунд
          );
          
          const rawBalance = await Promise.race([balancePromise, timeoutPromise]);
          const balance = ethers.formatUnits(rawBalance, 18);
          
          tokenBalances.push({
            network: token.network,
            tokenAddress: token.address,
            tokenName: token.name,
            symbol: '',
            balance,
            minBalance: token.min_balance,
            readonlyThreshold: token.readonly_threshold || 1,
            editorThreshold: token.editor_threshold || 2,
          });
          
          logger.info(`[getUserAccessLevel] Token balance for ${token.name} (${token.address}): ${balance}`);
        } catch (error) {
          logger.error(`[getUserAccessLevel] Error getting balance for ${token.name} (${token.address}):`, error.message);
          // Добавляем токен с нулевым балансом
          tokenBalances.push({
            network: token.network,
            tokenAddress: token.address,
            tokenName: token.name,
            symbol: '',
            balance: '0',
            minBalance: token.min_balance,
            readonlyThreshold: token.readonly_threshold || 1,
            editorThreshold: token.editor_threshold || 2,
          });
        }
      }
      
      if (!tokenBalances || !Array.isArray(tokenBalances)) {
        logger.warn(`No token balances found for address: ${address}`);
        return { level: 'user', tokenCount: 0, hasAccess: false };
      }

      // Подсчитываем сумму токенов с достаточным балансом
      let validTokenCount = 0;
      const validTokens = [];

      for (const token of tokenBalances) {
        const balance = parseFloat(token.balance || '0');
        const minBalance = parseFloat(token.minBalance || '0');
        
        if (balance >= minBalance) {
          validTokenCount += balance; // Суммируем баланс токенов, а не количество сетей
          validTokens.push({
            name: token.name,
            network: token.network,
            balance: balance,
            minBalance: minBalance
          });
        }
      }

      logger.info(`Token validation for ${address}:`, {
        totalTokens: tokenBalances.length,
        validTokens: validTokenCount,
        validTokenDetails: validTokens
      });

      // Определяем уровень доступа на основе настроек токенов
      let accessLevel = 'user';
      let hasAccess = false;
      
      // Получаем настройки порогов из токенов (используем самые низкие требования для максимального доступа)
      let readonlyThreshold = Infinity;
      let editorThreshold = Infinity;
      
      if (tokenBalances.length > 0) {
        // Находим самые низкие пороги среди всех токенов
        for (const token of tokenBalances) {
          const tokenReadonlyThreshold = token.readonlyThreshold || 1;
          const tokenEditorThreshold = token.editorThreshold || 2;
          
          if (tokenReadonlyThreshold < readonlyThreshold) {
            readonlyThreshold = tokenReadonlyThreshold;
          }
          if (tokenEditorThreshold < editorThreshold) {
            editorThreshold = tokenEditorThreshold;
          }
        }
        
        // Если не нашли токены с порогами, используем дефолтные значения
        if (readonlyThreshold === Infinity) readonlyThreshold = 1;
        if (editorThreshold === Infinity) editorThreshold = 2;
        
        logger.info(`[AuthService] Определены пороги доступа: readonly=${readonlyThreshold}, editor=${editorThreshold} (из ${tokenBalances.length} токенов)`);
      } else {
        readonlyThreshold = 1;
        editorThreshold = 2;
      }

      if (validTokenCount >= editorThreshold) {
        // Достаточно токенов для полных прав редактора
        accessLevel = 'editor';
        hasAccess = true;
      } else if (validTokenCount > 0) {
        // Есть токены, но недостаточно для редактора - права только на чтение
        accessLevel = 'readonly';
        hasAccess = true;
      } else {
        // Нет токенов - обычный пользователь
        accessLevel = 'user';
        hasAccess = false;
      }

      logger.info(`Access level determined for ${address}: ${accessLevel} (${validTokenCount} tokens)`);

      return {
        level: accessLevel,
        tokenCount: validTokenCount,
        hasAccess: hasAccess,
        validTokens: validTokens
      };
    } catch (error) {
      logger.error(`Error in getUserAccessLevel: ${error.message}`);
      return { level: 'user', tokenCount: 0, hasAccess: false };
    }
  }

  // Добавляем псевдоним функции checkAdminRole для обратной совместимости
  async checkAdminTokens(address) {
    if (!address) return false;

    logger.info(`Checking admin tokens for address: ${address}`);

    try {
      // Используем новую функцию для определения уровня доступа
      const accessLevel = await this.getUserAccessLevel(address);
      const isAdmin = accessLevel.hasAccess; // Любой доступ выше 'user' считается админским

      // Обновляем роль пользователя в базе данных
      if (isAdmin) {
        try {
          // Получаем ключ шифрования
          const fs = require('fs');
          const path = require('path');
          let encryptionKey = 'default-key';
          
          try {
            const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
            if (fs.existsSync(keyPath)) {
              encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
            }
          } catch (keyError) {
            console.error('Error reading encryption key:', keyError);
          }

          // Находим userId по адресу
          const userResult = await db.getQuery()(
            `
            SELECT u.id FROM users u 
            JOIN user_identities ui ON u.id = ui.user_id 
            WHERE ui.provider_encrypted = encrypt_text('wallet', $2) AND ui.provider_id_encrypted = encrypt_text($1, $2)`,
            [address.toLowerCase(), encryptionKey]
          );

          if (userResult.rows.length > 0) {
            const userId = userResult.rows[0].id;
            // Обновляем роль пользователя с учетом уровня доступа
            const role = accessLevel.level;
            await db.getQuery()('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
            logger.info(`Updated user ${userId} role to ${role} based on token holdings (${accessLevel.tokenCount} tokens)`);
          }
        } catch (error) {
          logger.error('Error updating user role:', error);
          // Продолжаем выполнение, даже если обновление роли не удалось
        }
      } else {
        // Если пользователь не имеет доступа, сбрасываем роль на "user"
        try {
          // Получаем ключ шифрования
          const fs = require('fs');
          const path = require('path');
          let encryptionKey = 'default-key';
          
          try {
            const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
            if (fs.existsSync(keyPath)) {
              encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
            }
          } catch (keyError) {
            console.error('Error reading encryption key:', keyError);
          }

          const userResult = await db.getQuery()(
            `
            SELECT u.id, u.role FROM users u 
            JOIN user_identities ui ON u.id = ui.user_id 
            WHERE ui.provider_encrypted = encrypt_text('wallet', $2) AND ui.provider_id_encrypted = encrypt_text($1, $2)`,
            [address.toLowerCase(), encryptionKey]
          );

          if (userResult.rows.length > 0 && userResult.rows[0].role !== 'user') {
            const userId = userResult.rows[0].id;
            await db.getQuery()('UPDATE users SET role = $1 WHERE id = $2', ['user', userId]);
            logger.info(`Reset user ${userId} role to user (no valid tokens found)`);
          }
        } catch (error) {
          logger.error('Error updating user role:', error);
        }
      }

      return isAdmin;
    } catch (error) {
      logger.error(`Error in checkAdminTokens: ${error.message}`);
      return false; // При любой ошибке считаем, что пользователь не админ
    }
  }

  /**
   * Перепроверяет админский статус ВСЕХ пользователей с кошельками
   * @returns {Promise<void>}
   */
  async recheckAllUsersAdminStatus() {
    logger.info('Starting recheck of admin status for all users with wallets');

    try {
      // Получаем ключ шифрования через унифицированную утилиту
      const encryptionUtils = require('../utils/encryptionUtils');
      const encryptionKey = encryptionUtils.getEncryptionKey();

      // Получаем всех пользователей с кошельками
      const usersResult = await db.getQuery()(
        `
        SELECT DISTINCT u.id, u.role, decrypt_text(ui.provider_id_encrypted, $1) as address
        FROM users u 
        JOIN user_identities ui ON u.id = ui.user_id 
        WHERE ui.provider_encrypted = encrypt_text('wallet', $1)
        `,
        [encryptionKey]
      );

      logger.info(`Found ${usersResult.rows.length} users with wallets to recheck`);

      // Перепроверяем каждого пользователя
      for (const user of usersResult.rows) {
        try {
          const address = user.address;
          const currentRole = user.role;
          
          logger.info(`Rechecking access level for user ${user.id} with address ${address}`);
          
          // Получаем новый уровень доступа
          const accessLevel = await this.getUserAccessLevel(address);
          const newRole = accessLevel.hasAccess ? accessLevel.level : 'user';
          
          // Обновляем роль только если она изменилась
          if (currentRole !== newRole) {
            await db.getQuery()('UPDATE users SET role = $1 WHERE id = $2', [newRole, user.id]);
            logger.info(`Updated user ${user.id} role from ${currentRole} to ${newRole} (address: ${address}, tokens: ${accessLevel.tokenCount})`);
          } else {
            logger.info(`User ${user.id} role unchanged: ${currentRole} (address: ${address}, tokens: ${accessLevel.tokenCount})`);
          }
          
        } catch (userError) {
          logger.error(`Error rechecking user ${user.id}: ${userError.message}`);
          // Продолжаем с другими пользователями
        }
      }

      logger.info('Completed recheck of admin status for all users');
    } catch (error) {
      logger.error(`Error in recheckAllUsersAdminStatus: ${error.message}`);
      throw error;
    }
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
      const guestIdentities = identities.filter((id) => id.identity_type === 'guest');

      // Если гостевых идентификаторов больше 3, удаляем старые
      if (guestIdentities.length > 3) {
        // Сортируем по дате создания (новые первые)
        guestIdentities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Оставляем только 3 последних идентификатора
        const identitiesToDelete = guestIdentities.slice(3);

        // Удаляем старые идентификаторы
        for (const identity of identitiesToDelete) {
          await db.getQuery()('DELETE FROM user_identities WHERE id = $1', [identity.id]);
          logger.info(`Deleted old guest identity: ${identity.id}`);
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
      const identities = await encryptedDb.getData('user_identities', { user_id: userId }, null, 'created_at DESC');
      
      // Данные уже расшифрованы encryptedDb, просто переименовываем поля
      const formattedIdentities = identities.map(identity => ({
        id: identity.id,
        user_id: identity.user_id,
        created_at: identity.created_at,
        provider: identity.provider, // Уже расшифровано
        provider_id: identity.provider_id // Уже расшифровано
      }));
      
      return formattedIdentities;
    } catch (error) {
      logger.error('[getUserIdentities] Error:', error);
      
      // Если произошла ошибка расшифровки, попробуем получить данные напрямую
      try {
        logger.info(`[AuthService] Trying to get unencrypted data for user ${userId}`);
        const { rows } = await db.getQuery()(
          'SELECT id, user_id, created_at, provider_encrypted as provider, provider_id_encrypted as provider_id FROM user_identities WHERE user_id = $1 ORDER BY created_at DESC',
          [userId]
        );
        
        logger.info(`[AuthService] Found ${rows.length} unencrypted identities for user ${userId}`);
        return rows;
      } catch (fallbackError) {
        logger.error(`[AuthService] Fallback error getting identities for user ${userId}:`, fallbackError);
        throw fallbackError;
      }
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
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeout)),
      ]);
      return { balance, hasTokens: balance > 0 };
    } catch (error) {
      logger.warn(`[checkArbitrumBalance] Timeout or error for ${address}:`, error);
      return { balance: 0, hasTokens: false, error: error.message };
    }
  }

  /**
   * Связывает новый идентификатор с существующим пользователем
   * @param {number} userId - ID пользователя
   * @param {string} provider - Тип идентификатора (wallet, email, telegram)
   * @param {string} providerId - Значение идентификатора
   * @returns {Promise<Object>} - Результат операции
   */
  async linkIdentity(userId, provider, providerId) {
    try {
      if (!userId || !provider || !providerId) {
        logger.warn(
          `[AuthService] Missing parameters for linkIdentity: userId=${userId}, provider=${provider}, providerId=${providerId}`
        );
        throw new Error('Missing parameters');
      }

      // Нормализуем значение идентификатора
      let normalizedProviderId = providerId;
      if (provider === 'wallet') {
        // Для кошельков используем ethers для валидации и нормализации
        try {
          normalizedProviderId = ethers.getAddress(providerId).toLowerCase();
        } catch (error) {
          logger.error(`[AuthService] Invalid wallet address: ${providerId}`, error);
          throw new Error('Invalid wallet address');
        }
      } else if (provider === 'email') {
        normalizedProviderId = providerId.toLowerCase();
      }

      logger.info(
        `[AuthService] Linking identity ${provider}:${normalizedProviderId} to user ${userId}`
      );

      // Проверяем, существует ли уже такой идентификатор
      const existingIdentities = await encryptedDb.getData('user_identities', {
        provider: provider,
        provider_id: normalizedProviderId
      }, 1);

      if (existingIdentities.length > 0) {
        const existingUserId = existingIdentities[0].user_id;

        // Если идентификатор уже принадлежит этому пользователю, ничего не делаем
        if (existingUserId === userId) {
          logger.info(
            `[AuthService] Identity ${provider}:${normalizedProviderId} already exists for user ${userId}`
          );
          return { success: true, message: 'Identity already exists' };
        } else {
          // Если идентификатор принадлежит другому пользователю, возвращаем ошибку
          logger.warn(
            `[AuthService] Identity ${provider}:${normalizedProviderId} already belongs to user ${existingUserId}, not user ${userId}`
          );
          throw new Error(`Identity already belongs to another user (${existingUserId})`);
        }
      }

      // Добавляем новый идентификатор для пользователя
      await encryptedDb.saveData('user_identities', {
        user_id: userId,
        provider: provider,
        provider_id: normalizedProviderId
      });

      // Проверяем и обновляем роль администратора, если это идентификатор кошелька
      let isAdmin = false;
      if (provider === 'wallet') {
        isAdmin = await this.checkAdminTokens(normalizedProviderId);

        // Обновляем роль пользователя в базе данных, если нужно
        if (isAdmin) {
          await db.getQuery()('UPDATE users SET role = $1 WHERE id = $2', ['admin', userId]);
          logger.info(`[AuthService] Updated user ${userId} role to admin based on token holdings`);
        }
      }

      logger.info(
        `[AuthService] Identity ${provider}:${normalizedProviderId} successfully linked to user ${userId}`
      );
      return { success: true, isAdmin };
    } catch (error) {
      logger.error(
        `[AuthService] Error linking identity ${provider}:${providerId} to user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Обрабатывает успешную верификацию Email.
   * Находит или создает пользователя, связывает email, проверяет роль админа.
   * @param {string} email - Верифицированный email.
   * @param {object} session - Объект сессии запроса.
   * @returns {Promise<{userId: number, email: string, role: string, isNewUser: boolean}>}
   */
  async handleEmailVerification(email, session) {
    const normalizedEmail = email.toLowerCase();
    let userId;
    let isNewUser = false;
    let userRole = 'user'; // Роль по умолчанию

    try {
      // 1. Определить пользователя (существующий по email/сессии или новый)
      if (session.authenticated && session.userId) {
        // Используем уже аутентифицированного пользователя
        userId = session.userId;
        logger.info(`[handleEmailVerification] Using authenticated user ${userId}`);
      } else {
        // Ищем существующего пользователя по email
        const existingUser = await identityService.findUserByIdentity('email', normalizedEmail);
        if (existingUser) {
          userId = existingUser.id;
          logger.info(`[handleEmailVerification] Found existing user ${userId} by email ${normalizedEmail}`);
        } else if (session.tempUserId) {
          // Используем временного пользователя, если есть
          userId = session.tempUserId;
          logger.info(`[handleEmailVerification] Using temporary user ${userId}`);
        } else {
          // Создаем нового пользователя
          const newUserResult = await db.getQuery()('INSERT INTO users (role) VALUES ($1) RETURNING id', [
            'user',
          ]);
          userId = newUserResult.rows[0].id;
          isNewUser = true;
          logger.info(`[handleEmailVerification] Created new user ${userId}`);
        }
      }

      // 2. Связать email с пользователем (если еще не связан)
      await identityService.saveIdentity(userId, 'email', normalizedEmail, true);
      logger.info(`[handleEmailVerification] Ensured email identity ${normalizedEmail} for user ${userId}`);

      // 3. Связать гостевые ID (если есть)
      if (session.guestId) {
        await identityService.saveIdentity(userId, 'guest', session.guestId, true);
      }
      if (session.previousGuestId && session.previousGuestId !== session.guestId) {
        await identityService.saveIdentity(userId, 'guest', session.previousGuestId, true);
      }

      // 4. Проверить роль на основе привязанного кошелька
      try {
        const linkedWallet = await getLinkedWallet(userId);
        if (linkedWallet && linkedWallet.provider_id) {
          logger.info(`[handleEmailVerification] Found linked wallet ${linkedWallet.provider_id}. Checking role...`);
          const isAdmin = await checkAdminRole(linkedWallet.provider_id);
          userRole = isAdmin ? 'admin' : 'user';
          logger.info(`[handleEmailVerification] Role determined as: ${userRole}`);

          // Опционально: Обновить роль в таблице users
          const currentUser = await db.getQuery()('SELECT role FROM users WHERE id = $1', [userId]);
          if (currentUser.rows.length > 0 && currentUser.rows[0].role !== userRole) {
            await db.getQuery()('UPDATE users SET role = $1 WHERE id = $2', [userRole, userId]);
            logger.info(`[handleEmailVerification] Updated user role in DB to ${userRole}`);
          }
        } else {
          logger.info(`[handleEmailVerification] No linked wallet found. Role remains 'user'.`);
          // Если кошелька нет, проверяем текущую роль из базы (на случай, если она была admin ранее)
          const currentUser = await db.getQuery()('SELECT role FROM users WHERE id = $1', [userId]);
          if (currentUser.rows.length > 0) {
            userRole = currentUser.rows[0].role;
          }
        }
      } catch (roleCheckError) {
        logger.error(`[handleEmailVerification] Error checking admin role:`, roleCheckError);
        // В случае ошибки берем текущую роль из базы или оставляем 'user'
        try {
          const currentUser = await db.getQuery()('SELECT role FROM users WHERE id = $1', [userId]);
          if (currentUser.rows.length > 0) {
            userRole = currentUser.rows[0].role;
          }
        } catch (dbError) {
          logger.error('Error fetching current user role after role check error:', dbError);
        }
      }

      // Очистка временных данных из сессии
      delete session.tempUserId;
      delete session.pendingEmail;

      broadcastContactsUpdate();

      return {
        userId,
        email: normalizedEmail,
        role: userRole,
        isNewUser,
      };
    } catch (error) {
      logger.error('Error in handleEmailVerification:', error);
      throw new Error('Ошибка обработки верификации Email');
    }
  }

  /**
   * Получение балансов токенов пользователя только по токенам из базы
   * @param {string} address - адрес кошелька
   * @returns {Promise<Array>} - массив объектов с балансами
   */
  async getUserTokenBalances(address) {
    return tokenBalanceService.getUserTokenBalances(address);
  }

  /**
   * Проверяет nonce для адреса кошелька
   * @param {string} address - адрес кошелька
   * @param {string} nonce - nonce для проверки
   * @returns {Promise<boolean>} - true если nonce валиден
   */
  async verifyNonce(address, nonce) {
    try {
      // Получаем nonce из базы данных через encryptedDb
      const nonceData = await encryptedDb.getData('nonces', {
        identity_value: address.toLowerCase()
      }, 1);

      if (nonceData.length === 0) {
        logger.warn(`[verifyNonce] No nonce found for address: ${address}`);
        return false;
      }

      // Получаем nonce из результата
      const storedNonce = nonceData[0].nonce;
      
      // Сравниваем с переданным nonce
      const isValid = storedNonce === nonce;
      
      if (!isValid) {
        logger.warn(`[verifyNonce] Invalid nonce for address: ${address}. Expected: ${storedNonce}, Got: ${nonce}`);
      }

      return isValid;
    } catch (error) {
      logger.error(`[verifyNonce] Error verifying nonce for address ${address}:`, error);
      return false;
    }
  }
}

// Создаем и экспортируем единственный экземпляр
const authService = new AuthService();
module.exports = authService;
