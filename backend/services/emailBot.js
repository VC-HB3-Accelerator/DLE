console.log('[EmailBot] emailBot.js loaded');
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

class EmailBotService {
  constructor() {
    console.log('[EmailBot] constructor called');
  }

  async getSettingsFromDb() {
    const { rows } = await db.getQuery()('SELECT * FROM email_settings ORDER BY id LIMIT 1');
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
                      let hasAttachments = parsed.attachments && parsed.attachments.length > 0;
                      if (hasAttachments) {
                        for (const att of parsed.attachments) {
                          await db.getQuery()(
                            `INSERT INTO messages (user_id, conversation_id, sender_type, content, channel, role, direction, created_at, attachment_filename, attachment_mimetype, attachment_size, attachment_data, metadata)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12)`,
                            [userId, conversation.id, 'user', text, 'email', role, 'in',
                              att.filename,
                              att.contentType,
                              att.size,
                              att.content,
                              JSON.stringify({ subject, html })
                            ]
                          );
                        }
                      } else {
                        await db.getQuery()(
                          `INSERT INTO messages (user_id, conversation_id, sender_type, content, channel, role, direction, created_at, metadata)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
                          [userId, conversation.id, 'user', text, 'email', role, 'in', JSON.stringify({ subject, html })]
                        );
                      }
                      // 3. Получить ответ от ИИ
                      const aiResponse = await aiAssistant.getResponse(text, 'auto');
                      // 4. Сохранить ответ в БД с conversation_id
                      await db.getQuery()(
                        `INSERT INTO messages (user_id, conversation_id, sender_type, content, channel, role, direction, created_at, metadata)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
                        [userId, conversation.id, 'assistant', aiResponse, 'email', role, 'out', JSON.stringify({ subject, html })]
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
    const { rows } = await db.getQuery()('SELECT id, from_email FROM email_settings ORDER BY id');
    return rows;
  }
}

console.log('[EmailBot] module.exports = EmailBotService');
module.exports = EmailBotService;
