const logger = require('../utils/logger');
const db = require('../db');
const { processGuestMessages } = require('../routes/chat');

/**
 * Сервис для работы с сессиями пользователей
 */
class SessionService {
  /**
   * Сохраняет сессию, обрабатывая ошибки и логируя результат
   * @param {Object} session - Объект сессии Express
   * @returns {Promise<boolean>} - Успешно ли сохранена сессия
   */
  async saveSession(session) {
    try {
      return new Promise((resolve, reject) => {
        session.save((err) => {
          if (err) {
            logger.error('Error saving session:', err);
            reject(err);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      logger.error(`[saveSession] Error:`, error);
      throw error;
    }
  }

  /**
   * Связывает гостевые сообщения с пользователем после аутентификации
   * @param {Object} session - Объект сессии Express
   * @param {number} userId - ID пользователя
   * @returns {Promise<Object>} - Результат операции
   */
  async linkGuestMessages(session, userId) {
    try {
      // Получаем все гостевые ID для текущего пользователя из таблицы
      const guestIdsResult = await db.getQuery()(
        'SELECT guest_id FROM guest_user_mapping WHERE user_id = $1',
        [userId]
      );
      const userGuestIds = guestIdsResult.rows.map((row) => row.guest_id);

      // Собираем все гостевые ID, которые нужно обработать
      const guestIdsToProcess = new Set();

      // Добавляем текущий гостевой ID, если он есть и не обработан в БД
      if (session.guestId) {
        const isProcessed = await this.isGuestIdProcessed(session.guestId);
        if (!isProcessed) {
          guestIdsToProcess.add(session.guestId);

          // Записываем связь с пользователем в новую таблицу
          await db.getQuery()(
            'INSERT INTO guest_user_mapping (user_id, guest_id) VALUES ($1, $2) ON CONFLICT (guest_id) DO UPDATE SET user_id = $1',
            [userId, session.guestId]
          );
        }
      }

      // Добавляем предыдущий гостевой ID, если он есть и не обработан в БД
      if (session.previousGuestId) {
        const isProcessed = await this.isGuestIdProcessed(session.previousGuestId);
        if (!isProcessed) {
          guestIdsToProcess.add(session.previousGuestId);

          // Записываем связь с пользователем в новую таблицу
          await db.getQuery()(
            'INSERT INTO guest_user_mapping (user_id, guest_id) VALUES ($1, $2) ON CONFLICT (guest_id) DO UPDATE SET user_id = $1',
            [userId, session.previousGuestId]
          );
        }
      }

      // Добавляем все гостевые ID пользователя из таблицы, которые еще не обработаны
      for (const guestId of userGuestIds) {
        const isProcessed = await this.isGuestIdProcessed(guestId);
        if (!isProcessed) {
          guestIdsToProcess.add(guestId);
        }
      }

      // Логируем только если есть что обрабатывать
      if (guestIdsToProcess.size > 0) {
        logger.info(
          `[linkGuestMessages] Processing ${guestIdsToProcess.size} guest IDs for user ${userId}`
        );
      }

      // Обрабатываем все собранные гостевые ID
      for (const guestId of guestIdsToProcess) {
        await this.processGuestMessagesWrapper(userId, guestId);

        // Помечаем guestId как обработанный в базе данных
        await db.getQuery()(
          'UPDATE guest_user_mapping SET processed = true WHERE guest_id = $1',
          [guestId]
        );
      }

      return { success: true };
    } catch (error) {
      logger.error('[linkGuestMessages] Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Проверяет, был ли guest ID уже обработан
   * @param {string} guestId - ID гостя
   * @returns {Promise<boolean>} - Был ли guest ID обработан
   */
  async isGuestIdProcessed(guestId) {
    try {
      const result = await db.getQuery()(
        'SELECT processed FROM guest_user_mapping WHERE guest_id = $1',
        [guestId]
      );
      
      return result.rows.length > 0 && result.rows[0].processed === true;
    } catch (error) {
      logger.error(`[isGuestIdProcessed] Error checking guest ID ${guestId}:`, error);
      return false;
    }
  }

  /**
   * Обертка для функции processGuestMessages
   * @param {number} userId - ID пользователя
   * @param {string} guestId - ID гостя
   * @returns {Promise<Object>} - Результат операции
   */
  async processGuestMessagesWrapper(userId, guestId) {
    try {
      return await processGuestMessages(userId, guestId);
    } catch (error) {
      logger.error(`[processGuestMessagesWrapper] Error: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Получает сессию из хранилища по ID
   * @param {string} sessionId - ID сессии
   * @returns {Promise<Object|null>} - Объект сессии или null
   */
  async getSession(sessionId) {
    try {
      // Реализация будет зависеть от используемого хранилища сессий
      // Этот метод будет полезен, если нужно получить сессию не из текущего запроса
      return null; // Временная заглушка
    } catch (error) {
      logger.error(`[getSession] Error getting session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Удаляет сессию
   * @param {Object} session - Объект сессии Express
   * @returns {Promise<boolean>} - Успешно ли удалена сессия
   */
  async destroySession(session) {
    try {
      return new Promise((resolve, reject) => {
        session.destroy((err) => {
          if (err) {
            logger.error('Error destroying session:', err);
            reject(err);
          } else {
            logger.info('Session destroyed successfully');
            resolve(true);
          }
        });
      });
    } catch (error) {
      logger.error(`[destroySession] Error:`, error);
      throw error;
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

      const result = await db.getQuery()(
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
   * Очищает все массивы processedGuestIds из сессий в базе данных
   * @returns {Promise<boolean>} - Результат операции
   */
  async cleanupProcessedGuestIds() {
    try {
      logger.info('[SessionService] Starting cleanup of processedGuestIds from sessions');
      
      // Используем один SQL-запрос для обновления всех сессий
      const result = await db.getQuery()(
        `UPDATE session 
         SET sess = (sess::jsonb - 'processedGuestIds')::json
         WHERE sess::text LIKE '%"processedGuestIds"%'`
      );
      
      logger.info(`[SessionService] Cleaned processedGuestIds from ${result.rowCount} sessions`);
      return true;
    } catch (error) {
      logger.error('[SessionService] Error during cleanup:', error);
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

      // Очищаем массив processedGuestIds для экономии места
      if (session.processedGuestIds) {
        delete session.processedGuestIds;
      }

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

const sessionService = new SessionService();
module.exports = sessionService;
