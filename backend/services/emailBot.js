const { pool } = require('../db');
const nodemailer = require('nodemailer');
const Imap = require('imap');
const simpleParser = require('mailparser').simpleParser;
const { processMessage } = require('./ai-assistant');
const { inspect } = require('util');
const logger = require('../utils/logger');
const verificationService = require('./verification-service');

// Конфигурация для отправки писем
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST,
  port: process.env.EMAIL_SMTP_PORT,
  secure: process.env.EMAIL_SMTP_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Конфигурация для получения писем
const imapConfig = {
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
  host: process.env.EMAIL_IMAP_HOST,
  port: process.env.EMAIL_IMAP_PORT,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
};

class EmailBotService {
  constructor(user, password) {
    this.user = user;
    this.password = password;
    this.transporter = transporter;
    this.imap = new Imap(imapConfig);
    this.initialize();
    this.listenForReplies();
  }

  initialize() {
    this.imap.once('error', (err) => {
      logger.error(`IMAP connection error: ${err.message}`);
    });
  }

  async sendVerificationCode(toEmail, userId) {
    try {
      // Создаем код через сервис верификации
      const code = await verificationService.createVerificationCode(
        'email',
        toEmail.toLowerCase(),
        userId
      );
      
      // Отправляем письмо с кодом
      const mailOptions = {
        from: this.user,
        to: toEmail,
        subject: 'Код подтверждения для DApp for Business',
        text: `Ваш код подтверждения: ${code}\n\nДля завершения аутентификации, пожалуйста, ответьте на это письмо, указав только полученный код.\n\nКод действителен в течение 15 минут.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #333;">Код подтверждения для DApp for Business</h2>
            <p>Ваш код подтверждения:</p>
            <div style="font-size: 24px; font-weight: bold; padding: 15px; background-color: #f5f5f5; border-radius: 5px; text-align: center; margin: 20px 0;">
              ${code}
            </div>
            <p>Для завершения аутентификации, пожалуйста, ответьте на это письмо, указав только полученный код.</p>
            <p>Код действителен в течение 15 минут.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
            <p style="font-size: 12px; color: #777;">Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      
      return { success: true, code };
    } catch (error) {
      logger.error(`Error sending email: ${error}`);
      return { success: false, error: error.message };
    }
  }

  listenForReplies() {
    // Запускаем проверку почты каждые 30 секунд
    setInterval(() => {
      this.checkEmails();
    }, 30000);
  }

  checkEmails() {
    try {
      // Добавляем обработчики ошибок
      this.imap.once('error', (err) => {
        logger.error(`IMAP connection error during check: ${err.message}`);
        // Пытаемся закрыть соединение при ошибке
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
            
            // Защищаемся от пустых результатов
            try {
              const f = this.imap.fetch(results, { bodies: '' });
              
              f.on('message', (msg, seqno) => {
                msg.on('body', (stream, info) => {
                  simpleParser(stream, async (err, parsed) => {
                    if (err) {
                      logger.error(`Error parsing message: ${err}`);
                      return;
                    }
                    
                    // Обработка входящего письма
                    try {
                      await this.processEmail(parsed);
                    } catch (e) {
                      logger.error(`Error processing email: ${e.message}`);
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
      // Обеспечиваем корректное завершение IMAP сессии
      try {
        this.imap.end();
      } catch (e) {
        // Игнорируем ошибки при закрытии
      }
    }
  }

  async processEmail(email) {
    try {
      const fromEmail = email.from.value[0].address.toLowerCase();
      const subject = email.subject;
      const text = email.text;

      // Ищем код в тексте письма
      const codeMatch = text.match(/\b\d{6}\b/);
      if (!codeMatch) return;
      
      const code = codeMatch[0];
      
      // Проверяем код через сервис верификации
      const result = await verificationService.verifyCode(code, 'email', fromEmail);
      
      if (!result.success) {
        // Отправляем сообщение об ошибке
        await this.transporter.sendMail({
          from: this.user,
          to: fromEmail,
          subject: 'Ошибка верификации',
          text: 'Неверный или истекший код подтверждения. Пожалуйста, запросите новый код.'
        });
        return;
      }
      
      // Код верный и актуальный
      const userId = result.userId;
      
      // Добавляем идентификатор email для пользователя
      await pool.query(
        'INSERT INTO user_identities (user_id, identity_type, identity_value, verified, created_at) ' +
        'VALUES ($1, $2, $3, true, NOW()) ' +
        'ON CONFLICT (identity_type, identity_value) ' +
        'DO UPDATE SET user_id = $1, verified = true',
        [userId, 'email', fromEmail]
      );
      
      // Отправляем подтверждение
      await this.transporter.sendMail({
        from: this.user,
        to: fromEmail,
        subject: 'Аутентификация успешна',
        text: 'Ваш email успешно связан с аккаунтом DApp for Business.'
      });
      
    } catch (error) {
      logger.error(`Error processing email: ${error}`);
    }
  }

  // Метод для проверки кода без IMAP
  async verifyCode(email, code) {
    return await verificationService.verifyCode(code, 'email', email.toLowerCase());
  }

  // Оставляем существующие методы
  async sendEmail(to, subject, text) {
    try {
      const mailOptions = {
        from: this.user,
        to,
        subject,
        text
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error(`Error sending email: ${error}`);
      return false;
    }
  }
}

module.exports = {
  EmailBotService,
  transporter
};
