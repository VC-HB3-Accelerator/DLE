const logger = require('../utils/logger');
const db = require('../db');
const authService = require('./auth-service');
const verificationService = require('./verification-service');
const { EmailBotService } = require('./emailBot');

// Инициализация процесса аутентификации по email
async function initEmailAuth(session, email) {
  try {
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      throw new Error('Некорректный формат email');
    }
    
    // Сохраняем email в сессии для последующей верификации
    session.pendingEmail = email.toLowerCase();
    
    // Создаем или получаем ID пользователя
    let userId;
    
    // Проверяем, существует ли пользователь с этим email
    const existingEmailUser = await db.query(
      `SELECT ui.user_id 
       FROM user_identities ui 
       WHERE ui.provider = 'email' AND ui.provider_id = $1`,
      [email.toLowerCase()]
    );
    
    if (existingEmailUser.rows.length > 0) {
      // Используем существующего пользователя
      userId = existingEmailUser.rows[0].user_id;
      logger.info(`Using existing user ${userId} for email ${email}`);
      
      // Связываем гостевой ID с существующим пользователем, если еще нет
      if (session.guestId) {
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
      }
    } else if (session.authenticated && session.userId) {
      // Если пользователь уже аутентифицирован, используем его ID
      userId = session.userId;
    } else if (session.guestId) {
      // Проверяем, есть ли пользователь с текущим guestId
      const guestUserResult = await db.query(
        `SELECT u.id 
         FROM users u 
         JOIN user_identities ui ON u.id = ui.user_id 
         WHERE ui.provider = 'guest' AND ui.provider_id = $1`,
        [session.guestId]
      );
      
      if (guestUserResult.rows.length > 0) {
        // Используем существующего пользователя с guestId
        userId = guestUserResult.rows[0].id;
      } else {
        // Создаем нового пользователя
        const userResult = await db.query(
          'INSERT INTO users (created_at) VALUES (NOW()) RETURNING id'
        );
        userId = userResult.rows[0].id;
        
        // Связываем гостевой ID с новым пользователем
        if (session.guestId) {
          await db.query(
            `INSERT INTO user_identities 
             (user_id, provider, provider_id, created_at) 
             VALUES ($1, $2, $3, NOW())`,
            [userId, 'guest', session.guestId]
          );
        }
      }
    } else {
      // Создаем нового пользователя без гостевого ID
      const userResult = await db.query(
        'INSERT INTO users (created_at) VALUES (NOW()) RETURNING id'
      );
      userId = userResult.rows[0].id;
    }
    
    session.tempUserId = userId;
    
    // Создаем код через сервис верификации
    const code = await verificationService.createVerificationCode(
      'email',
      email.toLowerCase(),
      userId
    );
    
    // Создаем экземпляр EmailBotService для отправки кода
    const emailService = new EmailBotService(
      process.env.EMAIL_USER,
      process.env.EMAIL_PASSWORD
    );
    
    // Отправляем код на email пользователя
    await emailService.sendVerificationCode(email.toLowerCase(), userId);
    
    logger.info(`Generated verification code for Email auth for ${email} and sent to user's email`);
    return { success: true };
  } catch (error) {
    logger.error('Error initializing email auth:', error);
    throw error;
  }
}

// Проверка кода верификации
async function checkEmailVerification(code, session) {
  try {
    if (!session?.pendingEmail) {
      return { verified: false, message: "Email не найден в сессии" };
    }

    // Проверяем код через сервис верификации
    const result = await verificationService.verifyCode(code, 'email', session.pendingEmail);
    
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
       WHERE user_id = $1 AND provider = 'email' AND provider_id = $2`,
      [userId, session.pendingEmail]
    );
    
    if (emailIdentity.rows.length === 0) {
      // Связываем Email с пользователем
      await db.query(
        `INSERT INTO user_identities 
         (user_id, provider, provider_id, created_at) 
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (provider, provider_id) DO UPDATE SET user_id = $1`,
        [userId, 'email', session.pendingEmail]
      );
    }
    
    // Связываем гостевой ID с пользователем, если его еще нет
    if (session.guestId) {
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
      
      // Связываем гостевые сообщения с пользователем
      try {
        const messagesExist = await db.query(
          'SELECT EXISTS(SELECT 1 FROM guest_messages WHERE guest_id = $1) as exists',
          [session.guestId]
        );

        if (messagesExist.rows[0].exists) {
          await db.query('SELECT link_guest_messages($1, $2)', [userId, session.guestId]);
        }
      } catch (linkError) {
        logger.error(`Error linking messages: ${linkError}`);
      }
    }
    
    return {
      verified: true,
      userId,
      email: session.pendingEmail
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