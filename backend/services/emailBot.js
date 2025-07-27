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

console.log('[EmailBot] emailBot.js loaded');
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
    console.log('[EmailBot] constructor called');
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
      console.error('Error reading encryption key:', keyError);
    }
    
    const { rows } = await db.getQuery()(
      'SELECT id, smtp_port, imap_port, created_at, updated_at, decrypt_text(smtp_host_encrypted, $1) as smtp_host, decrypt_text(smtp_user_encrypted, $1) as smtp_user, decrypt_text(smtp_password_encrypted, $1) as smtp_password, decrypt_text(imap_host_encrypted, $1) as imap_host, decrypt_text(from_email_encrypted, $1) as from_email FROM email_settings ORDER BY id LIMIT 1',
      [encryptionKey]
    );
    if (!rows.length) throw new Error('Email settings not found in DB');
    return rows[0];
  }

  async getTransporter() {
    const settings = await this.getSettingsFromDb();
    return nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: true,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_password,
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 5,
      tls: { rejectUnauthorized: false },
    });
  }

  async getImapConfig() {
    const settings = await this.getSettingsFromDb();
    return {
      user: settings.smtp_user,
      password: settings.smtp_password,
      host: settings.imap_host,
      port: settings.imap_port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      keepalive: {
        interval: 10000,
        idleInterval: 300000,
        forceNoop: true,
      },
      connTimeout: 30000, // 30 секунд
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
      logger.info(`Verification code sent to ${email}`);
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

          // Ищем непрочитанные письма
          this.imap.search(['UNSEEN'], (err, results) => {
            if (err) {
              logger.error(`Error searching messages: ${err}`);
              this.imap.end();
              return;
            }

            if (!results || results.length === 0) {
              logger.info('No new messages found');
              this.imap.end();
              return;
            }

            try {
              const f = this.imap.fetch(results, { bodies: '' });

              f.on('message', (msg, seqno) => {
                msg.on('body', (stream, info) => {
                  simpleParser(stream, async (err, parsed) => {
                    if (err) {
                      logger.error(`Error parsing message: ${err}`);
                      return;
                    }
                    try {
                      const fromEmail = parsed.from?.value?.[0]?.address;
                      const subject = parsed.subject || '';
                      const text = parsed.text || '';
                      const html = parsed.html || '';
                      // 1. Найти или создать пользователя
                      const { userId, role } = await identityService.findOrCreateUserWithRole('email', fromEmail);
                      if (await isUserBlocked(userId)) {
                        logger.info(`Email от заблокированного пользователя ${userId} проигнорирован.`);
                        return;
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
                               metadata: JSON.stringify({ subject, html })
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
                             metadata: JSON.stringify({ subject, html })
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
                        if (ragResult && ragResult.answer && typeof ragResult.score === 'number' && Math.abs(ragResult.score) <= 0.3) {
                          aiResponse = ragResult.answer;
                        } else {
                          aiResponse = await generateLLMResponse({
                            userQuestion: text,
                            context: ragResult && ragResult.context ? ragResult.context : '',
                            answer: ragResult && ragResult.answer ? ragResult.answer : '',
                            systemPrompt: aiSettings ? aiSettings.system_prompt : '',
                            history: null,
                            model: aiSettings ? aiSettings.model : undefined,
                            language: aiSettings && aiSettings.languages && aiSettings.languages.length > 0 ? aiSettings.languages[0] : 'ru'
                          });
                        }
                      } else {
                        aiResponse = await aiAssistant.getResponse(text, 'auto');
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
                           metadata: JSON.stringify({ subject, html })
                         }
                        );
                      // 5. Отправить ответ на email
                      await this.sendEmail(fromEmail, 'Re: ' + subject, aiResponse);
                      // После каждого успешного создания пользователя:
                      broadcastContactsUpdate();
                    } catch (processErr) {
                      logger.error('Error processing incoming email:', processErr);
                    }
                  });
                });
              });

              f.once('error', (err) => {
                logger.error(`Fetch error: ${err}`);
              });

              f.once('end', () => {
                try {
                  this.imap.end();
                } catch (e) {
                  logger.error(`Error ending IMAP connection: ${e.message}`);
                }
              });
            } catch (e) {
              logger.error(`Error fetching messages: ${e.message}`);
              try {
                this.imap.end();
              } catch (e) {
                // Игнорируем ошибки при закрытии
              }
            }
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
  async sendEmail(to, subject, text) {
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
      logger.info(`Email sent to ${to}`);
      return true;
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  async start() {
    try {
      console.log('[EmailBot] start() called');
      logger.info('[EmailBot] start() called');
      const imapConfig = await this.getImapConfig();
      // Логируем IMAP-конфиг (без пароля)
      const safeConfig = { ...imapConfig };
      if (safeConfig.password) safeConfig.password = '***';
      logger.info('[EmailBot] IMAP config:', safeConfig);
      let attempt = 0;
      const maxAttempts = 3;
      this.isChecking = false;
      const tryConnect = () => {
        attempt++;
        logger.info(`[EmailBot] IMAP connect attempt ${attempt}`);
        this.imap = new Imap(imapConfig);
        this.imap.once('ready', () => {
          logger.info('[EmailBot] IMAP connection ready');
          this.imap.openBox('INBOX', false, (err, box) => {
            if (err) {
              logger.error(`[EmailBot] Error opening INBOX: ${err.message}`);
              this.imap.end();
              return;
            }
            logger.info('[EmailBot] INBOX opened successfully');
          });
          // После успешного подключения — обычная логика
          this.checkEmails();
          logger.info('[EmailBot] Email bot started and IMAP connection initiated');
          // Периодическая проверка почты
          setInterval(async () => {
            if (this.isChecking) return;
            this.isChecking = true;
            try {
              await this.checkEmails();
            } catch (e) {
              logger.error('[EmailBot] Error in periodic checkEmails:', e);
            }
            this.isChecking = false;
          }, 60000); // 60 секунд
        });
        this.imap.once('error', (err) => {
          logger.error(`[EmailBot] IMAP connection error: ${err.message}`);
          if (err.message && err.message.toLowerCase().includes('timed out') && attempt < maxAttempts) {
            logger.warn(`[EmailBot] IMAP reconnecting in 10 seconds (attempt ${attempt + 1})...`);
            setTimeout(tryConnect, 10000);
          }
        });
        this.imap.connect();
      };
      tryConnect();
    } catch (err) {
      console.error('[EmailBot] Ошибка при старте:', err);
      logger.error('[EmailBot] Ошибка при старте:', err);
      throw err;
    }
  }

      async getAllEmailSettings() {
     const settings = await encryptedDb.getData('email_settings', {}, null, 'id');
     return settings;
    }
}

console.log('[EmailBot] module.exports = EmailBotService');
module.exports = EmailBotService;
