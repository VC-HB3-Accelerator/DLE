const db = require('../db');
const logger = require('../utils/logger');

/**
 * Сервис для работы с идентификаторами пользователей
 */
class IdentityService {
  /**
   * Сохраняет идентификатор пользователя в базу данных
   * @param {number} userId - ID пользователя
   * @param {string} provider - Тип идентификатора (wallet, email, telegram, guest)
   * @param {string} providerId - Значение идентификатора
   * @param {boolean} verified - Флаг верификации идентификатора
   * @returns {Promise<object>} - Результат операции
   */
  async saveIdentity(userId, provider, providerId, verified = true) {
    try {
      if (!userId || !provider || !providerId) {
        logger.warn(`[IdentityService] Missing required parameters: userId=${userId}, provider=${provider}, providerId=${providerId}`);
        return {
          success: false,
          error: 'Missing required parameters'
        };
      }
      
      logger.info(`[IdentityService] Saving identity for user ${userId}: ${provider}:${providerId}`);
      
      // Проверяем, существует ли уже такой идентификатор
      const existingResult = await db.query(
        `SELECT user_id FROM user_identities WHERE provider = $1 AND provider_id = $2`,
        [provider, providerId]
      );
      
      if (existingResult.rows.length > 0) {
        const existingUserId = existingResult.rows[0].user_id;
        
        // Если идентификатор уже принадлежит этому пользователю, ничего не делаем
        if (existingUserId === userId) {
          logger.info(`[IdentityService] Identity ${provider}:${providerId} already exists for user ${userId}`);
        } else {
          // Если идентификатор принадлежит другому пользователю, логируем это
          logger.warn(`[IdentityService] Identity ${provider}:${providerId} already belongs to user ${existingUserId}, not user ${userId}`);
          return {
            success: false,
            error: `Identity already belongs to another user (${existingUserId})`
          };
        }
      } else {
        // Создаем новую запись
        await db.query(
          `INSERT INTO user_identities (user_id, provider, provider_id) 
           VALUES ($1, $2, $3)`,
          [userId, provider, providerId]
        );
        logger.info(`[IdentityService] Created new identity ${provider}:${providerId} for user ${userId}`);
      }
      
      return { success: true };
    } catch (error) {
      logger.error(`[IdentityService] Error saving identity ${provider}:${providerId} for user ${userId}:`, error);
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
      if (!userId) {
        logger.warn('[IdentityService] Missing userId parameter');
        return [];
      }
      
      const result = await db.query(
        `SELECT provider, provider_id FROM user_identities WHERE user_id = $1`,
        [userId]
      );
      
      logger.info(`[IdentityService] Found ${result.rows.length} identities for user ${userId}`);
      return result.rows;
    } catch (error) {
      logger.error(`[IdentityService] Error getting identities for user ${userId}:`, error);
      return [];
    }
  }
  
  /**
   * Получает все идентификаторы пользователя определенного типа
   * @param {number} userId - ID пользователя
   * @param {string} provider - Тип идентификатора
   * @returns {Promise<Array>} - Массив идентификаторов
   */
  async getUserIdentitiesByProvider(userId, provider) {
    try {
      if (!userId || !provider) {
        logger.warn(`[IdentityService] Missing parameters: userId=${userId}, provider=${provider}`);
        return [];
      }
      
      const result = await db.query(
        `SELECT provider_id FROM user_identities WHERE user_id = $1 AND provider = $2`,
        [userId, provider]
      );
      
      logger.info(`[IdentityService] Found ${result.rows.length} ${provider} identities for user ${userId}`);
      return result.rows.map(row => row.provider_id);
    } catch (error) {
      logger.error(`[IdentityService] Error getting ${provider} identities for user ${userId}:`, error);
      return [];
    }
  }
  
  /**
   * Находит пользователя по идентификатору
   * @param {string} provider - Тип идентификатора
   * @param {string} providerId - Значение идентификатора
   * @returns {Promise<object|null>} - Информация о пользователе или null
   */
  async findUserByIdentity(provider, providerId) {
    try {
      if (!provider || !providerId) {
        logger.warn(`[IdentityService] Missing parameters: provider=${provider}, providerId=${providerId}`);
        return null;
      }
      
      const result = await db.query(
        `SELECT u.id, u.role FROM users u 
         JOIN user_identities ui ON u.id = ui.user_id 
         WHERE ui.provider = $1 AND ui.provider_id = $2`,
        [provider, providerId]
      );
      
      if (result.rows.length === 0) {
        logger.info(`[IdentityService] No user found with identity ${provider}:${providerId}`);
        return null;
      }
      
      logger.info(`[IdentityService] Found user ${result.rows[0].id} with identity ${provider}:${providerId}`);
      return result.rows[0];
    } catch (error) {
      logger.error(`[IdentityService] Error finding user by identity ${provider}:${providerId}:`, error);
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
        const emailResult = await this.saveIdentity(userId, 'email', session.email.toLowerCase(), true);
        results.push({ type: 'email', result: emailResult });
      }
      
      if (session.address) {
        const walletResult = await this.saveIdentity(userId, 'wallet', session.address.toLowerCase(), true);
        results.push({ type: 'wallet', result: walletResult });
      }
      
      if (session.telegramId) {
        const telegramResult = await this.saveIdentity(userId, 'telegram', session.telegramId, true);
        results.push({ type: 'telegram', result: telegramResult });
      }
      
      // Сохраняем гостевые идентификаторы
      if (session.guestId) {
        const guestResult = await this.saveIdentity(userId, 'guest', session.guestId, true);
        results.push({ type: 'guest', result: guestResult });
      }
      
      if (session.previousGuestId && session.previousGuestId !== session.guestId) {
        const prevGuestResult = await this.saveIdentity(userId, 'guest', session.previousGuestId, true);
        results.push({ type: 'previousGuest', result: prevGuestResult });
      }
      
      logger.info(`[IdentityService] Saved ${results.length} identities from session for user ${userId}`);
      return { success: true, results };
    } catch (error) {
      logger.error(`[IdentityService] Error saving identities from session for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new IdentityService(); 