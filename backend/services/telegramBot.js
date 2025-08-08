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

const { Telegraf } = require('telegraf');
const logger = require('../utils/logger');
const encryptedDb = require('./encryptedDatabaseService');
const db = require('../db');
const authService = require('./auth-service');
const verificationService = require('./verification-service');
const crypto = require('crypto');
const identityService = require('./identity-service');
const aiAssistant = require('./ai-assistant');
const { checkAdminRole } = require('./admin-role');
const { broadcastContactsUpdate, broadcastChatMessage } = require('../wsHub');
const aiAssistantSettingsService = require('./aiAssistantSettingsService');
const { ragAnswer, generateLLMResponse } = require('./ragService');
const { isUserBlocked } = require('../utils/userUtils');

let botInstance = null;
let telegramSettingsCache = null;

async function getTelegramSettings() {
  if (telegramSettingsCache) return telegramSettingsCache;
  
  const settings = await encryptedDb.getData('telegram_settings', {}, 1);
  if (!settings.length) throw new Error('Telegram settings not found in DB');
  
  telegramSettingsCache = settings[0];
  return telegramSettingsCache;
}

// Создание и настройка бота
async function getBot() {
      // console.log('[TelegramBot] getBot() called');
  if (!botInstance) {
          // console.log('[TelegramBot] Creating new bot instance...');
    const settings = await getTelegramSettings();
          // console.log('[TelegramBot] Got settings, creating Telegraf instance...');
    botInstance = new Telegraf(settings.bot_token);
          // console.log('[TelegramBot] Telegraf instance created');

    // Обработка команды /start
    botInstance.command('start', (ctx) => {
      ctx.reply('Добро пожаловать! Отправьте код подтверждения для аутентификации.');
    });

    // Универсальный обработчик текстовых сообщений
    botInstance.on('text', async (ctx) => {
      const text = ctx.message.text.trim();
      // 1. Если команда — пропустить
      if (text.startsWith('/')) return;
      
      // Отправляем индикатор печати для улучшения UX
      const typingAction = ctx.replyWithChatAction('typing');
      
      // 2. Проверка: это потенциальный код?
      const isPotentialCode = (str) => /^[A-Z0-9]{6}$/i.test(str);
      if (isPotentialCode(text)) {
        await typingAction;
        try {
          // Получаем код верификации для всех активных кодов с провайдером telegram
          const codes = await encryptedDb.getData('verification_codes', {
            code: text.toUpperCase(),
            provider: 'telegram',
            used: false
          }, 1);

          if (codes.length === 0) {
            ctx.reply('Неверный код подтверждения');
            return;
          }

          const verification = codes[0];
          const providerId = verification.provider_id;
          const linkedUserId = verification.user_id; // Получаем связанный userId если он есть
          let userId;
          let userRole = 'user'; // Роль по умолчанию

          // Отмечаем код как использованный
          await encryptedDb.saveData('verification_codes', {
            used: true
          }, {
            id: verification.id
          });

          logger.info('Starting Telegram auth process for code:', text);

          // Проверяем, существует ли уже пользователь с таким Telegram ID
          const existingTelegramUsers = await encryptedDb.getData('user_identities', {
            provider: 'telegram',
            provider_id: ctx.from.id.toString()
          }, 1);

          if (existingTelegramUsers.length > 0) {
            // Если пользователь с таким Telegram ID уже существует, используем его
            userId = existingTelegramUsers[0].user_id;
            logger.info(`Using existing user ${userId} for Telegram account ${ctx.from.id}`);
          } else {
            // Если код верификации был связан с существующим пользователем, используем его
            if (linkedUserId) {
              // Используем userId из кода верификации
              userId = linkedUserId;
              // Связываем Telegram с этим пользователем
              await encryptedDb.saveData('user_identities', {
                user_id: userId,
                provider: 'telegram',
                provider_id: ctx.from.id.toString()
              });
              logger.info(
                `Linked Telegram account ${ctx.from.id} to pre-authenticated user ${userId}`
              );
            } else {
              // Проверяем, есть ли пользователь, связанный с гостевым идентификатором
              let existingUserWithGuestId = null;
              if (providerId) {
                const guestUserResult = await encryptedDb.getData('guest_user_mapping', {
                  guest_id: providerId
                }, 1);
                if (guestUserResult.length > 0) {
                  existingUserWithGuestId = guestUserResult[0].user_id;
                  logger.info(
                    `Found existing user ${existingUserWithGuestId} by guest ID ${providerId}`
                  );
                }
              }

              if (existingUserWithGuestId) {
                // Используем существующего пользователя и добавляем ему Telegram идентификатор
                userId = existingUserWithGuestId;
                await encryptedDb.saveData('user_identities', {
                  user_id: userId,
                  provider: 'telegram',
                  provider_id: ctx.from.id.toString()
                });
                logger.info(`Linked Telegram account ${ctx.from.id} to existing user ${userId}`);
              } else {
                // Создаем нового пользователя, если не нашли существующего
                const userResult = await encryptedDb.saveData('users', {
                  created_at: new Date(),
                  role: 'user'
                });
                userId = userResult.id;

                // Связываем Telegram с новым пользователем
                await encryptedDb.saveData('user_identities', {
                  user_id: userId,
                  provider: 'telegram',
                  provider_id: ctx.from.id.toString()
                });

                // Если был гостевой ID, связываем его с новым пользователем
                if (providerId) {
                  await encryptedDb.saveData('guest_user_mapping', {
                    user_id: userId,
                    guest_id: providerId
                  }, {
                    user_id: userId
                  });
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
                const currentUser = await encryptedDb.getData('users', {
                  id: userId
                }, 1);
                if (currentUser.length > 0 && currentUser[0].role !== userRole) {
                  await encryptedDb.saveData('users', {
                    role: userRole
                  }, {
                    id: userId
                  });
                  logger.info(`[TelegramBot] Updated user role in DB to ${userRole}`);
                }
              } else {
                logger.info(`[TelegramBot] No linked wallet found for user ${userId}. Checking current DB role.`);
                // Если кошелька нет, берем текущую роль из базы
                const currentUser = await encryptedDb.getData('users', {
                  id: userId
                }, 1);
                if (currentUser.length > 0) {
                  userRole = currentUser[0].role;
                }
              }
            } catch (roleCheckError) {
              logger.error(`[TelegramBot] Error checking admin role for user ${userId}:`, roleCheckError);
              // В случае ошибки берем роль из базы или оставляем 'user'
              try {
                  const currentUser = await encryptedDb.getData('users', {
                    id: userId
                  }, 1);
                  if (currentUser.length > 0) { userRole = currentUser[0].role; }
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
            const sessionResult = await encryptedDb.getData('session', {
              'sess->>userId': userId?.toString()
            }, 1, 'expire', 'DESC');
            
            if (sessionResult.length > 0) {
              activeSessionId = sessionResult[0].sid;
              logger.info(`[telegramBot] Found active session ID ${activeSessionId} for user ${userId}`);

              // Обновляем найденную сессию в базе данных, добавляя/перезаписывая данные Telegram
              const updateResult = await encryptedDb.saveData('session', {
                sess: JSON.stringify({
                  // authenticated: true, // Не перезаписываем, т.к. сессия уже должна быть аутентифицирована
                  authType: 'telegram', // Обновляем тип аутентификации
                  telegramId: ctx.from.id.toString(),
                  telegramUsername: ctx.from.username,
                  telegramFirstName: ctx.from.first_name,
                  role: userRole, // Записываем определенную роль
                  // userId: userId?.toString() // userId уже должен быть в сессии
                })
              }, {
                sid: activeSessionId
              });
              
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
        if (await isUserBlocked(userId)) {
          await ctx.reply('Вы заблокированы. Сообщения не принимаются.');
          return;
        }
        
        // 1.1 Найти или создать беседу
        let conversationResult = await encryptedDb.getData('conversations', {
          user_id: userId
        }, 1, 'updated_at', 'DESC', 'created_at', 'DESC');
        let conversation;
        if (conversationResult.length === 0) {
          const title = `Чат с пользователем ${userId}`;
          const newConv = await encryptedDb.saveData('conversations', {
            user_id: userId,
            title: title,
            created_at: new Date(),
            updated_at: new Date()
          });
          conversation = newConv;
        } else {
          conversation = conversationResult[0];
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
        
        // Асинхронная загрузка файлов
        if (fileId) {
          try {
            const fileLink = await ctx.telegram.getFileLink(fileId);
            const res = await fetch(fileLink.href);
            attachmentBuffer = await res.buffer();
            attachmentMeta = {
              attachment_filename: fileName,
              attachment_mimetype: mimeType,
              attachment_size: fileSize,
              attachment_data: attachmentBuffer
            };
          } catch (fileError) {
            logger.error('[TelegramBot] Error downloading file:', fileError);
            // Продолжаем без файла
          }
        }
        
        // Сохраняем сообщение в БД
        if (!conversation || !conversation.id) {
          logger.error(`[TelegramBot] Conversation is undefined or has no id for user ${userId}`);
          await ctx.reply('Произошла ошибка при создании диалога. Попробуйте позже.');
          return;
        }
        
        const userMessage = await encryptedDb.saveData('messages', {
          user_id: userId,
          conversation_id: conversation.id,
          sender_type: 'user',
          content: content,
          channel: 'telegram',
          role: role,
          direction: 'in',
          created_at: new Date(),
          attachment_filename: attachmentMeta.attachment_filename || null,
          attachment_mimetype: attachmentMeta.attachment_mimetype || null,
          attachment_size: attachmentMeta.attachment_size || null,
          attachment_data: attachmentMeta.attachment_data || null
        });
        
        // Отправляем WebSocket уведомление о пользовательском сообщении
        try {
          const decryptedUserMessage = await encryptedDb.getData('messages', { id: userMessage.id }, 1);
          if (decryptedUserMessage && decryptedUserMessage[0]) {
            broadcastChatMessage(decryptedUserMessage[0], userId);
          }
        } catch (wsError) {
          logger.error('[TelegramBot] WebSocket notification error for user message:', wsError);
        }

        if (await isUserBlocked(userId)) {
          logger.info(`[TelegramBot] Пользователь ${userId} заблокирован — ответ ИИ не отправляется.`);
          return;
        }

        // 3. Получить ответ от ИИ (RAG + LLM) - асинхронно
        const aiResponsePromise = (async () => {
          const aiSettings = await aiAssistantSettingsService.getSettings();
          let ragTableId = null;
          if (aiSettings && aiSettings.selected_rag_tables) {
            ragTableId = Array.isArray(aiSettings.selected_rag_tables)
              ? aiSettings.selected_rag_tables[0]
              : aiSettings.selected_rag_tables;
          }
          
          // Загружаем историю сообщений для контекста (ограничиваем до 5 сообщений)
          let history = null;
          try {
            const recentMessages = await encryptedDb.getData('messages', {
              conversation_id: conversation.id
            }, 5, 'created_at DESC');
            
            if (recentMessages && recentMessages.length > 0) {
              // Преобразуем сообщения в формат для AI
              history = recentMessages.reverse().map(msg => ({
                role: msg.sender_type === 'user' ? 'user' : 'assistant',
                content: msg.content || '' // content уже расшифрован encryptedDb
              }));
            }
          } catch (historyError) {
            logger.error('[TelegramBot] Error loading message history:', historyError);
          }
          
          let aiResponse;
          if (ragTableId) {
            // Сначала ищем ответ через RAG
            const ragResult = await ragAnswer({ tableId: ragTableId, userQuestion: content });
            if (ragResult && ragResult.answer && typeof ragResult.score === 'number' && Math.abs(ragResult.score) <= 0.1) {
              aiResponse = ragResult.answer;
            } else {
              aiResponse = await generateLLMResponse({
                userQuestion: content,
                context: ragResult && ragResult.context ? ragResult.context : '',
                answer: ragResult && ragResult.answer ? ragResult.answer : '',
                systemPrompt: aiSettings ? aiSettings.system_prompt : '',
                history: history,
                model: aiSettings ? aiSettings.model : undefined,
                language: aiSettings && aiSettings.languages && aiSettings.languages.length > 0 ? aiSettings.languages[0] : 'ru'
              });
            }
          } else {
            // Используем системный промпт из настроек, если RAG не используется
            const systemPrompt = aiSettings ? aiSettings.system_prompt : '';
            aiResponse = await aiAssistant.getResponse(content, history, systemPrompt);
          }
          
          return aiResponse;
        })();
        
        // Ждем ответ от ИИ с таймаутом
        const aiResponse = await Promise.race([
          aiResponsePromise,
                  new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI response timeout')), 120000)
        )
        ]);
        
        // 4. Сохранить ответ в БД с conversation_id
        const aiMessage = await encryptedDb.saveData('messages', {
          user_id: userId,
          conversation_id: conversation.id,
          sender_type: 'assistant',
          content: aiResponse,
          channel: 'telegram',
          role: role,
          direction: 'out',
          created_at: new Date()
        });
        
        // 5. Отправить ответ пользователю
        await ctx.reply(aiResponse);
        
        // 6. Отправить WebSocket уведомление
        try {
          const decryptedAiMessage = await encryptedDb.getData('messages', { id: aiMessage.id }, 1);
          if (decryptedAiMessage && decryptedAiMessage[0]) {
            broadcastChatMessage(decryptedAiMessage[0], userId);
          }
        } catch (wsError) {
          logger.error('[TelegramBot] WebSocket notification error:', wsError);
        }
      } catch (error) {
        logger.error('[TelegramBot] Ошибка при обработке сообщения:', error);
        await ctx.reply('Произошла ошибка при обработке вашего сообщения. Попробуйте позже.');
      }
    });

    // Запуск бота с таймаутом
    // console.log('[TelegramBot] Before botInstance.launch()');
    try {
      // Запускаем бота с таймаутом
      const launchPromise = botInstance.launch();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Telegram bot launch timeout')), 30000); // 30 секунд таймаут
      });
      
      await Promise.race([launchPromise, timeoutPromise]);
      // console.log('[TelegramBot] After botInstance.launch()');
      logger.info('[TelegramBot] Бот запущен');
    } catch (error) {
              // console.error('[TelegramBot] Error launching bot:', error);
      // Не выбрасываем ошибку, чтобы не блокировать запуск сервера
      // console.log('[TelegramBot] Bot launch failed, but continuing...');
    }
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
      await encryptedDb.saveData('guest_user_mapping', {
        user_id: session.userId,
        guest_id: guestId
      }, {
        user_id: session.userId
      });

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

async function getAllBots() {
  const settings = await encryptedDb.getData('telegram_settings', {}, 1, 'id');
  return settings;
}

module.exports = {
  getTelegramSettings,
  getBot,
  stopBot,
  initTelegramAuth,
  clearSettingsCache,
  getAllBots,
};
