const logger = require('../utils/logger');
const db = require('../db');
const authService = require('./auth-service');
const verificationService = require('./verification-service');

// Инициализация процесса аутентификации по email
async function initEmailAuth(session) {
  try {
    // Создаем или получаем ID пользователя
    let userId;
    
    if (session.authenticated && session.userId) {
      userId = session.userId;
    } else {
      const userResult = await db.query(
        'INSERT INTO users (created_at) VALUES (NOW()) RETURNING id'
      );
      userId = userResult.rows[0].id;
      session.tempUserId = userId;
    }
    
    // Создаем код через сервис верификации
    const code = await verificationService.createVerificationCode(
      'email',
      session.guestId || 'temp',
      userId
    );
    
    logger.info(`Generated verification code: ${code} for Email auth`);
    return { verificationCode: code };
  } catch (error) {
    logger.error('Error initializing email auth:', error);
    throw error;
  }
}

// Проверка кода верификации
async function checkEmailVerification(code, session) {
  try {
    if (!session?.guestId) {
      return { verified: false, message: "Сессия не найдена" };
    }

    // Проверяем код через сервис верификации
    const result = await verificationService.verifyCode(code, 'email', session.guestId);
    
    if (!result.success) {
      return { verified: false, message: result.error || "Неверный код верификации" };
    }
    
    const userId = result.userId;
    
    // Проверяем, существует ли пользователь
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return { verified: false, message: "Пользователь не найден" };
    }
    
    // Проверяем, есть ли у пользователя связанный email
    const emailIdentity = await db.query(
      `SELECT * FROM user_identities 
       WHERE user_id = $1 AND provider = 'email'`,
      [userId]
    );
    
    if (emailIdentity.rows.length === 0) {
      // Связываем Email с пользователем
      await db.query(
        `INSERT INTO user_identities 
         (user_id, provider, provider_id, created_at) 
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (provider, provider_id) DO UPDATE SET user_id = $1`,
        [userId, 'email', session.guestId]
      );
    }
    
    // Связываем гостевой ID с пользователем, если его еще нет
    const guestIdentity = await db.query(
      `SELECT * FROM user_identities 
       WHERE user_id = $1 AND provider = 'guest' AND provider_id = $2`,
      [userId, session.guestId]
    );
    
    if (guestIdentity.rows.length === 0) {
      await db.query(
        `INSERT INTO user_identities 
         (user_id, provider, provider_id, created_at) 
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (provider, provider_id) DO UPDATE SET user_id = $1`,
        [userId, 'guest', session.guestId]
      );
    }
    
    return {
      verified: true,
      userId,
      email: session.guestId
    };
  } catch (error) {
    logger.error('Error in Email verification:', error);
    return { verified: false, message: "Ошибка при проверке кода" };
  }
}

module.exports = {
  initEmailAuth,
  checkEmailVerification
}; 