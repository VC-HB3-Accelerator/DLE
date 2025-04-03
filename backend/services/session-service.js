const logger = require('../utils/logger');
const db = require('../db');

/**
 * Сервис для работы с сессиями пользователей
 */
class SessionService {
  /**
   * Сохраняет сессию с обработкой ошибок
   * @param {object} session - Объект сессии
   * @param {string} context - Контекст для логирования
   * @returns {Promise<boolean>} - Результат операции
   */
  async saveSession(session, context = '') {
    if (!session) {
      logger.warn(`[SessionService${context ? '/' + context : ''}] Cannot save null session`);
      return false;
    }
    
    try {
      return await new Promise((resolve, reject) => {
        session.save(err => {
          if (err) {
            logger.error(`[SessionService${context ? '/' + context : ''}] Error saving session:`, err);
            reject(err);
          } else {
            logger.info(`[SessionService${context ? '/' + context : ''}] Session saved successfully`);
            resolve(true);
          }
        });
      });
    } catch (error) {
      logger.error(`[SessionService${context ? '/' + context : ''}] Error in saveSession:`, error);
      return false;
    }
  }
  
  /**
   * Восстанавливает сессию из базы данных по ID
   * @param {string} sessionId - ID сессии
   * @returns {Promise<object|null>} - Данные сессии или null
   */
  async getSessionData(sessionId) {
    try {
      if (!sessionId) {
        logger.warn('[SessionService] Cannot restore session without sessionId');
        return null;
      }
      
      logger.info(`[SessionService] Attempting to retrieve session ${sessionId}`);
      
      const result = await db.query(
        'SELECT sess FROM session WHERE sid = $1',
        [sessionId]
      );
      
      if (result.rows.length === 0) {
        logger.info(`[SessionService] No session found with ID ${sessionId}`);
        return null;
      }
      
      const sessionData = result.rows[0].sess;
      logger.info(`[SessionService] Retrieved session data for ${sessionId}`);
      
      return sessionData;
    } catch (error) {
      logger.error(`[SessionService] Error retrieving session ${sessionId}:`, error);
      return null;
    }
  }
  
  /**
   * Обновляет данные аутентификации в сессии
   * @param {object} session - Объект сессии
   * @param {object} authData - Данные аутентификации
   * @returns {Promise<boolean>} - Результат операции
   */
  async updateAuthData(session, authData) {
    try {
      if (!session || !authData) {
        logger.warn('[SessionService] Missing parameters for updateAuthData');
        return false;
      }
      
      const { userId, authType, isAdmin, ...otherData } = authData;
      
      if (!userId || !authType) {
        logger.warn('[SessionService] Missing userId or authType in authData');
        return false;
      }
      
      // Обновляем основные поля аутентификации
      session.userId = userId;
      session.authType = authType;
      session.authenticated = true;
      
      if (isAdmin !== undefined) {
        session.isAdmin = isAdmin;
      }
      
      // Обновляем дополнительные данные в зависимости от типа аутентификации
      if (authType === 'wallet' && otherData.address) {
        session.address = otherData.address.toLowerCase();
      } else if (authType === 'email' && otherData.email) {
        session.email = otherData.email.toLowerCase();
      } else if (authType === 'telegram') {
        if (otherData.telegramId) session.telegramId = otherData.telegramId;
        if (otherData.telegramUsername) session.telegramUsername = otherData.telegramUsername;
        if (otherData.telegramFirstName) session.telegramFirstName = otherData.telegramFirstName;
      }
      
      // Сохраняем гостевые ID, если они предоставлены и не были ранее в сессии
      if (otherData.guestId && !session.guestId) {
        session.guestId = otherData.guestId;
      }
      
      if (otherData.previousGuestId && !session.previousGuestId) {
        session.previousGuestId = otherData.previousGuestId;
      }
      
      // Сохраняем обновленную сессию
      return await this.saveSession(session, 'updateAuthData');
    } catch (error) {
      logger.error('[SessionService] Error updating auth data:', error);
      return false;
    }
  }
  
  /**
   * Очищает данные аутентификации в сессии
   * @param {object} session - Объект сессии
   * @returns {Promise<boolean>} - Результат операции
   */
  async logout(session) {
    try {
      if (!session) {
        logger.warn('[SessionService] Cannot logout null session');
        return false;
      }
      
      // Сохраняем гостевые ID перед очисткой
      const guestId = session.guestId;
      
      // Удаляем данные аутентификации
      delete session.userId;
      delete session.authenticated;
      delete session.authType;
      delete session.isAdmin;
      delete session.address;
      delete session.email;
      delete session.telegramId;
      delete session.telegramUsername;
      delete session.telegramFirstName;
      
      // Восстанавливаем гостевой ID для продолжения работы
      if (guestId) {
        session.guestId = guestId;
      }
      
      // Сохраняем обновленную сессию
      return await this.saveSession(session, 'logout');
    } catch (error) {
      logger.error('[SessionService] Error during logout:', error);
      return false;
    }
  }
}

module.exports = new SessionService(); 