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

// console.log('[EmailBot] emailBot.js loaded');
const encryptedDb = require('./encryptedDatabaseService');
const db = require('../db');
const nodemailer = require('nodemailer');
const Imap = require('imap');
const simpleParser = require('mailparser').simpleParser;
const { processMessage } = require('./ai-assistant');
const { inspect } = require('util');
const logger = require('../utils/logger');
const identityService = require('./identity-service');
const aiAssistant = require('./ai-assistant');
const { broadcastContactsUpdate } = require('../wsHub');
const aiAssistantSettingsService = require('./aiAssistantSettingsService');
const { ragAnswer, generateLLMResponse } = require('./ragService');
const { isUserBlocked } = require('../utils/userUtils');

class EmailBotService {
  constructor() {
    // console.log('[EmailBot] constructor called');
    this.imap = null;
    this.isChecking = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
  }

  // Метод для очистки IMAP соединения
  cleanupImapConnection() {
    if (this.imap) {
      try {
        // Удаляем все обработчики событий
        this.imap.removeAllListeners('error');
        this.imap.removeAllListeners('ready');
        this.imap.removeAllListeners('end');
        this.imap.removeAllListeners('close');
        
        // Закрываем соединение
        if (this.imap.state !== 'disconnected') {
          this.imap.end();
        }
      } catch (error) {
        logger.error('[EmailBot] Error cleaning up IMAP connection:', error);
      } finally {
        this.imap = null;
      }
    }
  }

  async getSettingsFromDb() {
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
      // console.error('Error reading encryption key:', keyError);
    }
    
    const { rows } = await db.getQuery()(
      'SELECT id, smtp_port, imap_port, created_at, updated_at, decrypt_text(smtp_host_encrypted, $1) as smtp_host, decrypt_text(smtp_user_encrypted, $1) as smtp_user, decrypt_text(smtp_password_encrypted, $1) as smtp_password, decrypt_text(imap_host_encrypted, $1) as imap_host, decrypt_text(imap_user_encrypted, $1) as imap_user, decrypt_text(imap_password_encrypted, $1) as imap_password, decrypt_text(from_email_encrypted, $1) as from_email FROM email_settings ORDER BY id LIMIT 1',
      [encryptionKey]
    );
    if (!rows.length) throw new Error('Email settings not found in DB');
    return rows[0];
  }

  async getTransporter() {
    const settings = await this.getSettingsFromDb();
    return nodemailer.createTransport({
      host: settings.smtp_host,
      port: 465,                       // Используем порт 465 для SSMTP (SSL)
      secure: true,                    // Включаем SSL
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_password,
      },
      pool: false, // Отключаем пул соединений
      maxConnections: 1, // Ограничиваем до 1 соединения
      maxMessages: 1, // Ограничиваем до 1 сообщения на соединение
      tls: { 
        rejectUnauthorized: false
        // Убираем minVersion и maxVersion для избежания конфликтов TLS
      },
      connectionTimeout: 30000, // 30 секунд на подключение
      greetingTimeout: 30000, // 30 секунд на приветствие
      socketTimeout: 60000, // 60 секунд на операции сокета
    });
  }

  async getImapConfig() {
    const settings = await this.getSettingsFromDb();
    return {
      user: settings.imap_user,        // Используем IMAP пользователя
      password: settings.imap_password, // Используем IMAP пароль
      host: settings.imap_host,
      port: 993,                       // Используем порт 993 для IMAPS (SSL)
      tls: true,                       // Включаем SSL
      tlsOptions: { 
        rejectUnauthorized: false,
        servername: settings.imap_host,
        // Убираем minVersion и maxVersion для избежания конфликтов TLS
        ciphers: 'HIGH:!aNULL:!MD5:!RC4' // Безопасные шифры
      },
      keepalive: {
        interval: 10000,
        idleInterval: 300000,
        forceNoop: true,
      },
      connTimeout: 60000,    // 60 секунд
      authTimeout: 60000,    // Таймаут на аутентификацию - 60 секунд
      greetingTimeout: 30000, // Таймаут на приветствие сервера
      socketTimeout: 60000,   // Таймаут на операции сокета
      debug: false      // Включаем отладку для диагностики
    };
  }

  // Метод для инициализации email верификации
  async initEmailVerification(email, userId, code) {
    try {
      // Отправляем код на email
      await this.sendVerificationCode(email, code);

      return { success: true };
    } catch (error) {
      logger.error('Error initializing email verification:', error);
      throw error;
    }
  }

  // Отправка кода верификации
  async sendVerificationCode(email, code) {
    try {
      const settings = await this.getSettingsFromDb();
      const transporter = await this.getTransporter();
      const mailOptions = {
        from: settings.from_email,
        to: email,
        subject: 'Код подтверждения',
        text: `Ваш код подтверждения: ${code}\n\nКод действителен в течение 15 минут.`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #333;">Код подтверждения</h2><p style="font-size: 16px; color: #666;">Ваш код подтверждения:</p><div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;"><span style="font-size: 24px; font-weight: bold; color: #333;">${code}</span></div><p style="font-size: 14px; color: #999;">Код действителен в течение 15 минут.</p></div>`,
      };
      await transporter.sendMail(mailOptions);
      // logger.info(`Verification code sent to ${email}`); // Убрано логирование email адреса
    } catch (error) {
      logger.error('Error sending verification code:', error);
      throw error;
    }
  }

  checkEmails() {
    try {
      // Добавляем обработчики ошибок
      this.imap.once('error', (err) => {
        logger.error(`IMAP connection error during check: ${err.message}`);
        try {
          this.imap.end();
        } catch (e) {
          // Игнорируем ошибки при закрытии
        }
      });

      this.imap.once('ready', () => {
        this.imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            logger.error(`Error opening inbox: ${err}`);
            this.imap.end();
            return;
          }

          // Ищем все письма и проверяем их флаги вручную
          this.imap.search(['ALL'], (err, results) => {
            if (err) {
              logger.error(`Error searching messages: ${err}`);
              this.imap.end();
              return;
            }

            if (!results || results.length === 0) {
              // logger.info('No messages found'); // Убрано избыточное логирование
              this.imap.end();
              return;
            }

            // Фильтруем только непрочитанные сообщения
            const f = this.imap.fetch(results, { 
              bodies: '',
              markSeen: true, // Помечаем как прочитанные
              struct: true    // Получаем структуру для Message-ID
            });

            let unreadMessages = [];
            let processedCount = 0;
            let totalMessages = results.length;

            f.on('message', (msg, seqno) => {
              let messageId = null;
              let uid = null;
              let flags = [];
              
              // Получаем UID, Message-ID и флаги
              msg.once('attributes', (attrs) => {
                uid = attrs.uid;
                flags = attrs.flags || [];
                if (attrs['x-gm-msgid']) {
                  messageId = attrs['x-gm-msgid'];
                }
              });
              
              msg.on('body', (stream, info) => {
                simpleParser(stream, async (err, parsed) => {
                  if (err) {
                    logger.error(`Error parsing message: ${err}`);
                    processedCount++;
                    if (processedCount >= totalMessages) {
                      if (unreadMessages.length === 0) {
                        // logger.info('No unread messages found'); // Убрано избыточное логирование
                      }
                      this.imap.end();
                    }
                    return;
                  }
                  
                  // Получаем Message-ID из заголовков
                  if (!messageId && parsed.messageId) {
                    messageId = parsed.messageId;
                  }
                  
                  const fromEmail = parsed.from?.value?.[0]?.address;
                  const subject = parsed.subject || '';
                  const text = parsed.text || '';
                  const html = parsed.html || '';
                  
                  // Проверяем, что сообщение непрочитанное (нет флага \Seen)
                  const isUnread = !flags.includes('\\Seen');
                  
                  // Логируем только для отладки
                  // logger.info(`[EmailBot] Проверяем письмо: UID=${uid}, Message-ID=${messageId}, From=${fromEmail}, Unread=${isUnread}`); // Убрано избыточное логирование
                  
                  // Обрабатываем ВСЕ новые письма, независимо от статуса "прочитано"
                  // Проверка на уже обработанные письма будет в processIncomingEmail
                  unreadMessages.push({
                    uid,
                    messageId,
                    fromEmail,
                    subject,
                    text,
                    html,
                    parsed
                  });
                  
                  processedCount++;
                  if (processedCount >= totalMessages) {
                    if (unreadMessages.length === 0) {
                      logger.info('No unread messages found');
                      this.imap.end();
                      return;
                    }
                    
                    // logger.info(`[EmailBot] Найдено ${unreadMessages.length} непрочитанных сообщений`); // Убрано избыточное логирование
                    
                    // Обрабатываем каждое непрочитанное сообщение
                    for (const message of unreadMessages) {
                      // logger.info(`[EmailBot] Обрабатываем письмо: UID=${message.uid}, Message-ID=${message.messageId}, From=${message.fromEmail}`); // Убрано избыточное логирование
                      try {
                        await this.processIncomingEmail(message);
                      } catch (processErr) {
                        logger.error('Error processing incoming email:', processErr);
                      }
                    }
                    
                    this.imap.end();
                  }
                });
              });
            });
            
                        f.once('error', (err) => {
              logger.error(`Error fetching messages: ${err}`);
              this.imap.end();
            });
          });
        });
      });

      this.imap.connect();
    } catch (error) {
      logger.error(`Global error checking emails: ${error.message}`);
      try {
        this.imap.end();
      } catch (e) {
        // Игнорируем ошибки при закрытии
      }
    }
  }

  // Метод для отправки email
  async processIncomingEmail(messageData) {
    const { uid, messageId, fromEmail, subject, text, html, parsed } = messageData;
    
    try {
      logger.info(`[EmailBot] Обрабатываем письмо: UID=${uid}, Message-ID=${messageId}, From=${fromEmail}`);
      
      // Фильтруем системные email адреса
      const systemEmails = [
        'mailer-daemon@smtp.hostland.ru',
        'mailer-daemon@',
        'noreply@',
        'no-reply@',
        'postmaster@',
        'bounce@',
        'daemon@'
      ];
      
      const isSystemEmail = systemEmails.some(systemEmail => 
        fromEmail && fromEmail.toLowerCase().includes(systemEmail.toLowerCase())
      );
      
      if (isSystemEmail) {
        logger.info(`[EmailBot] Игнорируем системный email от ${fromEmail}`);
        return;
      }
      
      // Проверяем, что email адрес валидный
      if (!fromEmail || !fromEmail.includes('@')) {
        logger.info(`[EmailBot] Игнорируем email с невалидным адресом: ${fromEmail}`);
        return;
      }
      
      // Временные ограничения удалены - обрабатываем все письма независимо от возраста
      
      // 1. Найти или создать пользователя
      const { userId, role } = await identityService.findOrCreateUserWithRole('email', fromEmail);
      if (await isUserBlocked(userId)) {
        logger.info(`Email от заблокированного пользователя ${userId} проигнорирован.`);
        return;
      }
      
      // Проверяем, не обрабатывали ли мы уже это письмо
      if (messageId) {
        try {
          // Проверяем, есть ли уже ответ от AI для этого письма
          // Ищем сообщения с direction='out' и metadata, содержащим originalMessageId
          const existingResponse = await encryptedDb.getData(
            'messages',
            {
              user_id: userId,
              channel: 'email',
              direction: 'out'
            },
            1
          );
          
          // Проверяем в результатах, есть ли сообщение с metadata.originalMessageId = messageId
          const hasResponse = existingResponse.some(msg => {
            try {
              const metadata = msg.metadata;
              return metadata && metadata.originalMessageId === messageId;
            } catch (e) {
              return false;
            }
          });
          
          if (hasResponse) {
            logger.info(`[EmailBot] Письмо ${messageId} уже обработано - найден ответ от AI`);
            return;
          }
        } catch (error) {
          logger.error(`[EmailBot] Ошибка при проверке существующих ответов: ${error.message}`);
        }
      }
      
      // 1.1 Найти или создать беседу
      let conversationResult = await encryptedDb.getData(
        'conversations',
        { user_id: userId },
        1,
        'updated_at DESC, created_at DESC'
      );
      let conversation;
      if (conversationResult.length === 0) {
        const title = `Чат с пользователем ${userId}`;
        const newConv = await encryptedDb.saveData(
          'conversations',
          { user_id: userId, title: title, created_at: new Date(), updated_at: new Date() }
        );
        conversation = newConv;
      } else {
        conversation = conversationResult[0];
      }
      
      // Проверяем, что conversation создан успешно
      if (!conversation || !conversation.id) {
        logger.error(`[EmailBot] Conversation is undefined or has no id for user ${userId}`);
        return;
      }
      
      // 2. Сохранять все сообщения с conversation_id
      let hasAttachments = parsed.attachments && parsed.attachments.length > 0;
      if (hasAttachments) {
        for (const att of parsed.attachments) {
          await encryptedDb.saveData(
            'messages',
            {
              user_id: userId,
              conversation_id: conversation.id,
              sender_type: 'user',
              content: text,
              channel: 'email',
              role: role,
              direction: 'in',
              created_at: new Date(),
              attachment_filename: att.filename,
              attachment_mimetype: att.contentType,
              attachment_size: att.size,
              attachment_data: att.content,
              message_id: messageId // Сохраняем Message-ID для дедупликации (будет зашифрован в message_id_encrypted)
            }
          );
        }
      } else {
        await encryptedDb.saveData(
          'messages',
          {
            user_id: userId,
            conversation_id: conversation.id,
            sender_type: 'user',
            content: text,
            channel: 'email',
            role: role,
            direction: 'in',
            created_at: new Date(),
            message_id: messageId // Сохраняем Message-ID для дедупликации (будет зашифрован в message_id_encrypted)
          }
        );
      }
      
      // 3. Получить ответ от ИИ (RAG + LLM)
      const aiSettings = await aiAssistantSettingsService.getSettings();
      let ragTableId = null;
      if (aiSettings && aiSettings.selected_rag_tables) {
        ragTableId = Array.isArray(aiSettings.selected_rag_tables)
          ? aiSettings.selected_rag_tables[0]
          : aiSettings.selected_rag_tables;
      }
      let aiResponse;
      if (ragTableId) {
        // Сначала ищем ответ через RAG
        const ragResult = await ragAnswer({ tableId: ragTableId, userQuestion: text });
        if (ragResult && ragResult.answer && typeof ragResult.score === 'number' && Math.abs(ragResult.score) <= 0.1) {
          aiResponse = ragResult.answer;
        } else {
          // Используем очередь AIQueue для LLM генерации
          const requestId = await aiAssistant.addToQueue({
            message: text,
            history: null,
            systemPrompt: aiSettings ? aiSettings.system_prompt : '',
            rules: null
          }, 0);
          
          // Ждем ответ из очереди
          aiResponse = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('AI response timeout'));
            }, 120000); // 2 минуты таймаут
            
            const onCompleted = (item) => {
              if (item.id === requestId) {
                clearTimeout(timeout);
                aiAssistant.aiQueue.off('requestCompleted', onCompleted);
                aiAssistant.aiQueue.off('requestFailed', onFailed);
                resolve(item.result);
              }
            };
            
            const onFailed = (item) => {
              if (item.id === requestId) {
                clearTimeout(timeout);
                aiAssistant.aiQueue.off('requestCompleted', onCompleted);
                aiAssistant.aiQueue.off('requestFailed', onFailed);
                reject(new Error(item.error));
              }
            };
            
            aiAssistant.aiQueue.on('requestCompleted', onCompleted);
            aiAssistant.aiQueue.on('requestFailed', onFailed);
          });
        }
      } else {
        // Используем очередь AIQueue для обработки
        const requestId = await aiAssistant.addToQueue({
          message: text,
          history: null,
          systemPrompt: aiSettings ? aiSettings.system_prompt : '',
          rules: null
        }, 0);
        
        // Ждем ответ из очереди
        aiResponse = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('AI response timeout'));
          }, 120000); // 2 минуты таймаут
          
          const onCompleted = (item) => {
            if (item.id === requestId) {
              clearTimeout(timeout);
              aiAssistant.aiQueue.off('requestCompleted', onCompleted);
              aiAssistant.aiQueue.off('requestFailed', onFailed);
              resolve(item.result);
            }
          };
          
          const onFailed = (item) => {
            if (item.id === requestId) {
              clearTimeout(timeout);
              aiAssistant.aiQueue.off('requestCompleted', onCompleted);
              aiAssistant.aiQueue.off('requestFailed', onFailed);
              reject(new Error(item.error));
            }
          };
          
          aiAssistant.aiQueue.on('requestCompleted', onCompleted);
          aiAssistant.aiQueue.on('requestFailed', onFailed);
        });
      }
      
      if (await isUserBlocked(userId)) {
        logger.info(`[EmailBot] Пользователь ${userId} заблокирован — ответ ИИ не отправляется.`);
        return;
      }
      
      // 4. Сохранить ответ в БД с conversation_id
      await encryptedDb.saveData(
        'messages',
        {
          user_id: userId,
          conversation_id: conversation.id,
          sender_type: 'assistant',
          content: aiResponse,
          channel: 'email',
          role: role,
          direction: 'out',
          created_at: new Date(),
          metadata: JSON.stringify({ 
            subject, 
            html, 
            originalMessageId: messageId,
            originalUid: uid,
            originalFromEmail: fromEmail,
            isResponse: true
          })
        }
      );
      
      // 5. Отправить ответ на email
      try {
        await this.sendEmail(fromEmail, 'Re: ' + subject, aiResponse);
        logger.info(`[EmailBot] Email response sent successfully to ${fromEmail}`);
      } catch (emailError) {
        logger.error(`[EmailBot] Failed to send email response to ${fromEmail}:`, emailError);
        // Продолжаем выполнение, даже если email не отправлен
      }
      
      // После каждого успешного создания пользователя:
      broadcastContactsUpdate();
      
    } catch (processErr) {
      logger.error('Error processing incoming email:', processErr);
    }
  }

  async sendEmail(to, subject, text) {
    const maxRetries = 1;
    const retryDelay = 5000; // 5 секунд между попытками
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const settings = await this.getSettingsFromDb();
        const transporter = await this.getTransporter();
        
        const mailOptions = {
          from: settings.from_email,
          to,
          subject,
          text,
        };
        
        await transporter.sendMail(mailOptions);
        // logger.info(`Email sent to ${to} (attempt ${attempt})`); // Убрано логирование email адреса
        
        // Закрываем соединение после успешной отправки
        transporter.close();
        return true;
        
      } catch (error) {
        logger.error(`Error sending email (attempt ${attempt}/${maxRetries}):`, error);
        
        // Если это последняя попытка, выбрасываем ошибку
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Если ошибка связана с превышением лимита соединений, ждем дольше
        const isConnectionLimitError = error.message && (
          error.message.includes('too many connections') ||
          error.message.includes('421 4.7.0') ||
          error.message.includes('EPROTOCOL')
        );
        
        const waitTime = isConnectionLimitError ? retryDelay * 2 : retryDelay;
        logger.info(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  async start() {
    try {
      // console.log('[EmailBot] start() called');
      logger.info('[EmailBot] start() called');

      // Очищаем предыдущее соединение если есть
      this.cleanupImapConnection();

      let attempt = 0;
      const maxAttempts = 3;

      const tryConnect = async () => {
        attempt++;
        this.imap = new Imap(await this.getImapConfig());
        
        // Устанавливаем обработчики событий
        this.imap.once('ready', () => {
          this.reconnectAttempts = 0; // Сбрасываем счетчик при успешном подключении
          this.checkEmails();
        });
        
        this.imap.once('end', () => {
          logger.info('[EmailBot] IMAP connection ended');
          this.cleanupImapConnection();
        });
        
        this.imap.once('close', () => {
          logger.info('[EmailBot] IMAP connection closed');
          this.cleanupImapConnection();
        });
        
        this.imap.once('error', (err) => {
          logger.error(`[EmailBot] IMAP connection error: ${err.message}`);
          logger.error(`[EmailBot] Error details:`, {
            code: err.code,
            errno: err.errno,
            syscall: err.syscall,
            hostname: err.hostname,
            port: err.port,
            stack: err.stack
          });
          this.cleanupImapConnection();
          
          // Более детальная логика переподключения
          if (attempt < maxAttempts) {
            let reconnectDelay = 10000;
            let reconnectReason = 'default';
            
            if (err.message && err.message.toLowerCase().includes('timed out')) {
              reconnectDelay = 15000; // Увеличиваем задержку для таймаутов
              reconnectReason = 'timeout';
            } else if (err.code === 'ECONNREFUSED') {
              reconnectDelay = 30000; // Дольше ждем для отказа в соединении
              reconnectReason = 'connection refused';
            } else if (err.code === 'ENOTFOUND') {
              reconnectDelay = 60000; // Еще дольше для проблем с DNS
              reconnectReason = 'DNS resolution failed';
            }
            
            logger.warn(`[EmailBot] IMAP reconnecting in ${reconnectDelay/1000} seconds (attempt ${attempt + 1}/${maxAttempts}, reason: ${reconnectReason})...`);
            setTimeout(tryConnect, reconnectDelay);
          } else {
            logger.error(`[EmailBot] Max reconnection attempts reached (${maxAttempts}). Stopping reconnection.`);
          }
        });
        
        this.imap.connect();
      };
      tryConnect();
    } catch (err) {
      // console.error('[EmailBot] Ошибка при старте:', err);
      logger.error('[EmailBot] Ошибка при старте:', err);
      this.cleanupImapConnection();
      throw err;
    }
  }

      async getAllEmailSettings() {
     const settings = await encryptedDb.getData('email_settings', {}, null, 'id');
     return settings;
    }

  // Сохранение email настроек
  async saveEmailSettings(settings) {
    try {
      // Проверяем, существуют ли уже настройки
      const existingSettings = await encryptedDb.getData('email_settings', {}, 1);
      
      let result;
      if (existingSettings.length > 0) {
        // Если настройки существуют, обновляем их
        const existingId = existingSettings[0].id;
        result = await encryptedDb.saveData('email_settings', settings, { id: existingId });
      } else {
        // Если настроек нет, создаем новые
        result = await encryptedDb.saveData('email_settings', settings, null);
      }
      
      logger.info('Email settings saved successfully');
      return { success: true, data: result };
    } catch (error) {
      logger.error('Error saving email settings:', error);
      throw error;
    }
  }

  // Тест IMAP подключения
  async testImapConnection() {
    return new Promise(async (resolve, reject) => {
      try {
        logger.info('[EmailBot] Testing IMAP connection...');
        
        // Получаем конфигурацию IMAP
        const imapConfig = await this.getImapConfig();
        
        // Создаем временное IMAP соединение для теста
        const testImap = new Imap(imapConfig);
        
        let connectionTimeout = setTimeout(() => {
          testImap.end();
          reject(new Error('IMAP connection timeout after 30 seconds'));
        }, 30000);
        
        testImap.once('ready', () => {
          clearTimeout(connectionTimeout);
          logger.info('[EmailBot] IMAP connection test successful');
          testImap.end();
          resolve({ 
            success: true, 
            message: 'IMAP подключение успешно установлено',
            details: {
              host: imapConfig.host,
              port: imapConfig.port,
              user: imapConfig.user
            }
          });
        });
        
        testImap.once('error', (err) => {
          clearTimeout(connectionTimeout);
          logger.error(`[EmailBot] IMAP connection test failed: ${err.message}`);
          testImap.end();
          reject(new Error(`IMAP подключение не удалось: ${err.message}`));
        });
        
        testImap.once('end', () => {
          clearTimeout(connectionTimeout);
          logger.info('[EmailBot] IMAP connection test ended');
        });
        
        testImap.connect();
        
      } catch (error) {
        reject(new Error(`Ошибка при тестировании IMAP: ${error.message}`));
      }
    });
  }

  // Тест SMTP подключения
  async testSmtpConnection() {
    return new Promise(async (resolve, reject) => {
      try {
        logger.info('[EmailBot] Testing SMTP connection...');
        
        // Получаем транспортер SMTP
        const transporter = await this.getTransporter();
        
        // Тестируем подключение
        await transporter.verify();
        
        logger.info('[EmailBot] SMTP connection test successful');
        resolve({ 
          success: true, 
          message: 'SMTP подключение успешно установлено',
          details: {
            host: transporter.options.host,
            port: transporter.options.port,
            secure: transporter.options.secure
          }
        });
        
      } catch (error) {
        logger.error(`[EmailBot] SMTP connection test failed: ${error.message}`);
        reject(new Error(`SMTP подключение не удалось: ${error.message}`));
      }
    });
  }
}

// console.log('[EmailBot] module.exports = EmailBotService');
module.exports = EmailBotService;
