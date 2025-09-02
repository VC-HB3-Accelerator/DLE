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

// console.log('[identity-service] loaded');

const encryptedDb = require('./encryptedDatabaseService');
const db = require('../db');
const logger = require('../utils/logger');
const { getLinkedWallet } = require('./wallet-service');
const { checkAdminRole } = require('./admin-role');
const { broadcastContactsUpdate } = require('../wsHub');

/**
 * Сервис для работы с идентификаторами пользователей
 */
class IdentityService {
  /**
   * Нормализует значения идентификаторов (приводит к нижнему регистру где нужно)
   * @param {string} provider - Тип идентификатора
   * @param {string} providerId - Значение идентификатора
   * @returns {object} - Нормализованные значения
   */
  normalizeIdentity(provider, providerId) {
    if (!provider || !providerId) {
      return { provider, providerId };
    }

    // Приводим провайдер к нижнему регистру
    const normalizedProvider = provider.toLowerCase();

    // Для email и wallet приводим значение к нижнему регистру
    let normalizedProviderId = providerId;
    if (normalizedProvider === 'wallet' || normalizedProvider === 'email') {
      normalizedProviderId = providerId.toLowerCase();
    }

    return {
      provider: normalizedProvider,
      providerId: normalizedProviderId,
    };
  }

  /**
   * Сохраняет идентификатор пользователя в базу данных
   * @param {number} userId - ID пользователя
   * @param {string} provider - Тип идентификатора (wallet, email, telegram)
   * @param {string} providerId - Значение идентификатора
   * @param {boolean} verified - Флаг верификации идентификатора (не используется в БД)
   * @returns {Promise<object>} - Результат операции
   */
  async saveIdentity(userId, provider, providerId, verified = true) {
    try {
      if (!userId || !provider || !providerId) {
        logger.warn(
          `[IdentityService] Missing required parameters: userId=${userId}, provider=${provider}, providerId=${providerId}`
        );
        return {
          success: false,
          error: 'Missing required parameters',
        };
      }

      // Нормализуем значения
      const { provider: normalizedProvider, providerId: normalizedProviderId } =
        this.normalizeIdentity(provider, providerId);

      // Проверяем тип провайдера и перенаправляем гостевые идентификаторы в guest_user_mapping
      if (normalizedProvider === 'guest') {
        logger.info(
          `[IdentityService] Converting guest identity for user ${userId} to guest_user_mapping: ${normalizedProviderId}`
        );

        try {
          await encryptedDb.saveData('guest_user_mapping', {
            user_id: userId,
            guest_id: normalizedProviderId
          });
          return { success: true };
        } catch (guestError) {
          logger.error(
            `[IdentityService] Error saving guest identity for user ${userId}:`,
            guestError
          );
          return { success: false, error: guestError.message };
        }
      }

      // Проверяем, разрешен ли такой тип провайдера
      const allowedProviders = ['email', 'wallet', 'telegram', 'username'];
      if (!allowedProviders.includes(normalizedProvider)) {
        logger.warn(`[IdentityService] Invalid provider type: ${normalizedProvider}`);
        return {
          success: false,
          error: `Invalid provider type: ${normalizedProvider}`,
        };
      }

      // Проверяем, существует ли уже такой идентификатор
      const existingIdentity = await this.findIdentity(userId, normalizedProvider);
      if (existingIdentity) {
        // Обновляем существующий идентификатор
        await encryptedDb.saveData('user_identities', {
          provider: normalizedProvider,
          provider_id: normalizedProviderId
        }, {
          user_id: userId,
          provider: normalizedProvider
        });

          logger.info(
          `[IdentityService] Updated identity for user ${userId}: ${normalizedProvider}=${normalizedProviderId}`
          );
      } else {
        // Создаем новый идентификатор
        await encryptedDb.saveData('user_identities', {
          user_id: userId,
          provider: normalizedProvider,
          provider_id: normalizedProviderId
        });

        logger.info(
          `[IdentityService] Saved new identity for user ${userId}: ${normalizedProvider}=${normalizedProviderId}`
        );
      }

      return { success: true };
    } catch (error) {
      logger.error(
        `[IdentityService] Error saving identity for user ${userId}:`,
        error
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Получает все идентификаторы пользователя
   * @param {number} userId - ID пользователя
   * @returns {Promise<Array>} - Массив идентификаторов
   */
  async getUserIdentities(userId) {
    try {
      const identities = await encryptedDb.getData('user_identities', { user_id: userId });
      logger.info(`[IdentityService] Found ${identities.length} identities for user ${userId}`);
      
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
      logger.error(`[IdentityService] Error getting identities for user ${userId}:`, error);
      
      // Если не удалось получить данные через encryptedDb, пробуем через обычный запрос
      // logger.info(`[IdentityService] Trying to get unencrypted data for user ${userId}`); // Убрано избыточное логирование
      
      const { rows } = await db.getQuery()(`
        SELECT provider, provider_id, provider_username, provider_avatar, created_at, updated_at
        FROM user_identities 
        WHERE user_id = $1
        ORDER BY created_at DESC
      `, [userId]);
      
      // logger.info(`[IdentityService] Found ${rows.length} unencrypted identities for user ${userId}`); // Убрано избыточное логирование
      return rows;
    }
  }

  /**
   * Получает идентификаторы пользователя по типу провайдера
   * @param {number} userId - ID пользователя
   * @param {string} provider - Тип провайдера
   * @returns {Promise<Array>} - Массив идентификаторов
   */
  async getUserIdentitiesByProvider(userId, provider) {
    try {
      const identities = await encryptedDb.getData('user_identities', { 
        user_id: userId, 
        provider: provider.toLowerCase() 
      });
      return identities;
    } catch (error) {
      logger.error(`[IdentityService] Error getting identities by provider for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Находит пользователя по идентификатору
   * @param {string} provider - Тип провайдера
   * @param {string} providerId - Значение идентификатора
   * @returns {Promise<object|null>} - Пользователь или null
   */
  async findUserByIdentity(provider, providerId) {
    try {
      const { provider: normalizedProvider, providerId: normalizedProviderId } =
        this.normalizeIdentity(provider, providerId);

      const identities = await encryptedDb.getData('user_identities', {
        provider: normalizedProvider,
        provider_id: normalizedProviderId
      }, 1);

      if (identities.length === 0) {
        return null;
      }

      const userId = identities[0].user_id;
      const users = await encryptedDb.getData('users', { id: userId }, 1);
      
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      logger.error(`[IdentityService] Error finding user by identity:`, error);
      return null;
    }
  }

  /**
   * Находит конкретный идентификатор пользователя
   * @param {number} userId - ID пользователя
   * @param {string} provider - Тип провайдера
   * @returns {Promise<object|null>} - Идентификатор или null
   */
  async findIdentity(userId, provider) {
    try {
      const identities = await encryptedDb.getData('user_identities', {
        user_id: userId,
        provider: provider.toLowerCase()
      }, 1);

      return identities.length > 0 ? identities[0] : null;
    } catch (error) {
      logger.error(`[IdentityService] Error finding identity for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Сохраняет идентификаторы из сессии для пользователя
   * @param {object} session - Объект сессии
   * @param {number} userId - ID пользователя
   * @returns {Promise<object>} - Результат операции
   */
  async saveIdentitiesFromSession(session, userId) {
    try {
      if (!session || !userId) {
        logger.warn(`[IdentityService] Missing parameters: session=${!!session}, userId=${userId}`);
        return { success: false, error: 'Missing required parameters' };
      }

      const results = [];

      // Сохраняем все постоянные идентификаторы из сессии
      if (session.email) {
        const emailResult = await this.saveIdentity(userId, 'email', session.email, true);
        results.push({ type: 'email', result: emailResult });
      }

      if (session.address) {
        const walletResult = await this.saveIdentity(userId, 'wallet', session.address, true);
        results.push({ type: 'wallet', result: walletResult });
      }

      if (session.telegramId) {
        const telegramResult = await this.saveIdentity(
          userId,
          'telegram',
          session.telegramId,
          true
        );
        results.push({ type: 'telegram', result: telegramResult });
      }

      // Сохраняем гостевые идентификаторы в guest_user_mapping
      if (session.guestId) {
        try {
          await encryptedDb.saveData('guest_user_mapping', {
            user_id: userId,
            guest_id: session.guestId
          });
          results.push({ type: 'guest', result: { success: true } });
        } catch (error) {
          logger.error(`[IdentityService] Error saving guest ID for user ${userId}:`, error);
          results.push({ type: 'guest', result: { success: false, error: error.message } });
        }
      }

      if (session.previousGuestId && session.previousGuestId !== session.guestId) {
        try {
          await encryptedDb.saveData('guest_user_mapping', {
            user_id: userId,
            guest_id: session.previousGuestId
          });
          results.push({ type: 'previousGuest', result: { success: true } });
        } catch (error) {
          logger.error(
            `[IdentityService] Error saving previous guest ID for user ${userId}:`,
            error
          );
          results.push({ type: 'previousGuest', result: { success: false, error: error.message } });
        }
      }

      logger.info(
        `[IdentityService] Saved ${results.length} identities from session for user ${userId}`
      );
      return { success: true, results };
    } catch (error) {
      logger.error(
        `[IdentityService] Error saving identities from session for user ${userId}:`,
        error
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Мигрирует все идентификаторы и сообщения от одного пользователя к другому
   * @param {number} fromUserId - ID исходного пользователя
   * @param {number} toUserId - ID целевого пользователя
   * @returns {Promise<object>} - Результат операции
   */
  async migrateUserData(fromUserId, toUserId) {
    try {
      if (!fromUserId || !toUserId) {
        logger.warn(
          `[IdentityService] Missing parameters: fromUserId=${fromUserId}, toUserId=${toUserId}`
        );
        return { success: false, error: 'Missing required parameters' };
      }

        // Получаем все идентификаторы исходного пользователя
      const identities = await encryptedDb.getData('user_identities', { user_id: fromUserId });

        // Переносим каждый идентификатор
      for (const identity of identities) {
        // Создаем новый идентификатор для целевого пользователя
        await encryptedDb.saveData('user_identities', {
          user_id: toUserId,
          provider: identity.provider,
          provider_id: identity.provider_id
        });

          // Удаляем старый идентификатор
        await encryptedDb.deleteData('user_identities', {
          user_id: fromUserId,
          provider: identity.provider,
          provider_id: identity.provider_id
        });
        }

      // Мигрируем гостевые идентификаторы
      const guestMappings = await encryptedDb.getData('guest_user_mapping', { user_id: fromUserId });

        // Переносим каждый гостевой идентификатор
      for (const mapping of guestMappings) {
        await encryptedDb.saveData('guest_user_mapping', {
          user_id: toUserId,
          guest_id: mapping.guest_id,
          processed: mapping.processed
        });
        }

        // Удаляем старые гостевые маппинги
      await encryptedDb.deleteData('guest_user_mapping', { user_id: fromUserId });

        // Переносим все сообщения
      const messages = await encryptedDb.getData('messages', { user_id: fromUserId });
      for (const message of messages) {
        await encryptedDb.saveData('messages', {
          ...message,
          user_id: toUserId
        });
        await encryptedDb.deleteData('messages', { id: message.id });
      }

        // Переносим все диалоги
      const conversations = await encryptedDb.getData('conversations', { user_id: fromUserId });
      for (const conversation of conversations) {
        await encryptedDb.saveData('conversations', {
          ...conversation,
          user_id: toUserId
        });
        await encryptedDb.deleteData('conversations', { id: conversation.id });
      }

        // Переносим настройки пользователя
      const preferences = await encryptedDb.getData('user_preferences', { user_id: fromUserId });
      for (const preference of preferences) {
        await encryptedDb.saveData('user_preferences', {
          ...preference,
          user_id: toUserId
        });
        await encryptedDb.deleteData('user_preferences', { id: preference.id });
      }

        logger.info(
          `[IdentityService] Successfully migrated data from user ${fromUserId} to ${toUserId}`
        );
        return { success: true };
    } catch (error) {
      logger.error(`[IdentityService] Error migrating user data:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Находит всех пользователей с похожими идентификаторами
   * @param {object} identities - Объект с идентификаторами
   * @returns {Promise<Array>} - Массив ID пользователей
   */
  async findRelatedUsers(identities) {
    try {
      const userIds = new Set();

      for (const [provider, providerId] of Object.entries(identities)) {
        if (!providerId) continue;

        const users = await encryptedDb.getData('user_identities', {
          provider: provider,
          provider_id: providerId
        });

        users.forEach((user) => userIds.add(user.user_id));
      }

      return Array.from(userIds);
    } catch (error) {
      logger.error(`[IdentityService] Error finding related users:`, error);
      return [];
    }
  }

  /**
   * Удаляет идентификатор пользователя
   * @param {number} userId - ID пользователя
   * @param {string} provider - Тип идентификатора
   * @param {string} providerId - Значение идентификатора
   * @returns {Promise<object>} - Результат операции
   */
  async deleteIdentity(userId, provider, providerId) {
    try {
      if (!userId || !provider || !providerId) {
        logger.warn(`[IdentityService] Missing parameters for deleteIdentity: userId=${userId}, provider=${provider}, providerId=${providerId}`);
        return { success: false, error: 'Missing required parameters' };
      }
      const { provider: normalizedProvider, providerId: normalizedProviderId } = this.normalizeIdentity(provider, providerId);
      const result = await encryptedDb.deleteData('user_identities', {
        user_id: userId,
        provider: normalizedProvider,
        provider_id: normalizedProviderId
      });
      logger.info(`[IdentityService] Deleted identity ${normalizedProvider}:${normalizedProviderId} for user ${userId}`);
      return { success: true, deleted: result.length };
    } catch (error) {
      logger.error(`[IdentityService] Error deleting identity ${provider}:${providerId} for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Универсальная функция: найти или создать пользователя по идентификатору, привязать идентификатор, проверить роль
   * @param {string} provider - Тип идентификатора ('email' | 'telegram')
   * @param {string} providerId - Значение идентификатора
   * @param {object} [options] - Дополнительные опции
   * @returns {Promise<{userId: number, role: string, isNew: boolean}>}
   */
  async findOrCreateUserWithRole(provider, providerId, options = {}) {
    let user = await this.findUserByIdentity(provider, providerId);
    let isNew = false;
    if (!user) {
      // Создаем пользователя
      const newUser = await encryptedDb.saveData('users', {
        role: 'user'
      });
      const userId = newUser.id;
      await this.saveIdentity(userId, provider, providerId, true);
      user = { id: userId, role: 'user' };
      isNew = true;
      logger.info('[WS] broadcastContactsUpdate after new user created');
      broadcastContactsUpdate();
    }
    // Проверяем связь с кошельком
    const wallet = await getLinkedWallet(user.id);
    let role = 'user';
    if (wallet) {
      const isAdmin = await checkAdminRole(wallet);
      role = isAdmin ? 'admin' : 'user';
      // Обновляем роль в users, если изменилась
      if (user.role !== role) {
        await encryptedDb.saveData('users', {
          role: role
        }, {
          id: user.id
        });
      }
    }
    return { userId: user.id, role, isNew };
  }
}

module.exports = new IdentityService();
