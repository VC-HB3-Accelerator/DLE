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

const nodemailer = require('nodemailer');
const Imap = require('imap');
const simpleParser = require('mailparser').simpleParser;
const logger = require('../utils/logger');
const encryptedDb = require('./encryptedDatabaseService');
const db = require('../db');

/**
 * EmailBot - обработчик Email сообщений
 * Унифицированный интерфейс для работы с Email (IMAP + SMTP)
 */
class EmailBot {
  constructor() {
    this.name = 'EmailBot';
    this.channel = 'email';
    this.imap = null;
    this.transporter = null;
    this.settings = null;
    this.isInitialized = false;
    this.status = 'inactive';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
  }

  /**
   * Инициализация Email Bot
   */
  async initialize() {
    try {
      logger.info('[EmailBot] 🚀 Инициализация Email Bot...');
      
      // Загружаем настройки из БД
      this.settings = await this.loadSettings();
      
      if (!this.settings) {
        logger.warn('[EmailBot] ⚠️ Настройки Email не найдены');
        this.status = 'not_configured';
        return { success: false, reason: 'not_configured' };
      }

      // Создаем SMTP транспортер
      this.transporter = await this.createTransporter();
      
      // Создаем IMAP соединение
      await this.initializeImap();
      
      this.isInitialized = true;
      this.status = 'active';
      
      logger.info('[EmailBot] ✅ Email Bot успешно инициализирован');
      return { success: true };
      
    } catch (error) {
      logger.error('[EmailBot] ❌ Ошибка инициализации:', error);
      this.status = 'error';
      return { success: false, error: error.message };
    }
  }

  /**
   * Загрузка настроек из БД
   */
  async loadSettings() {
    try {
      const encryptionUtils = require('../utils/encryptionUtils');
      const encryptionKey = encryptionUtils.getEncryptionKey();
      
      const { rows } = await db.getQuery()(
        'SELECT id, smtp_port, imap_port, created_at, updated_at, ' +
        'decrypt_text(smtp_host_encrypted, $1) as smtp_host, ' +
        'decrypt_text(smtp_user_encrypted, $1) as smtp_user, ' +
        'decrypt_text(smtp_password_encrypted, $1) as smtp_password, ' +
        'decrypt_text(imap_host_encrypted, $1) as imap_host, ' +
        'decrypt_text(imap_user_encrypted, $1) as imap_user, ' +
        'decrypt_text(imap_password_encrypted, $1) as imap_password, ' +
        'decrypt_text(from_email_encrypted, $1) as from_email ' +
        'FROM email_settings ORDER BY id LIMIT 1',
        [encryptionKey]
      );
      
      if (!rows.length) {
        return null;
      }
      
      return rows[0];
    } catch (error) {
      logger.error('[EmailBot] Ошибка загрузки настроек:', error);
      throw error;
    }
  }

  /**
   * Создание SMTP транспортера
   */
  async createTransporter() {
    return nodemailer.createTransport({
      host: this.settings.smtp_host,
      port: 465,
      secure: true,
      auth: {
        user: this.settings.smtp_user,
        pass: this.settings.smtp_password,
      },
      pool: false,
      maxConnections: 1,
      maxMessages: 1,
      tls: { 
        rejectUnauthorized: false
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    });
  }

  /**
   * Инициализация IMAP соединения
   */
  async initializeImap() {
    try {
      // Очищаем предыдущее соединение
      this.cleanupImap();

      this.imap = new Imap({
        user: this.settings.imap_user,
        password: this.settings.imap_password,
        host: this.settings.imap_host,
        port: 993,
        tls: true,
        tlsOptions: { 
          rejectUnauthorized: false,
          servername: this.settings.imap_host,
          ciphers: 'HIGH:!aNULL:!MD5:!RC4'
        },
        keepalive: {
          interval: 10000,
          idleInterval: 300000,
          forceNoop: true,
        },
        connTimeout: 60000,
        authTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        debug: false
      });

      // Настраиваем обработчики событий
      this.setupImapHandlers();
      
      // Подключаемся
      this.imap.connect();
      
    } catch (error) {
      logger.error('[EmailBot] Ошибка инициализации IMAP:', error);
      throw error;
    }
  }

  /**
   * Настройка обработчиков IMAP событий
   */
  setupImapHandlers() {
    this.imap.once('ready', () => {
      logger.info('[EmailBot] IMAP соединение установлено');
      this.reconnectAttempts = 0;
      this.checkEmails();
    });
    
    this.imap.once('end', () => {
      logger.info('[EmailBot] IMAP соединение завершено');
      this.cleanupImap();
    });
    
    this.imap.once('close', () => {
      logger.info('[EmailBot] IMAP соединение закрыто');
      this.cleanupImap();
    });
    
    this.imap.once('error', (err) => {
      logger.error('[EmailBot] IMAP ошибка:', err.message);
      this.cleanupImap();
      this.handleReconnection(err);
    });
  }

  /**
   * Очистка IMAP соединения
   */
  cleanupImap() {
    if (this.imap) {
      try {
        this.imap.removeAllListeners('error');
        this.imap.removeAllListeners('ready');
        this.imap.removeAllListeners('end');
        this.imap.removeAllListeners('close');
        
        if (this.imap.state !== 'disconnected') {
          this.imap.end();
        }
      } catch (error) {
        logger.error('[EmailBot] Ошибка очистки IMAP:', error);
      } finally {
        this.imap = null;
      }
    }
  }

  /**
   * Обработка переподключения IMAP
   */
  handleReconnection(err) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[EmailBot] Достигнут максимум попыток переподключения');
      this.status = 'connection_failed';
      return;
    }

    let reconnectDelay = 10000;
    
    if (err.message && err.message.toLowerCase().includes('timed out')) {
      reconnectDelay = 15000;
    } else if (err.code === 'ECONNREFUSED') {
      reconnectDelay = 30000;
    } else if (err.code === 'ENOTFOUND') {
      reconnectDelay = 60000;
    }

    this.reconnectAttempts++;
    logger.warn(`[EmailBot] Переподключение через ${reconnectDelay/1000}с (попытка ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => this.initializeImap(), reconnectDelay);
  }

  /**
   * Проверка входящих писем
   */
  checkEmails() {
    try {
      this.imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          logger.error('[EmailBot] Ошибка открытия INBOX:', err);
          return;
        }

        this.imap.search(['ALL'], (err, results) => {
          if (err || !results || results.length === 0) {
            this.imap.end();
            return;
          }

          const f = this.imap.fetch(results, { 
            bodies: '',
            markSeen: true,
            struct: true
          });

          let processedCount = 0;
          const totalMessages = results.length;

          f.on('message', (msg, seqno) => {
            let messageId = null;
            let uid = null;
            
            msg.once('attributes', (attrs) => {
              uid = attrs.uid;
              if (attrs['x-gm-msgid']) {
                messageId = attrs['x-gm-msgid'];
              }
            });
            
            msg.on('body', (stream, info) => {
              simpleParser(stream, async (err, parsed) => {
                if (err) {
                  processedCount++;
                  if (processedCount >= totalMessages) {
                    this.imap.end();
                  }
                  return;
                }
                
                if (!messageId && parsed.messageId) {
                  messageId = parsed.messageId;
                }
                
                const messageData = this.extractMessageData(parsed, messageId, uid);
                if (messageData && this.messageProcessor) {
                  await this.messageProcessor(messageData);
                }
                
                processedCount++;
                if (processedCount >= totalMessages) {
                  this.imap.end();
                }
              });
            });
          });
          
          f.once('error', (err) => {
            logger.error('[EmailBot] Ошибка получения писем:', err);
            this.imap.end();
          });
        });
      });
    } catch (error) {
      logger.error('[EmailBot] Ошибка проверки писем:', error);
      try {
        this.imap.end();
      } catch (e) {
        // Игнорируем ошибки при закрытии
      }
    }
  }

  /**
   * Извлечение данных из Email сообщения
   * @param {Object} parsed - Распарсенное письмо
   * @param {string} messageId - ID сообщения
   * @param {number} uid - UID сообщения
   * @returns {Object|null} - Стандартизированные данные сообщения
   */
  extractMessageData(parsed, messageId, uid) {
    try {
      const fromEmail = parsed.from?.value?.[0]?.address;
      const subject = parsed.subject || '';
      const text = parsed.text || '';

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
      
      if (isSystemEmail || !fromEmail || !fromEmail.includes('@')) {
        return null;
      }

      const attachments = [];
      if (parsed.attachments && parsed.attachments.length > 0) {
        const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
        
        for (const att of parsed.attachments) {
          if (att.size <= MAX_ATTACHMENT_SIZE) {
            attachments.push({
              filename: att.filename,
              mimetype: att.contentType,
              size: att.size,
              data: att.content
            });
          }
        }
      }

      return {
        channel: 'email',
        identifier: fromEmail,
        content: text,
        attachments: attachments,
        metadata: {
          subject: subject,
          messageId: messageId,
          uid: uid,
          fromEmail: fromEmail,
          html: parsed.html || ''
        }
      };
    } catch (error) {
      logger.error('[EmailBot] Ошибка извлечения данных из письма:', error);
      return null;
    }
  }

  /**
   * Отправка email сообщения
   * @param {string} to - Адрес получателя
   * @param {string} subject - Тема письма
   * @param {string} text - Текст письма
   * @returns {Promise<boolean>} - Успешность отправки
   */
  async sendEmail(to, subject, text) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      throw new Error(`Неверный формат email адреса: ${to}`);
    }
    
    try {
      const mailOptions = {
        from: this.settings.from_email,
        to,
        subject,
        text,
      };
      
      await this.transporter.sendMail(mailOptions);
      this.transporter.close();
      
      logger.info(`[EmailBot] Email отправлен успешно: ${to}`);
      return true;
      
    } catch (error) {
      logger.error('[EmailBot] Ошибка отправки email:', error);
      throw error;
    }
  }

  /**
   * Отправка кода верификации
   * @param {string} email - Email получателя
   * @param {string} code - Код верификации
   */
  async sendVerificationCode(email, code) {
    try {
      const mailOptions = {
        from: this.settings.from_email,
        to: email,
        subject: 'Код подтверждения',
        text: `Ваш код подтверждения: ${code}\n\nКод действителен в течение 15 минут.`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Код подтверждения</h2>
          <p style="font-size: 16px; color: #666;">Ваш код подтверждения:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; color: #333;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #999;">Код действителен в течение 15 минут.</p>
        </div>`,
      };
      
      await this.transporter.sendMail(mailOptions);
      logger.info('[EmailBot] Код верификации отправлен');
    } catch (error) {
      logger.error('[EmailBot] Ошибка отправки кода верификации:', error);
      throw error;
    }
  }

  /**
   * Установка процессора сообщений
   * @param {Function} processor - Функция обработки сообщений
   */
  setMessageProcessor(processor) {
    this.messageProcessor = processor;
  }

  /**
   * Проверка статуса бота
   * @returns {Object} - Статус бота
   */
  getStatus() {
    return {
      name: this.name,
      channel: this.channel,
      isInitialized: this.isInitialized,
      status: this.status,
      hasSettings: !!this.settings,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Остановка бота
   */
  async stop() {
    try {
      logger.info('[EmailBot] 🛑 Остановка Email Bot...');
      
      this.cleanupImap();
      
      if (this.transporter) {
        this.transporter.close();
        this.transporter = null;
      }
      
      this.isInitialized = false;
      this.status = 'inactive';
      
      logger.info('[EmailBot] ✅ Email Bot остановлен');
    } catch (error) {
      logger.error('[EmailBot] ❌ Ошибка остановки:', error);
      throw error;
    }
  }
}

module.exports = EmailBot;

