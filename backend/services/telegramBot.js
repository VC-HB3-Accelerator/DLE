const { Telegraf } = require('telegraf');
const logger = require('../utils/logger');
const db = require('../db');
const authService = require('./auth-service');
const verificationService = require('./verification-service');
const crypto = require('crypto');
const identityService = require('./identity-service');
const aiAssistant = require('./ai-assistant');
const { checkAdminRole } = require('./admin-role');
const { broadcastContactsUpdate } = require('../wsHub');

let botInstance = null;
let telegramSettingsCache = null;

async function getTelegramSettings() {
  if (telegramSettingsCache) return telegramSettingsCache;
  const { rows } = await db.getQuery()('SELECT * FROM telegram_settings ORDER BY id LIMIT 1');
  if (!rows.length) throw new Error('Telegram settings not found in DB');
  telegramSettingsCache = rows[0];
  return telegramSettingsCache;
}

// Создание и настройка бота
async function getBot() {
  if (!botInstance) {
    const settings = await getTelegramSettings();
    botInstance = new Telegraf(settings.bot_token);

    // Обработка команды /start
    botInstance.command('start', (ctx) => {
      ctx.reply('Добро пожаловать! Отправьте код подтверждения для аутентификации.');
    });

    // Универсальный обработчик текстовых сообщений
    botInstance.on('text', async (ctx) => {
      const text = ctx.message.text.trim();
      // 1. Если команда — пропустить
      if (text.startsWith('/')) return;
      // 2. Проверка: это потенциальный код?
      const isPotentialCode = (str) => /^[A-Z0-9]{6}$/i.test(str);
      if (isPotentialCode(text)) {
        try {
          // Получаем код верификации для всех активных кодов с провайдером telegram
          const codeResult = await db.getQuery()(
            `SELECT * FROM verification_codes 
             WHERE code = $1 
             AND provider = 'telegram' 
             AND used = false 
             AND expires_at > NOW()`,
            [text.toUpperCase()]
          );

          if (codeResult.rows.length === 0) {
            ctx.reply('Неверный код подтверждения');
            return;
          }

          const verification = codeResult.rows[0];
          const providerId = verification.provider_id;
          const linkedUserId = verification.user_id; // Получаем связанный userId если он есть
          let userId;
          let userRole = 'user'; // Роль по умолчанию

          // Отмечаем код как использованный
          await db.getQuery()('UPDATE verification_codes SET used = true WHERE id = $1', [
            verification.id,
          ]);

          logger.info('Starting Telegram auth process for code:', text);

          // Проверяем, существует ли уже пользователь с таким Telegram ID
          const existingTelegramUser = await db.getQuery()(
            `SELECT ui.user_id 
             FROM user_identities ui 
             WHERE ui.provider = 'telegram' AND ui.provider_id = $1`,
            [ctx.from.id.toString()]
          );

          if (existingTelegramUser.rows.length > 0) {
            // Если пользователь с таким Telegram ID уже существует, используем его
            userId = existingTelegramUser.rows[0].user_id;
            logger.info(`Using existing user ${userId} for Telegram account ${ctx.from.id}`);
          } else {
            // Если код верификации был связан с существующим пользователем, используем его
            if (linkedUserId) {
              // Используем userId из кода верификации
              userId = linkedUserId;
              // Связываем Telegram с этим пользователем
              await db.getQuery()(
                `INSERT INTO user_identities 
                 (user_id, provider, provider_id, created_at) 
                 VALUES ($1, $2, $3, NOW())`,
                [userId, 'telegram', ctx.from.id.toString()]
              );
              logger.info(
                `Linked Telegram account ${ctx.from.id} to pre-authenticated user ${userId}`
              );
            } else {
              // Проверяем, есть ли пользователь, связанный с гостевым идентификатором
              let existingUserWithGuestId = null;
              if (providerId) {
                const guestUserResult = await db.getQuery()(
                  `SELECT user_id FROM guest_user_mapping WHERE guest_id = $1`,
                  [providerId]
                );
                if (guestUserResult.rows.length > 0) {
                  existingUserWithGuestId = guestUserResult.rows[0].user_id;
                  logger.info(
                    `Found existing user ${existingUserWithGuestId} by guest ID ${providerId}`
                  );
                }
              }

              if (existingUserWithGuestId) {
                // Используем существующего пользователя и добавляем ему Telegram идентификатор
                userId = existingUserWithGuestId;
                await db.getQuery()(
                  `INSERT INTO user_identities 
                   (user_id, provider, provider_id, created_at) 
                   VALUES ($1, $2, $3, NOW())`,
                  [userId, 'telegram', ctx.from.id.toString()]
                );
                logger.info(`Linked Telegram account ${ctx.from.id} to existing user ${userId}`);
              } else {
                // Создаем нового пользователя, если не нашли существующего
                const userResult = await db.getQuery()(
                  'INSERT INTO users (created_at, role) VALUES (NOW(), $1) RETURNING id',
                  ['user']
                );
                userId = userResult.rows[0].id;

                // Связываем Telegram с новым пользователем
                await db.getQuery()(
                  `INSERT INTO user_identities 
                   (user_id, provider, provider_id, created_at) 
                   VALUES ($1, $2, $3, NOW())`,
                  [userId, 'telegram', ctx.from.id.toString()]
                );

                // Если был гостевой ID, связываем его с новым пользователем
                if (providerId) {
                  await db.getQuery()(
                    `INSERT INTO guest_user_mapping 
                     (user_id, guest_id) 
                     VALUES ($1, $2)
                     ON CONFLICT (guest_id) DO UPDATE SET user_id = $1`,
                    [userId, providerId]
                  );
                }

                logger.info(`Created new user ${userId} with Telegram account ${ctx.from.id}`);
              }
            }
          }

          // ----> НАЧАЛО: Проверка роли на основе привязанного кошелька <----
          if (userId) { // Убедимся, что userId определен
            logger.info(`[TelegramBot] Checking linked wallet for determined userId: ${userId} (Type: ${typeof userId})`);
            try {
              const linkedWallet = await authService.getLinkedWallet(userId);
              if (linkedWallet) { 
                logger.info(`[TelegramBot] Found linked wallet ${linkedWallet} for user ${userId}. Checking role...`);
                const isAdmin = await checkAdminRole(linkedWallet);
                userRole = isAdmin ? 'admin' : 'user';
                logger.info(`[TelegramBot] Role for user ${userId} determined as: ${userRole}`);

                // Опционально: Обновить роль в таблице users
                const currentUser = await db.getQuery()('SELECT role FROM users WHERE id = $1', [userId]);
                if (currentUser.rows.length > 0 && currentUser.rows[0].role !== userRole) {
                  await db.getQuery()('UPDATE users SET role = $1 WHERE id = $2', [userRole, userId]);
                  logger.info(`[TelegramBot] Updated user role in DB to ${userRole}`);
                }
              } else {
                logger.info(`[TelegramBot] No linked wallet found for user ${userId}. Checking current DB role.`);
                // Если кошелька нет, берем текущую роль из базы
                const currentUser = await db.getQuery()('SELECT role FROM users WHERE id = $1', [userId]);
                if (currentUser.rows.length > 0) {
                  userRole = currentUser.rows[0].role;
                }
              }
            } catch (roleCheckError) {
              logger.error(`[TelegramBot] Error checking admin role for user ${userId}:`, roleCheckError);
              // В случае ошибки берем роль из базы или оставляем 'user'
              try {
                  const currentUser = await db.getQuery()('SELECT role FROM users WHERE id = $1', [userId]);
                  if (currentUser.rows.length > 0) { userRole = currentUser.rows[0].role; }
              } catch (dbError) { /* ignore */ }
            }
          } else {
             logger.error('[TelegramBot] Cannot check role because userId is undefined!');
          }
          // ----> КОНЕЦ: Проверка роли <----

          // Логируем userId перед обновлением сессии
          logger.info(`[telegramBot] Attempting to update session for userId: ${userId}`);

          // Находим последнюю активную сессию для данного userId
          let activeSessionId = null;
          try {
            // Ищем сессию, где есть userId и она не истекла (проверка expires_at)
            // Сортируем по expires_at DESC чтобы взять самую "свежую", если их несколько
            const sessionResult = await db.getQuery()(
               `SELECT sid FROM session 
                WHERE sess ->> 'userId' = $1 
                AND expire > NOW()
                ORDER BY expire DESC 
                LIMIT 1`, 
               [userId?.toString()] // Используем optional chaining и преобразуем в строку
            );
            
            if (sessionResult.rows.length > 0) {
              activeSessionId = sessionResult.rows[0].sid;
              logger.info(`[telegramBot] Found active session ID ${activeSessionId} for user ${userId}`);

              // Обновляем найденную сессию в базе данных, добавляя/перезаписывая данные Telegram
              const updateResult = await db.getQuery()(
                `UPDATE session 
                 SET sess = (sess::jsonb || $1::jsonb)::json
                 WHERE sid = $2`,
                [
                  JSON.stringify({
                    // authenticated: true, // Не перезаписываем, т.к. сессия уже должна быть аутентифицирована
                    authType: 'telegram', // Обновляем тип аутентификации
                    telegramId: ctx.from.id.toString(),
                    telegramUsername: ctx.from.username,
                    telegramFirstName: ctx.from.first_name,
                    role: userRole, // Записываем определенную роль
                    // userId: userId?.toString() // userId уже должен быть в сессии
                  }),
                  activeSessionId // Обновляем по найденному session ID
                ]
              );
              
              if (updateResult.rowCount > 0) {
                  logger.info(`[telegramBot] Session ${activeSessionId} updated successfully with Telegram data for user ${userId}`);
              } else {
                  logger.warn(`[telegramBot] Session update query executed but did not update rows for sid: ${activeSessionId}. This might indicate a concurrency issue or incorrect sid.`);
              }

            } else {
              logger.warn(`[telegramBot] No active web session found for userId: ${userId}. Telegram is linked, but the user might need to refresh their browser session.`);
            }
          } catch(sessionError) {
             logger.error(`[telegramBot] Error finding or updating session for userId ${userId}:`, sessionError);
          }

          // Отправляем сообщение об успешной аутентификации
          await ctx.reply('Аутентификация успешна! Можете вернуться в приложение.');

          // Удаляем сообщение с кодом
          try {
            await ctx.deleteMessage(ctx.message.message_id);
          } catch (error) {
            logger.warn('Could not delete code message:', error);
          }

          // После каждого успешного создания пользователя:
          broadcastContactsUpdate();
        } catch (error) {
          logger.error('Error in Telegram auth:', error);
          await ctx.reply('Произошла ошибка при аутентификации. Попробуйте позже.');
        }
        return;
      }
      // 3. Всё остальное — чат с ИИ-ассистентом
      try {
        const telegramId = ctx.from.id.toString();
        // 1. Найти или создать пользователя
        const { userId, role } = await identityService.findOrCreateUserWithRole('telegram', telegramId);
        // 1.1 Найти или создать беседу
        let conversationResult = await db.getQuery()(
          'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
          [userId]
        );
        let conversation;
        if (conversationResult.rows.length === 0) {
          const title = `Чат с пользователем ${userId}`;
          const newConv = await db.getQuery()(
            'INSERT INTO conversations (user_id, title, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
            [userId, title]
          );
          conversation = newConv.rows[0];
        } else {
          conversation = conversationResult.rows[0];
        }
        // 2. Сохранять все сообщения с conversation_id
        let content = text;
        let attachmentMeta = {};
        // Проверяем вложения (фото, документ, аудио, видео)
        let fileId, fileName, mimeType, fileSize, attachmentBuffer;
        if (ctx.message.document) {
          fileId = ctx.message.document.file_id;
          fileName = ctx.message.document.file_name;
          mimeType = ctx.message.document.mime_type;
          fileSize = ctx.message.document.file_size;
        } else if (ctx.message.photo && ctx.message.photo.length > 0) {
          // Берём самое большое фото
          const photo = ctx.message.photo[ctx.message.photo.length - 1];
          fileId = photo.file_id;
          fileName = 'photo.jpg';
          mimeType = 'image/jpeg';
          fileSize = photo.file_size;
        } else if (ctx.message.audio) {
          fileId = ctx.message.audio.file_id;
          fileName = ctx.message.audio.file_name || 'audio.ogg';
          mimeType = ctx.message.audio.mime_type || 'audio/ogg';
          fileSize = ctx.message.audio.file_size;
        } else if (ctx.message.video) {
          fileId = ctx.message.video.file_id;
          fileName = ctx.message.video.file_name || 'video.mp4';
          mimeType = ctx.message.video.mime_type || 'video/mp4';
          fileSize = ctx.message.video.file_size;
        }
        if (fileId) {
          // Скачиваем файл
          const fileLink = await ctx.telegram.getFileLink(fileId);
          const res = await fetch(fileLink.href);
          attachmentBuffer = await res.buffer();
          attachmentMeta = {
            attachment_filename: fileName,
            attachment_mimetype: mimeType,
            attachment_size: fileSize,
            attachment_data: attachmentBuffer
          };
        }
        // Сохраняем сообщение в БД
        await db.getQuery()(
          `INSERT INTO messages (user_id, conversation_id, sender_type, content, channel, role, direction, created_at, attachment_filename, attachment_mimetype, attachment_size, attachment_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11)`,
          [userId, conversation.id, 'user', content, 'telegram', role, 'in',
            attachmentMeta.attachment_filename || null,
            attachmentMeta.attachment_mimetype || null,
            attachmentMeta.attachment_size || null,
            attachmentMeta.attachment_data || null
          ]
        );

        // 3. Получить ответ от ИИ
        const aiResponse = await aiAssistant.getResponse(content, 'auto');
        // 4. Сохранить ответ в БД с conversation_id
        await db.getQuery()(
          `INSERT INTO messages (user_id, conversation_id, sender_type, content, channel, role, direction, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [userId, conversation.id, 'assistant', aiResponse, 'telegram', role, 'out']
        );
        // 5. Отправить ответ пользователю
        await ctx.reply(aiResponse);
      } catch (error) {
        logger.error('[TelegramBot] Ошибка при обработке сообщения:', error);
        await ctx.reply('Произошла ошибка при обработке вашего сообщения. Попробуйте позже.');
      }
    });

    // Запуск бота
    await botInstance.launch();
    logger.info('[TelegramBot] Бот запущен');
  }

  return botInstance;
}

// Остановка бота
async function stopBot() {
  if (botInstance) {
    try {
      await botInstance.stop();
      botInstance = null;
      logger.info('Telegram bot stopped successfully');
    } catch (error) {
      logger.error('Error stopping Telegram bot:', error);
      throw error;
    }
  }
}

// Инициализация процесса аутентификации
async function initTelegramAuth(session) {
  try {
    // Используем временный идентификатор для создания кода верификации
    // Реальный пользователь будет создан или найден при проверке кода через бота
    const tempId = crypto.randomBytes(16).toString('hex');

    // Если пользователь уже авторизован, сохраняем его userId в guest_user_mapping
    // чтобы потом при авторизации через бота этот пользователь был найден
    if (session && session.authenticated && session.userId) {
      const guestId = session.guestId || tempId;

      // Связываем гостевой ID с текущим пользователем
      await db.getQuery()(
        `INSERT INTO guest_user_mapping (user_id, guest_id) 
         VALUES ($1, $2) 
         ON CONFLICT (guest_id) DO UPDATE SET user_id = $1`,
        [session.userId, guestId]
      );

      logger.info(
        `[initTelegramAuth] Linked guestId ${guestId} to authenticated user ${session.userId}`
      );
    }

    // Создаем код через сервис верификации с идентификатором
    const code = await verificationService.createVerificationCode(
      'telegram',
      session.guestId || tempId,
      session.authenticated ? session.userId : null
    );

    logger.info(
      `[initTelegramAuth] Created verification code for guestId: ${session.guestId || tempId}${session.authenticated ? `, userId: ${session.userId}` : ''}`
    );

    const settings = await getTelegramSettings();
    return {
      verificationCode: code,
      botLink: `https://t.me/${settings.bot_username}`,
    };
  } catch (error) {
    logger.error('Error initializing Telegram auth:', error);
    throw error;
  }
}

function clearSettingsCache() {
  telegramSettingsCache = null;
}

module.exports = {
  getBot,
  stopBot,
  initTelegramAuth,
  clearSettingsCache,
};
